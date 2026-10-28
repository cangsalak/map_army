import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import JSZip from 'jszip';
import { app } from '../src/app.js';
import { pool } from '../src/db/index.js';
import {
  calculatePhotogrammetryParameters,
  generateGridSurveyWaypoints,
  validateDroneMission,
  CAMERA_PRESETS,
} from '../../web/src/lib/drone-route-generator.js';
import {
  generateDJIWPML,
  generateQGCPlan,
  generateGenericGeoJSON,
  exportDroneMission,
} from '../../web/src/lib/drone-export-adapters.js';
import { DroneMissionDTO } from '@geomonitor/shared';

// Test GeoJSON Polygon in Bangkok / Nonthaburi area
const testPolygon: [number, number][] = [
  [100.5231, 13.7367],
  [100.5265, 13.7367],
  [100.5265, 13.7395],
  [100.5231, 13.7395],
  [100.5231, 13.7367],
];

const mockCamera = {
  name: 'DJI Zenmuse P1 (35mm)',
  sensorWidthMm: 35.9,
  sensorHeightMm: 24.0,
  focalLengthMm: 35.0,
  imageWidthPx: 8192,
  imageHeightPx: 5460,
  forwardOverlapPercent: 80,
  sideOverlapPercent: 70,
};

describe('Drone Mission Planner - Photogrammetry Calculations', () => {
  it('correctly calculates GSD and ground footprint for Zenmuse P1 at 90m AGL', () => {
    const params = calculatePhotogrammetryParameters(mockCamera, 90, 12);
    // GSD = (90 * 35.9 * 100) / (35.0 * 8192) ≈ 1.13 cm/px
    expect(params.gsdCmPerPixel).toBeGreaterThan(1.0);
    expect(params.gsdCmPerPixel).toBeLessThan(1.5);
    expect(params.groundCoverageWidthMeters).toBeGreaterThan(80);
    expect(params.groundCoverageHeightMeters).toBeGreaterThan(50);
    expect(params.flightLineSpacingMeters).toBeGreaterThan(15);
    expect(params.photoTriggerDistanceMeters).toBeGreaterThan(5);
    expect(params.photoIntervalSeconds).toBeGreaterThan(0.5);
  });

  it('correctly scales GSD linearly with altitude', () => {
    const at50m = calculatePhotogrammetryParameters(mockCamera, 50, 10);
    const at100m = calculatePhotogrammetryParameters(mockCamera, 100, 10);
    expect(at100m.gsdCmPerPixel).toBeCloseTo(at50m.gsdCmPerPixel * 2, 1);
  });
});

describe('Drone Mission Planner - Route Generator (Boustrophedon Grid)', () => {
  it('generates valid waypoints inside the polygon boundary', () => {
    const params = calculatePhotogrammetryParameters(mockCamera, 90, 12);
    const result = generateGridSurveyWaypoints({
      polygon: testPolygon,
      flightAltitudeMeters: 90,
      flightSpeedMps: 12,
      lineSpacingMeters: params.flightLineSpacingMeters,
      photoDistanceMeters: params.photoTriggerDistanceMeters,
      gridAngleDeg: 45,
      turnStrategy: 'to_point_and_stop',
      homePoint: [100.5230, 13.7365],
    });

    expect(result.waypoints.length).toBeGreaterThan(4);
    expect(result.totalDistanceMeters).toBeGreaterThan(50);
    expect(result.flightLinesCount).toBeGreaterThan(1);

    // Verify all generated coordinates are within bounding box
    const lats = testPolygon.map((p) => p[1]);
    const lngs = testPolygon.map((p) => p[0]);
    const minLat = Math.min(...lats) - 0.001;
    const maxLat = Math.max(...lats) + 0.001;
    const minLng = Math.min(...lngs) - 0.001;
    const maxLng = Math.max(...lngs) + 0.001;

    for (const wp of result.waypoints) {
      expect(wp.latitude).toBeGreaterThanOrEqual(minLat);
      expect(wp.latitude).toBeLessThanOrEqual(maxLat);
      expect(wp.longitude).toBeGreaterThanOrEqual(minLng);
      expect(wp.longitude).toBeLessThanOrEqual(maxLng);
      expect(wp.altitudeMeters).toBe(90);
    }
  });

  it('rotates flight lines correctly when grid direction is changed', () => {
    const params = calculatePhotogrammetryParameters(mockCamera, 90, 12);
    const grid0 = generateGridSurveyWaypoints({
      polygon: testPolygon,
      flightAltitudeMeters: 90,
      flightSpeedMps: 12,
      lineSpacingMeters: params.flightLineSpacingMeters,
      photoDistanceMeters: params.photoTriggerDistanceMeters,
      gridAngleDeg: 0,
    });

    const grid90 = generateGridSurveyWaypoints({
      polygon: testPolygon,
      flightAltitudeMeters: 90,
      flightSpeedMps: 12,
      lineSpacingMeters: params.flightLineSpacingMeters,
      photoDistanceMeters: params.photoTriggerDistanceMeters,
      gridAngleDeg: 90,
    });

    expect(grid0.waypoints.length).toBeGreaterThan(0);
    expect(grid90.waypoints.length).toBeGreaterThan(0);
    // Waypoints will have different coordinates due to 90-degree orthogonal flight lines
    expect(grid0.waypoints[0].latitude).not.toEqual(grid90.waypoints[0].latitude);
  });
});

