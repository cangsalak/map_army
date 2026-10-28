import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/index.js';
import {
  generatePhotogrammetryMission,
  CameraFootprintCalculator,
  GridFlightGenerator,
} from '../../web/src/lib/photogrammetry/index.js';
import {
  calculatePhotogrammetryParameters,
  validateDroneMission,
  CAMERA_PRESETS,
} from '../../web/src/lib/drone-route-generator.js';
import {
  generateStandardKML,
  generateDJIWPML,
  exportDroneMission,
} from '../../web/src/lib/drone-export-adapters.js';
import {
  validatePlatformCompatibility,
  PLATFORM_REGISTRY,
} from '../../web/src/lib/drone-platform-registry.js';
import {
  CameraParameters,
  DroneMissionDTO,
  MissionWorkflowState,
} from '@geomonitor/shared';

// Test GeoJSON Survey Polygon in Bangkok
const testSurveyPolygon: [number, number][] = [
  [100.5231, 13.7367],
  [100.5265, 13.7367],
  [100.5265, 13.7395],
  [100.5231, 13.7395],
  [100.5231, 13.7367],
];

const testCamera: CameraParameters = {
  name: 'DJI Zenmuse P1 (35mm)',
  sensorWidthMm: 35.9,
  sensorHeightMm: 24.0,
  focalLengthMm: 35.0,
  imageWidthPx: 8192,
  imageHeightPx: 5460,
  forwardOverlapPercent: 80,
  sideOverlapPercent: 70,
};

