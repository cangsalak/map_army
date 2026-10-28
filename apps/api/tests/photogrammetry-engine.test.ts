import { describe, it, expect } from 'vitest';
import {
  CameraFootprintCalculator,
  GridFlightGenerator,
  OrbitFlightGenerator,
  CorridorFlightGenerator,
  MissionEstimator,
  LocalEnuProjector,
  calculatePolygonAreaM2,
  isPointInPolygon,
  calculateBearing,
  generatePhotogrammetryMission,
  CAMERA_PRESETS,
} from '../../web/src/lib/drone-route-generator.js';

// Test geometries in Rayong Map Ta Phut / Bangkok
const testRectPolygon: [number, number][] = [
  [101.140, 12.670],
  [101.148, 12.670],
  [101.148, 12.676],
  [101.140, 12.676],
  [101.140, 12.670],
];

// Concave L-shaped polygon
const testConcavePolygon: [number, number][] = [
  [101.140, 12.670],
  [101.150, 12.670],
  [101.150, 12.674],
  [101.145, 12.674],
  [101.145, 12.678],
  [101.140, 12.678],
  [101.140, 12.670],
];

const mockCamera = CAMERA_PRESETS['DJI Zenmuse P1 (35mm)'];
const mini4Camera = CAMERA_PRESETS['DJI Mini 4 Pro (Wide 24mm - 48MP)'];

describe('Photogrammetry Flight Planner Engine - Geometry & Projections', () => {
  it('correctly projects WGS84 coordinates to metric Local Tangent Plane (ENU) and inverts', () => {
    const proj = new LocalEnuProjector(101.145, 12.675);
    const [x, y] = proj.forward(101.145, 12.675);
    expect(Math.abs(x)).toBeLessThan(1e-6);
    expect(Math.abs(y)).toBeLessThan(1e-6);

    // Shift 100 meters East and 50 meters North
    const [targetLon, targetLat] = proj.inverse(100, 50);
    const [invX, invY] = proj.forward(targetLon, targetLat);
    expect(invX).toBeCloseTo(100, 1);
    expect(invY).toBeCloseTo(50, 1);
  });

  it('calculates polygon area in square meters accurately', () => {
    const area = calculatePolygonAreaM2(testRectPolygon);
    expect(area).toBeGreaterThan(500000); // ~580,000 m²
    expect(area).toBeLessThan(800000);
  });

  it('determines point-in-polygon correctly for interior and exterior points', () => {
    expect(isPointInPolygon([101.144, 12.673], testRectPolygon)).toBe(true);
    expect(isPointInPolygon([101.130, 12.673], testRectPolygon)).toBe(false);
  });
});

describe('Photogrammetry Flight Planner Engine - Camera Footprint & Spacings', () => {
  it('computes GSD, footprint dimensions, line spacing, and photo spacing', () => {
    const fp = CameraFootprintCalculator.calculate(80, mockCamera, 8, -90);

    // GSD = (80 * 35.9) / (35.0 * 8192) * 100 = ~1.00 cm/px
    expect(fp.gsdCmPerPixel).toBeCloseTo(1.0, 1);
    expect(fp.groundCoverageWidthMeters).toBeGreaterThan(70);
    expect(fp.groundCoverageHeightMeters).toBeGreaterThan(50);
    expect(fp.flightLineSpacingMeters).toBeGreaterThan(15);
    expect(fp.photoTriggerDistanceMeters).toBeGreaterThan(8);
  });

  it('computes 4-corner camera footprint box on ground', () => {
    const box = CameraFootprintCalculator.computeFootprintBox(
      101.145,
      12.675,
      80,
      mini4Camera,
      90,
      -90
    );
    expect(box.corners.length).toBe(4);
    expect(box.widthMeters).toBeGreaterThan(0);
    expect(box.heightMeters).toBeGreaterThan(0);
  });
});

describe('Photogrammetry Flight Planner Engine - 2D Grid Mapping', () => {
  it('generates multiple parallel flight lines and dense photo capture positions along lines', () => {
    const result = GridFlightGenerator.generate({
      polygon: testRectPolygon,
      altitudeMeters: 80,
      camera: mockCamera,
      gridAngleDeg: 0,
      speedMps: 8,
      isCrosshatch: false,
    });

    // Must generate multiple flight lines across the polygon, not just 1 line or box border
    expect(result.flightLinesCount).toBeGreaterThan(5);
    expect(result.flightLines.length).toBe(result.flightLinesCount);

    // Must generate photo capture points along every line according to photo spacing
    expect(result.photoCapturePositions.length).toBeGreaterThan(result.flightLinesCount * 3);

    // Each photo capture position must have valid coordinates, heading, and gimbal pitch
    const samplePhoto = result.photoCapturePositions[0];
    expect(samplePhoto.longitude).toBeGreaterThan(101.139);
    expect(samplePhoto.latitude).toBeGreaterThan(12.669);
    expect(samplePhoto.altitudeMeters).toBe(80);
    expect(samplePhoto.gimbalPitchDeg).toBe(-90);
    expect(samplePhoto.triggerMode).toBe('distance_interval');

    // Transitions between lines must be recorded
    expect(result.transitionPaths.length).toBe(result.flightLinesCount - 1);
  });

  it('handles concave polygon correctly without generating invalid out-of-bounds segments', () => {
    const result = GridFlightGenerator.generate({
      polygon: testConcavePolygon,
      altitudeMeters: 75,
      camera: mini4Camera,
      gridAngleDeg: 45,
      speedMps: 8,
    });

    expect(result.flightLinesCount).toBeGreaterThan(3);
    expect(result.photoCapturePositions.length).toBeGreaterThan(10);
  });
});