describe('Drone Mission Planner - Multi-Axis Validation Engine', () => {
  it('passes validation for standard flight mission', () => {
    const params = calculatePhotogrammetryParameters(mockCamera, 90, 12);
    const route = generateGridSurveyWaypoints({
      polygon: testPolygon,
      flightAltitudeMeters: 90,
      flightSpeedMps: 12,
      lineSpacingMeters: params.flightLineSpacingMeters,
      photoDistanceMeters: params.photoTriggerDistanceMeters,
      gridAngleDeg: 0,
      homePoint: [100.5230, 13.7365],
    });

    const validation = validateDroneMission({
      name: 'ภารกิจสำรวจพื้นที่ทดสอบ',
      waypoints: route.waypoints,
      surveyArea: { coordinates: [testPolygon] },
      homePoint: [100.5230, 13.7365, 90],
      altitudeReference: 'relative_to_home',
      flightAltitudeMeters: 90,
      maxAltitudeMeters: 120,
    });

    expect(validation.status).toBe('PASS');
    expect(validation.issues.filter((i) => i.level === 'error').length).toBe(0);
  });

  it('blocks mission when altitude exceeds 120m regulatory ceiling (CAAT / FAA Limit)', () => {
    const validation = validateDroneMission({
      name: 'ภารกิจเกินเพดานบิน',
      waypoints: [
        { sequence: 1, longitude: 100.5231, latitude: 13.7367, altitudeMeters: 150, speedMps: 10, turnMode: 'to_point_and_stop' }
      ],
      homePoint: [100.5230, 13.7365, 0],
      altitudeReference: 'relative_to_home',
      flightAltitudeMeters: 150,
      maxAltitudeMeters: 120,
    });

    expect(validation.status).toBe('BLOCKED');
    expect(validation.issues.some((i) => i.code === 'ALTITUDE_EXCEEDED')).toBe(true);
  });

  it('blocks mission when home point is missing', () => {
    const validation = validateDroneMission({
      name: 'ภารกิจไร้จุดขึ้นบิน',
      waypoints: [
        { sequence: 1, longitude: 100.5231, latitude: 13.7367, altitudeMeters: 80, speedMps: 10, turnMode: 'to_point_and_stop' }
      ],
      homePoint: undefined,
      altitudeReference: 'relative_to_home',
      flightAltitudeMeters: 80,
      maxAltitudeMeters: 120,
    });

    expect(validation.status).toBe('BLOCKED');
    expect(validation.issues.some((i) => i.code === 'NO_HOME_POINT')).toBe(true);
  });

  it('warns when terrain elevation data is unverified in AGL mode', () => {
    const validation = validateDroneMission({
      name: 'ภารกิจเกาะผิวดิน AGL',
      waypoints: [
        { sequence: 1, longitude: 100.5231, latitude: 13.7367, altitudeMeters: 60, speedMps: 10, turnMode: 'to_point_and_stop' }
      ],
      homePoint: [100.5230, 13.7365, 0],
      altitudeReference: 'agl',
      flightAltitudeMeters: 60,
      maxAltitudeMeters: 120,
    });

    expect(validation.status).toBe('WARNING');
    expect(validation.issues.some((i) => i.code === 'AGL_TERRAIN_CHECK')).toBe(true);
  });
});