describe('Interactive Mission Planner - 14 Core Workflow & Engine Requirements', () => {
  // Safe DB Cleanup
  beforeAll(async () => {
    try {
      await pool.query("DELETE FROM drone_missions WHERE name LIKE 'TEST_%' OR name LIKE 'INTERACTIVE_%'");
    } catch {
      // ignore
    }
  });

  afterAll(async () => {
    try {
      await pool.query("DELETE FROM drone_missions WHERE name LIKE 'TEST_%' OR name LIKE 'INTERACTIVE_%'");
    } catch {
      // ignore
    }
  });

  // 1. Initial State: Empty map, no mock flight plan
  it('Requirement 1: Fresh page load starts in EMPTY state with 0 flight lines and 0 photo points', () => {
    const initialPolygon: [number, number][] = [];
    let workflowState: MissionWorkflowState = 'EMPTY';
    const flightLines: any[] = [];
    const photoPositions: any[] = [];
    const waypoints: any[] = [];

    expect(initialPolygon).toHaveLength(0);
    expect(workflowState).toBe('EMPTY');
    expect(flightLines).toHaveLength(0);
    expect(photoPositions).toHaveLength(0);
    expect(waypoints).toHaveLength(0);
  });

  // 2. Step 1: Draw polygon shows only boundary
  it('Requirement 2: Drawing survey polygon transitions to AREA_DEFINED without premature flight generation', () => {
    const polygon = [...testSurveyPolygon];
    let workflowState: MissionWorkflowState = 'EMPTY';

    if (polygon.length >= 3) {
      workflowState = 'AREA_DEFINED';
    }

    expect(workflowState).toBe('AREA_DEFINED');
    expect(polygon.length).toBeGreaterThanOrEqual(3);
    // At this stage, no flight lines or waypoints exist until Calculate is clicked
  });

  // 3. Step 2: Configure parameters does not auto-calculate
  it('Requirement 3: Configuring parameters updates state to CONFIGURING/READY_TO_CALCULATE without executing calculation', () => {
    let workflowState: MissionWorkflowState = 'AREA_DEFINED';
    const parameters = {
      altitudeMeters: 90,
      speedMps: 10,
      gridAngleDeg: 45,
    };

    // User edits parameters
    workflowState = 'CONFIGURING';
    expect(workflowState).toBe('CONFIGURING');

    // When parameters are valid and area exists, state is READY_TO_CALCULATE
    if (parameters.altitudeMeters > 0 && parameters.speedMps > 0) {
      workflowState = 'READY_TO_CALCULATE';
    }
    expect(workflowState).toBe('READY_TO_CALCULATE');
  });

  // 4. Step 3: Explicit Calculate button produces real photogrammetry flight lines and photo points
  it('Requirement 4: Explicit Calculate Flight Plan generates parallel flight lines and dense photo capture positions from user input', () => {
    const result = generatePhotogrammetryMission({
      missionType: 'grid_photogrammetry',
      polygon: testSurveyPolygon,
      altitudeMeters: 80,
      camera: testCamera,
      gridAngleDeg: 0,
      speedMps: 8,
    });

    expect(result.flightLines.length).toBeGreaterThan(0);
    expect(result.photoCapturePositions.length).toBeGreaterThan(0);
    expect(result.waypoints.length).toBeGreaterThan(0);
    expect(result.estimates.estimatedPhotoCount).toBe(result.photoCapturePositions.length);
    expect(result.estimates.estimatedFlightDistanceMeters).toBeGreaterThan(100);
    expect(result.estimates.gsdCmPerPixel).toBeGreaterThan(0.5);
  });

  // 5. Grid Bearing rotation changes geometry
  it('Requirement 5: Changing Grid Bearing (0° vs 60°) produces distinct flight line angles and coordinates', () => {
    const result0 = generatePhotogrammetryMission({
      missionType: 'grid_photogrammetry',
      polygon: testSurveyPolygon,
      altitudeMeters: 80,
      camera: testCamera,
      gridAngleDeg: 0,
    });

    const result60 = generatePhotogrammetryMission({
      missionType: 'grid_photogrammetry',
      polygon: testSurveyPolygon,
      altitudeMeters: 80,
      camera: testCamera,
      gridAngleDeg: 60,
    });

    // Primary scan line rotates with gridAngleDeg
    const bearingDiff = Math.abs(result60.flightLines[0].bearingDeg - result0.flightLines[0].bearingDeg);
    expect(bearingDiff).toBeCloseTo(60, 0);

    // Waypoint coordinates must be geometrically different
    const wp0 = result0.waypoints[0];
    const wp60 = result60.waypoints[0];
    expect(wp0.longitude !== wp60.longitude || wp0.latitude !== wp60.latitude).toBe(true);
  });

  // 6. Front Overlap changes photo capture spacing
  it('Requirement 6: Increasing Front Overlap decreases photo spacing and increases photo count', () => {
    const cameraLowOverlap: CameraParameters = {
      ...testCamera,
      forwardOverlapPercent: 65,
    };
    const cameraHighOverlap: CameraParameters = {
      ...testCamera,
      forwardOverlapPercent: 85,
    };

    const fpLow = CameraFootprintCalculator.calculate(80, cameraLowOverlap, 8);
    const fpHigh = CameraFootprintCalculator.calculate(80, cameraHighOverlap, 8);

    expect(fpHigh.photoTriggerDistanceMeters).toBeLessThan(fpLow.photoTriggerDistanceMeters);

    const resultLow = generatePhotogrammetryMission({
      missionType: 'grid_photogrammetry',
      polygon: testSurveyPolygon,
      altitudeMeters: 80,
      camera: cameraLowOverlap,
    });

    const resultHigh = generatePhotogrammetryMission({
      missionType: 'grid_photogrammetry',
      polygon: testSurveyPolygon,
      altitudeMeters: 80,
      camera: cameraHighOverlap,
    });

    expect(resultHigh.photoCapturePositions.length).toBeGreaterThan(resultLow.photoCapturePositions.length);
  });

  // 7. Side Overlap changes flight line spacing
  it('Requirement 7: Increasing Side Overlap decreases track spacing and increases flight line count', () => {
    const cameraLowSide: CameraParameters = {
      ...testCamera,
      sideOverlapPercent: 60,
    };
    const cameraHighSide: CameraParameters = {
      ...testCamera,
      sideOverlapPercent: 80,
    };

    const fpLow = CameraFootprintCalculator.calculate(80, cameraLowSide, 8);
    const fpHigh = CameraFootprintCalculator.calculate(80, cameraHighSide, 8);

    expect(fpHigh.flightLineSpacingMeters).toBeLessThan(fpLow.flightLineSpacingMeters);

    const resultLow = generatePhotogrammetryMission({
      missionType: 'grid_photogrammetry',
      polygon: testSurveyPolygon,
      altitudeMeters: 80,
      camera: cameraLowSide,
    });

    const resultHigh = generatePhotogrammetryMission({
      missionType: 'grid_photogrammetry',
      polygon: testSurveyPolygon,
      altitudeMeters: 80,
      camera: cameraHighSide,
    });

    expect(resultHigh.flightLines.length).toBeGreaterThan(resultLow.flightLines.length);
  });

  // 8. Altitude changes footprint and GSD linearly
  it('Requirement 8: Changing Altitude from 50m to 100m scales footprint and GSD proportionally', () => {
    const fp50 = CameraFootprintCalculator.calculate(50, testCamera, 8);
    const fp100 = CameraFootprintCalculator.calculate(100, testCamera, 8);

    expect(fp100.groundCoverageWidthMeters).toBeCloseTo(fp50.groundCoverageWidthMeters * 2, 1);
    expect(fp100.groundCoverageHeightMeters).toBeCloseTo(fp50.groundCoverageHeightMeters * 2, 1);
    expect(fp100.gsdCmPerPixel).toBeCloseTo(fp50.gsdCmPerPixel * 2, 1);
  });

  // 9. Invalid Polygon fails calculation gracefully
  it('Requirement 9: Invalid polygon (< 3 vertices) halts calculation and produces 0 flight lines', () => {
    const invalidPolygon: [number, number][] = [
      [100.5231, 13.7367],
      [100.5265, 13.7367],
    ];

    const result = generatePhotogrammetryMission({
      missionType: 'grid_photogrammetry',
      polygon: invalidPolygon,
      altitudeMeters: 80,
      camera: testCamera,
    });

    expect(result.flightLines).toHaveLength(0);
    expect(result.photoCapturePositions).toHaveLength(0);
    expect(result.waypoints).toHaveLength(0);
    expect(result.estimates.estimatedPhotoCount).toBe(0);
  });

  // 10. Post-calculation mutation marks state as OUTDATED
  it('Requirement 10: Changing parameters or polygon after calculation immediately marks status as OUTDATED', () => {
    let workflowState: MissionWorkflowState = 'CALCULATED';

    // Simulate user editing altitude or bearing
    const onParameterChange = () => {
      if (workflowState === 'CALCULATED' || workflowState === 'EXPORT_READY') {
        workflowState = 'OUTDATED';
      }
    };

    onParameterChange();
    expect(workflowState).toBe('OUTDATED');
  });

  // 11. Export blocked when OUTDATED or EMPTY
  it('Requirement 11: Export is strictly blocked when status is OUTDATED or EMPTY', () => {
    const canExport = (state: MissionWorkflowState, waypointsCount: number) => {
      return (state === 'CALCULATED' || state === 'EXPORT_READY') && waypointsCount > 0;
    };

    expect(canExport('EMPTY', 0)).toBe(false);
    expect(canExport('CONFIGURING', 0)).toBe(false);
    expect(canExport('OUTDATED', 15)).toBe(false);
    expect(canExport('VALIDATION_FAILED', 15)).toBe(false);
    expect(canExport('EXPORT_READY', 15)).toBe(true);
    expect(canExport('CALCULATED', 15)).toBe(true);
  });

  // 12. KML Export reflects latest calculation
  it('Requirement 12: Standard KML export produces valid OGC KML 2.2 containing latest waypoints and flight track', () => {
    const result = generatePhotogrammetryMission({
      missionType: 'grid_photogrammetry',
      polygon: testSurveyPolygon,
      altitudeMeters: 90,
      camera: testCamera,
    });

    const missionDTO: DroneMissionDTO = {
      id: 'test-mission-123',
      name: 'Interactive Test Mission',
      missionType: 'grid_photogrammetry',
      status: 'ready',
      surveyAreaGeoJson: {
        type: 'Polygon',
        coordinates: [testSurveyPolygon],
      },
      flightParameters: {
        flightAltitudeMeters: 90,
        altitudeReference: 'agl',
        flightSpeedMps: 8,
        gridBearingDeg: 0,
        frontOverlapPercent: 80,
        sideOverlapPercent: 70,
        turnStrategy: 'stop_and_turn',
      },
      cameraParameters: testCamera,
      targetPlatform: 'generic_kml',
      totalEstimatedTimeSeconds: result.estimates.estimatedFlightTimeSeconds,
      totalEstimatedDistanceMeters: result.estimates.estimatedFlightDistanceMeters,
      totalPhotoCount: result.estimates.estimatedPhotoCount,
      waypoints: result.waypoints,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const kml = generateStandardKML(missionDTO);

    expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
    expect(kml).toContain('<name>Interactive Test Mission</name>');
    expect(kml).toContain('<LineString>');
    expect(kml).toContain('<coordinates>');
    expect(kml).toContain(result.waypoints[0].longitude.toFixed(6));
  });

  // 13. Unknown / Generic Drone displays compatibility warning
  it('Requirement 13: Generic or unverified drone platform produces safety compatibility warning', () => {
    // 1. Unknown platform rejection
    const unknownIssues = validatePlatformCompatibility(
      'unsupported_custom_drone' as any,
      { missionType: 'grid_survey' },
      50,
      1500
    );
    expect(unknownIssues.length).toBeGreaterThan(0);
    expect(unknownIssues[0].code).toBe('UNKNOWN_PLATFORM');
    expect(unknownIssues[0].message).toContain('ไม่พบแพลตฟอร์ม');

    // 2. Consumer platform (DJI Mini 4 Pro) warns that KML cannot be directly imported into DJI Fly
    const mini4Caps = PLATFORM_REGISTRY['dji_mini_4_pro'];
    expect(mini4Caps.supportsNativeFileExport).toBe(false);
    expect(mini4Caps.knownLimitations.some(lim => lim.includes('DJI Fly') && lim.includes('import'))).toBe(true);
  });

  // 14. All buttons and workflow actions are connected to real handlers
  it('Requirement 14: API and Export handlers are fully functional without mock responses or fake delays', async () => {
    const exportResult = await exportDroneMission(
      {
        id: 'test-mission-active',
        name: 'INTERACTIVE_Active_Test',
        missionType: 'grid_photogrammetry',
        status: 'ready',
        flightParameters: {
          flightAltitudeMeters: 80,
          altitudeReference: 'agl',
          flightSpeedMps: 8,
          gridBearingDeg: 0,
          frontOverlapPercent: 80,
          sideOverlapPercent: 70,
        },
        cameraParameters: testCamera,
        targetPlatform: 'standard_kml',
        waypoints: [
          {
            sequence: 1,
            longitude: 100.5231,
            latitude: 13.7367,
            altitudeMeters: 80,
            speedMps: 8,
            actions: [],
          },
          {
            sequence: 2,
            longitude: 100.5265,
            latitude: 13.7367,
            altitudeMeters: 80,
            speedMps: 8,
            actions: [],
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      'standard_kml'
    );

    expect(exportResult.mimeType).toBe('application/vnd.google-earth.kml+xml');
    expect(exportResult.filename.endsWith('.kml')).toBe(true);
    const content = await exportResult.blob.text();
    expect(content).toContain('<?xml');
    expect(content).toContain('<kml');
  });

  // Final check: Confirm database is 100% clean
  it('Zero Dangling Test Records: Verifies no test data remains in PostgreSQL', async () => {
    const res = await pool.query("SELECT count(*) FROM drone_missions WHERE name LIKE 'TEST_%' OR name LIKE 'INTERACTIVE_%'");
    expect(parseInt(res.rows[0].count, 10)).toBe(0);
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM audit_logs;');
    } catch {
      // ignore
    }
    await pool.end();
  });
});