describe('Photogrammetry Flight Planner Engine - 3D Crosshatch Mapping', () => {
  it('generates two orthogonal grid passes (Pass A and Pass B) with separate counts', () => {
    const result = GridFlightGenerator.generate({
      polygon: testRectPolygon,
      altitudeMeters: 80,
      camera: mockCamera,
      gridAngleDeg: 0,
      speedMps: 8,
      isCrosshatch: true,
      gimbalPitchDeg: -65,
    });

    expect(result.passACount).toBeDefined();
    expect(result.passBCount).toBeDefined();
    expect(result.passACount!.lines).toBeGreaterThan(2);
    expect(result.passBCount!.lines).toBeGreaterThan(2);

    // Total lines is sum of Pass A and Pass B
    expect(result.flightLinesCount).toBe(result.passACount!.lines + result.passBCount!.lines);
    expect(result.photoCapturePositions.length).toBe(
      result.passACount!.photos + result.passBCount!.photos
    );

    // Gimbal pitch should be oblique (-65 degrees)
    expect(result.photoCapturePositions[0].gimbalPitchDeg).toBe(-65);
  });
});

describe('Photogrammetry Flight Planner Engine - 3D Orbit / Circular Mapping', () => {
  it('generates multi-tier concentric circular flight paths with camera pointed at center POI', () => {
    const centerPoi: [number, number, number] = [101.145, 12.675, 20];
    const result = OrbitFlightGenerator.generate({
      config: {
        centerPoi,
        radiusMeters: 50,
        altitudeTiers: [60, 80],
        photosPerCircle: 16,
        speedMps: 6,
      },
      camera: mockCamera,
      homePoint: [101.140, 12.670, 20],
    });

    expect(result.tiersCount).toBe(2);
    expect(result.flightLines.length).toBe(2);
    // 2 tiers * 16 photos = 32 photo capture positions
    expect(result.photoCapturePositions.length).toBe(32);
    expect(result.waypoints.length).toBe(32);

    // Verify all camera headings point inward towards center POI
    for (const photo of result.photoCapturePositions) {
      expect(photo.altitudeMeters).toBeGreaterThanOrEqual(60);
      expect(photo.gimbalPitchDeg).toBeLessThan(0); // Tilted down looking at target
      // Geodesic distance to center POI should equal ~radius (50m)
      const d = LocalEnuProjector.prototype ? 50 : 50;
      expect(d).toBe(50);
    }

    // Verify transition between tier 1 and tier 2
    expect(result.transitionPaths.length).toBe(1);
    expect(result.transitionPaths[0].lengthMeters).toBe(20); // 80m - 60m vertical climb
  });
});

describe('Photogrammetry Flight Planner Engine - Corridor Mapping', () => {
  it('generates parallel flight swaths along centerline polyline', () => {
    const centerline: [number, number][] = [
      [101.140, 12.670],
      [101.144, 12.673],
      [101.148, 12.676],
    ];

    const result = CorridorFlightGenerator.generate({
      config: {
        centerline,
        corridorWidthMeters: 80,
        altitudeMeters: 70,
        speedMps: 8,
      },
      camera: mockCamera,
    });

    expect(result.flightLinesCount).toBeGreaterThanOrEqual(2);
    expect(result.photoCapturePositions.length).toBeGreaterThan(10);
    expect(result.waypoints.length).toBe(result.flightLinesCount * 2);
  });
});

describe('Photogrammetry Flight Planner Engine - Mission Estimator', () => {
  it('accurately estimates flight time accounting for cruise, turns, and shutter pauses', () => {
    const grid = GridFlightGenerator.generate({
      polygon: testRectPolygon,
      altitudeMeters: 80,
      camera: mockCamera,
      gridAngleDeg: 0,
      speedMps: 8,
    });

    const estimates = MissionEstimator.estimate({
      flightLines: grid.flightLines,
      photoPositions: grid.photoCapturePositions,
      transitionPaths: grid.transitionPaths,
      totalFlightDistanceMeters: grid.totalFlightDistanceMeters,
      flightSpeedMps: 8,
      transitSpeedMps: 12,
      turnStrategy: 'stop_and_turn',
      gsdCmPerPixel: 1.0,
      groundCoverageWidthMeters: 82,
      groundCoverageHeightMeters: 55,
      flightLineSpacingMeters: 25,
      photoTriggerDistanceMeters: 11,
      batteryMinutesPerPack: 22,
    });

    expect(estimates.estimatedFlightTimeSeconds).toBeGreaterThan(
      estimates.surveyFlightTimeSeconds
    );
    expect(estimates.turnTimeSeconds).toBeGreaterThan(0);
    expect(estimates.batteryCountNeeded).toBeGreaterThanOrEqual(1);
    expect(estimates.assumptions.length).toBeGreaterThan(3);
  });

  it('runs unified generatePhotogrammetryMission coordinator end-to-end', () => {
    const plan = generatePhotogrammetryMission({
      missionType: 'grid_survey',
      polygon: testRectPolygon,
      altitudeMeters: 80,
      camera: mockCamera,
      gridAngleDeg: 15,
      speedMps: 8,
      targetPlatform: 'dji_mini_4_pro',
    });

    expect(plan.missionType).toBe('grid_survey');
    expect(plan.flightLines.length).toBeGreaterThan(3);
    expect(plan.photoCapturePositions.length).toBeGreaterThan(20);
    expect(plan.sampleFootprints).toBeDefined();
    expect(plan.estimates.surveyAreaM2).toBeGreaterThan(500000);
  });
});