describe('Drone Mission Planner - Target Export Adapters', () => {
  const sampleMissionDTO: DroneMissionDTO = {
    id: 'test-mission-001',
    name: 'Survey_Mission_Bangkok',
    droneModel: 'DJI Matrice 350 RTK',
    cameraModel: 'DJI Zenmuse P1 (35mm)',
    missionType: 'grid_survey',
    flightSpeedMps: 12.0,
    flightAltitudeMeters: 90.0,
    altitudeReference: 'relative_to_home',
    maxAltitudeMeters: 120.0,
    returnHomeAltitudeMeters: 100.0,
    finishAction: 'return_to_home',
    homePoint: [100.5230, 13.7365, 90],
    waypoints: [
      { sequence: 1, longitude: 100.5231, latitude: 13.7367, altitudeMeters: 90, speedMps: 12, turnMode: 'to_point_and_stop' },
      { sequence: 2, longitude: 100.5265, latitude: 13.7367, altitudeMeters: 90, speedMps: 12, turnMode: 'to_point_and_stop' },
      { sequence: 3, longitude: 100.5265, latitude: 13.7395, altitudeMeters: 90, speedMps: 12, turnMode: 'to_point_and_stop' },
    ],
    surveyArea: {
      type: 'Polygon',
      coordinates: [testPolygon],
    },
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('generates valid DJI WPML XML with template.kml and waypoint.kml', () => {
    const { templateKml, waypointKml } = generateDJIWPML(sampleMissionDTO);
    expect(templateKml).toContain('wpml:createTime');
    expect(templateKml).toContain('wpml:globalTransitionalSpeed');
    expect(waypointKml).toContain('wpml:executeHeight');
    expect(waypointKml).toContain('wpml:waypointTurnParam');
  });

  it('exports DJI WPML as KMZ ZIP package', async () => {
    const exported = await exportDroneMission(sampleMissionDTO, 'dji_pilot_wpml');
    expect(exported.filename).toContain('.kmz');
    expect(exported.mimeType).toBe('application/vnd.google-earth.kmz');

    // Unpack ZIP to verify structure
    const zip = new JSZip();
    const arrayBuffer = await exported.blob.arrayBuffer();
    const loadedZip = await zip.loadAsync(arrayBuffer);

    expect(loadedZip.file('wpmz/template.kml')).not.toBeNull();
    expect(loadedZip.file('wpmz/waypoint.kml')).not.toBeNull();
  });

  it('generates compliant QGroundControl .plan JSON with MAVLink sequence', () => {
    const planJson = generateQGCPlan(sampleMissionDTO);
    const plan = JSON.parse(planJson);

    expect(plan.fileType).toBe('Plan');
    expect(plan.groundStation).toBe('QGroundControl');
    expect(plan.mission.cruiseSpeed).toBe(12);
    expect(plan.mission.items.length).toBeGreaterThan(2);

    // Command 22 is MAV_CMD_NAV_TAKEOFF
    expect(plan.mission.items[0].command).toBe(22);
    // Command 16 is MAV_CMD_NAV_WAYPOINT
    expect(plan.mission.items[1].command).toBe(16);
    // Last item should be RTL (command 20)
    const lastItem = plan.mission.items[plan.mission.items.length - 1];
    expect(lastItem.command).toBe(20);
  });

  it('generates Generic GeoJSON with vector path and safety warning properties', () => {
    const geojsonStr = generateGenericGeoJSON(sampleMissionDTO);
    const geojson = JSON.parse(geojsonStr);

    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features.length).toBeGreaterThanOrEqual(1);
    expect(geojson.features[0].properties.isFlightControlPlan).toBe(false);
    expect(geojson.features[0].properties.warning).toContain('ไม่ใช่ไฟล์คำสั่งการบิน');
  });

  it('exports Standard OGC KMZ (.kmz) containing valid doc.kml with clamped boundary', async () => {
    const { filename, blob, mimeType } = await exportDroneMission(sampleMissionDTO, 'standard_kmz');
    expect(filename).toContain('.kmz');
    expect(mimeType).toBe('application/vnd.google-earth.kmz');
    expect(blob.size).toBeGreaterThan(0);

    const buffer = Buffer.from(await blob.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const docKml = await zip.file('doc.kml')?.async('string');

    expect(docKml).toBeDefined();
    expect(docKml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
    expect(docKml).toContain('<altitudeMode>clampToGround</altitudeMode>');
    expect(docKml).toContain('<altitudeMode>relativeToGround</altitudeMode>');
    expect(docKml).toContain('Survey Boundary');
    expect(docKml).toContain('Flight Trajectory Overview');
  });

  it('exports Standard OGC KML (.kml) with complete metadata, CRS, and altitude reference', async () => {
    const { filename, blob, mimeType } = await exportDroneMission(sampleMissionDTO, 'standard_kml');
    expect(filename).toContain('.kml');
    expect(mimeType).toBe('application/vnd.google-earth.kml+xml');

    const kmlContent = await blob.text();
    expect(kmlContent).toContain('<name>Survey Boundary</name>');
    expect(kmlContent).toContain('<altitudeMode>clampToGround</altitudeMode>');
    expect(kmlContent).toContain('[Validation Summary]');
    expect(kmlContent).toContain('[Compatibility Warnings]');
  });
});

describe('Drone Mission Planner - API Integration', () => {
  let authToken: string;
  let createdMissionId: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@geomonitor.local', password: 'Password123!' });
    expect(loginRes.status).toBe(200);
    authToken = loginRes.body.data.accessToken;
  });

  it('POST /api/v1/missions creates a new mission with waypoints', async () => {
    const payload = {
      name: 'ภารกิจสำรวจทางอากาศ กรมแผนที่ทหาร กทม.',
      description: 'ทดสอบระบบสร้างและส่งออกไฟล์ภารกิจโดรนอัตโนมัติ',
      droneModel: 'DJI Matrice 350 RTK',
      cameraModel: 'DJI Zenmuse P1 (35mm)',
      missionType: 'grid_survey',
      flightSpeedMs: 12.0,
      targetAltitudeM: 90.0,
      altitudeReference: 'relative_to_home',
      rthAltitudeM: 110.0,
      surveyBoundary: {
        type: 'Polygon',
        coordinates: [testPolygon],
      },
      homePoint: {
        latitude: 13.7365,
        longitude: 100.5230,
        altitudeM: 90.0,
      },
      takeoffPoint: {
        latitude: 13.7366,
        longitude: 100.5231,
        altitudeM: 90.0,
      },
      finishAction: 'go_home',
      photogrammetryConfig: {
        sensorWidthMm: 35.9,
        sensorHeightMm: 24.0,
        focalLengthMm: 35.0,
        imageWidthPx: 8192,
        imageHeightPx: 5460,
        frontOverlapPercent: 80,
        sideOverlapPercent: 70,
      },
      gridConfig: {
        directionDeg: 45,
        marginM: 5,
        overshootM: 10,
        turnMode: 'to_point_and_stop',
      },
      waypoints: [
        { latitude: 13.7367, longitude: 100.5231, altitudeM: 90, speedMs: 12, headingDeg: 45, turnMode: 'to_point_and_stop' },
        { latitude: 13.7395, longitude: 100.5265, altitudeM: 90, speedMs: 12, headingDeg: 45, turnMode: 'to_point_and_stop' },
      ],
      statistics: {
        totalDistanceM: 520,
        estimatedFlightTimeSec: 65,
        estimatedPhotos: 24,
        estimatedBatteries: 1,
        surveyAreaM2: 12500,
      },
      validationResult: { status: 'PASS', issues: [] },
    };

    const res = await request(app)
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    createdMissionId = res.body.data.id;
  });

  it('GET /api/v1/missions lists created missions', async () => {
    const res = await request(app)
      .get('/api/v1/missions')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((m: any) => m.id === createdMissionId);
    expect(found).toBeDefined();
    expect(found.waypointCount).toBe(2);
  });

  it('GET /api/v1/missions/:id retrieves mission with full waypoints', async () => {
    const res = await request(app)
      .get(`/api/v1/missions/${createdMissionId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.waypoints.length).toBe(2);
    expect(res.body.data.droneModel).toBe('DJI Matrice 350 RTK');
  });

  it('PATCH /api/v1/missions/:id updates mission and increments version', async () => {
    const res = await request(app)
      .patch(`/api/v1/missions/${createdMissionId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        targetAltitudeM: 100.0,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBe(2);
  });

  it('POST /api/v1/missions/:id/export records export history audit', async () => {
    const res = await request(app)
      .post(`/api/v1/missions/${createdMissionId}/export`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        exportTarget: 'dji_wpml',
        fileFormat: 'kmz',
        fileName: 'mission_dji.kmz',
        fileSizeBytes: 24500,
        validationSnapshot: { status: 'PASS' },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  it('GET /api/v1/drone/platforms returns all verified platform profiles', async () => {
    const res = await request(app)
      .get('/api/v1/drone/platforms')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);

    const mini4p = res.body.data.find((p: any) => p.platformId === 'dji_mini_4_pro');
    expect(mini4p).toBeDefined();
    expect(mini4p.maxWaypoints).toBe(99);
    expect(mini4p.supportsNativeFileExport).toBe(false);
    expect(mini4p.verificationStatus).toBe('VERIFIED_WITH_LIMITATIONS');
  });

  it('GET /api/v1/drone/platforms/:id/capabilities returns specific platform', async () => {
    const res = await request(app)
      .get('/api/v1/drone/platforms/dji_mini_4_pro/capabilities')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.platformId).toBe('dji_mini_4_pro');
    expect(res.body.data.requiredController).toContain('RC-N2');
  });

  it('POST /api/v1/missions/:id/validate runs platform-specific compatibility checks', async () => {
    const res = await request(app)
      .post(`/api/v1/missions/${createdMissionId}/validate`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ targetPlatform: 'dji_mini_4_pro' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBeDefined();
    expect(Array.isArray(res.body.data.issues)).toBe(true);
  });

  it('POST /api/v1/missions/:id/upload queues mission for Android bridge', async () => {
    const res = await request(app)
      .post(`/api/v1/missions/${createdMissionId}/upload`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ targetPlatform: 'dji_mini_4_pro' });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uploadId).toBeDefined();
    expect(res.body.data.state).toBe('QUEUED_FOR_BRIDGE');
  });

  afterAll(async () => {
    try {
      if (createdMissionId) {
        await pool.query('DELETE FROM drone_missions WHERE id = $1', [createdMissionId]);
      }
      await pool.query("DELETE FROM drone_missions WHERE name LIKE '%กรมแผนที่ทหาร%' OR name LIKE '%Test%'");
      await pool.query('DELETE FROM audit_logs;');
    } catch {
      // Ignore cleanup error if already deleted
    }
    await pool.end();
  });
});

import { DjiMini4ProAdapter, PLATFORM_REGISTRY, validatePlatformCompatibility } from '../../web/src/lib/drone-platform-registry.js';
import { generateArduPilotWaypoints, generateInternalJSON } from '../../web/src/lib/drone-export-adapters.js';

describe('Multi-Platform Drone Mission Planner - Adapter & Safety Tests', () => {
  const adapter = new DjiMini4ProAdapter();

  it('verifies DJI Mini 4 Pro capability limits', () => {
    const caps = adapter.getCapabilities();
    expect(caps.platformId).toBe('dji_mini_4_pro');
    expect(caps.maxWaypoints).toBe(99);
    expect(caps.supportsNativeFileExport).toBe(false);
    expect(caps.supportsLiveUpload).toBe(true);
    expect(caps.verificationStatus).toBe('VERIFIED_WITH_LIMITATIONS');
  });

  it('rejects mission exceeding 99 waypoints for DJI Mini 4 Pro', () => {
    const excessiveWaypoints = Array.from({ length: 105 }, (_, i) => ({
      sequence: i + 1,
      longitude: 101.145,
      latitude: 12.675,
      altitudeMeters: 80,
    }));

    const issues = validatePlatformCompatibility(
      'dji_mini_4_pro',
      { missionType: 'grid_survey', altitudeReference: 'relative_to_home' },
      excessiveWaypoints.length,
      5000
    );

    const waypointLimitError = issues.find((i) => i.code === 'WAYPOINT_LIMIT_EXCEEDED');
    expect(waypointLimitError).toBeDefined();
    expect(waypointLimitError?.level).toBe('error');
  });

  it('generates valid ArduPilot QGC WPL 110 waypoint plain text', () => {
    const mockMission: DroneMissionDTO = {
      id: 'test-mission',
      projectId: 'p1',
      name: 'ArduPilot Test',
      version: '2.0.0',
      targetPlatform: 'ardupilot_mavlink',
      missionType: 'grid_survey',
      droneModel: 'ArduCopter Hexa',
      crs: { horizontalCrs: 'EPSG:4326', verticalDatum: 'EGM96', coordinateUnits: 'degrees' },
      cameraParams: mockCamera,
      altitudeReference: 'relative_to_home',
      flightAltitudeMeters: 75,
      flightSpeedMps: 8,
      maxAltitudeMeters: 120,
      returnToHomeAltitudeMeters: 50,
      homePoint: [101.1415, 12.6725, 80],
      gridAngleDeg: 0,
      turnStrategy: 'stop_and_turn',
      finishAction: 'return_to_home',
      signalLossAction: 'return_to_home',
      waypoints: [
        { sequence: 1, longitude: 101.142, latitude: 12.673, altitudeMeters: 75 },
        { sequence: 2, longitude: 101.143, latitude: 12.674, altitudeMeters: 75 },
      ],
      validationStatus: 'PASS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const content = generateArduPilotWaypoints(mockMission);
    expect(content.startsWith('QGC WPL 110')).toBe(true);
    expect(content).toContain('16'); // MAV_CMD_NAV_WAYPOINT
    expect(content).toContain('22'); // MAV_CMD_NAV_TAKEOFF
    expect(content).toContain('20'); // MAV_CMD_NAV_RETURN_TO_LAUNCH
  });

  it('generates valid Internal Neutral JSON with platform compatibility metadata', () => {
    const mockMission: DroneMissionDTO = {
      id: 'test-mission-json',
      projectId: 'p1',
      name: 'Mini 4 Pro Internal Test',
      version: '2.0.0',
      targetPlatform: 'dji_mini_4_pro',
      missionType: 'grid_survey',
      droneModel: 'DJI Mini 4 Pro',
      crs: { horizontalCrs: 'EPSG:4326', verticalDatum: 'EGM96', coordinateUnits: 'degrees' },
      cameraParams: mockCamera,
      altitudeReference: 'relative_to_home',
      flightAltitudeMeters: 80,
      flightSpeedMps: 8,
      maxAltitudeMeters: 120,
      returnToHomeAltitudeMeters: 60,
      homePoint: [101.1415, 12.6725, 80],
      gridAngleDeg: 45,
      turnStrategy: 'stop_and_turn',
      finishAction: 'return_to_home',
      signalLossAction: 'return_to_home',
      waypoints: [
        { sequence: 1, longitude: 101.142, latitude: 12.673, altitudeMeters: 80 },
      ],
      validationStatus: 'PASS',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const jsonStr = generateInternalJSON(mockMission);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.schemaVersion).toBe('2.0.0');
    expect(parsed.platformCompatibility.targetPlatform).toBe('dji_mini_4_pro');
    expect(parsed.platformCompatibility.bridgeRequired).toBe(true);
  });
});

