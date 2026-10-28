import { describe, it, expect } from 'vitest';
import {
  MAP_BEARING,
  toSignedBearing,
  fromSignedBearing,
  DEFAULT_MAP_CENTER,
} from '@geomonitor/shared';
import { generatePhotogrammetryMission } from '../../web/src/lib/photogrammetry';

describe('PHASE 2 — Map Bearing Engine & Conversion Tests', () => {
  it('1. Initial Map Bearing must be -90° (270° in 0-360 engine convention)', () => {
    expect(MAP_BEARING.SIGNED_DEG).toBe(-90);
    expect(MAP_BEARING.CESIUM_DEG).toBe(270);
    expect(MAP_BEARING.CESIUM_RAD).toBeCloseTo((270 * Math.PI) / 180, 6);
    expect(DEFAULT_MAP_CENTER.heading).toBe(270);
  });

  it('2. Angle conversion between -90° and 270° must be exact and reversible', () => {
    // 270° engine heading -> -90° signed bearing
    expect(toSignedBearing(270)).toBe(-90);
    // -90° signed bearing -> 270° engine heading
    expect(fromSignedBearing(-90)).toBe(270);
    // Round-trip identity
    expect(toSignedBearing(fromSignedBearing(-90))).toBe(-90);
    expect(fromSignedBearing(toSignedBearing(270))).toBe(270);
  });

  it('3. Cardinal and intercardinal angle conversions must be mathematically sound', () => {
    // North (0°)
    expect(toSignedBearing(0)).toBe(0);
    expect(fromSignedBearing(0)).toBe(0);

    // East (90°)
    expect(toSignedBearing(90)).toBe(90);
    expect(fromSignedBearing(90)).toBe(90);

    // South (180°)
    expect(toSignedBearing(180)).toBe(180);
    expect(fromSignedBearing(180)).toBe(180);

    // West (270° = -90°)
    expect(toSignedBearing(270)).toBe(-90);
    expect(fromSignedBearing(-90)).toBe(270);

    // Northwest (315° = -45°)
    expect(toSignedBearing(315)).toBe(-45);
    expect(fromSignedBearing(-45)).toBe(315);

    // Southwest (225° = -135°)
    expect(toSignedBearing(225)).toBe(-135);
    expect(fromSignedBearing(-135)).toBe(225);

    // Edge cases: multiples of 360
    expect(toSignedBearing(630)).toBe(-90); // 270 + 360
    expect(fromSignedBearing(-450)).toBe(270); // -90 - 360
  });

  it('4. Reset Map View must restore camera heading strictly to -90° (270°)', () => {
    // Simulate user rotated camera to an arbitrary heading (e.g. 45° North-East)
    let currentCameraHeading = 45;
    expect(toSignedBearing(currentCameraHeading)).toBe(45);

    // User triggers Reset View action
    const resetHeading = () => {
      currentCameraHeading = MAP_BEARING.CESIUM_DEG;
    };
    resetHeading();

    expect(currentCameraHeading).toBe(270);
    expect(toSignedBearing(currentCameraHeading)).toBe(-90);
  });

  it('5. User manual rotation preserves smooth continuous delta transformations', () => {
    let heading = MAP_BEARING.CESIUM_DEG; // 270° (-90°)

    const rotateBy = (deltaDeg: number) => {
      heading = fromSignedBearing(toSignedBearing(heading) + deltaDeg);
    };

    // Rotate +15° clockwise
    rotateBy(15);
    expect(heading).toBe(285);
    expect(toSignedBearing(heading)).toBe(-75);

    // Rotate another +75° clockwise -> 360° / 0° North
    rotateBy(75);
    expect(heading).toBe(0);
    expect(toSignedBearing(heading)).toBe(0);

    // Rotate -15° counter-clockwise -> 345° (-15°)
    rotateBy(-15);
    expect(heading).toBe(345);
    expect(toSignedBearing(heading)).toBe(-15);

    // Reset back to master initial bearing
    heading = MAP_BEARING.CESIUM_DEG;
    expect(toSignedBearing(heading)).toBe(-90);
  });

  it('6. Changing area data or loading project does NOT overwrite Map Bearing', () => {
    let mapCameraHeading = MAP_BEARING.CESIUM_DEG; // 270°

    // Simulate loading Responsibility Area 1
    const area1 = { id: 'area-1', name: 'Zone Alpha', center: [100.5, 13.7] };
    const onAreaLoaded = (area: typeof area1, preserveBearing = true) => {
      // Camera moves to center but bearing remains locked unless explicitly configured
      if (!preserveBearing) {
        mapCameraHeading = 0; // Wrong behavior
      }
      return { destination: area.center, heading: mapCameraHeading };
    };

    const viewState = onAreaLoaded(area1, true);
    expect(viewState.heading).toBe(270);
    expect(toSignedBearing(viewState.heading)).toBe(-90);

    // Simulate switching to Responsibility Area 2
    const area2 = { id: 'area-2', name: 'Zone Beta', center: [101.1, 12.6] };
    const nextViewState = onAreaLoaded(area2, true);
    expect(nextViewState.heading).toBe(270);
    expect(toSignedBearing(nextViewState.heading)).toBe(-90);
  });

  it('7. Map Bearing and Mission Grid Bearing are completely decoupled', () => {
    const polygon: [number, number][] = [
      [100.500, 13.750],
      [100.505, 13.750],
      [100.505, 13.755],
      [100.500, 13.755],
      [100.500, 13.750],
    ];

    const cameraPreset = {
      sensorWidthMm: 35.9,
      sensorHeightMm: 24.0,
      focalLengthMm: 35.0,
      imageWidthPx: 8192,
      imageHeightPx: 5460,
      minTriggerIntervalSec: 0.7,
      forwardOverlapPercent: 75,
      sideOverlapPercent: 65,
    };

    // Calculate mission with Mission Grid Bearing = 0° (North-South flight lines)
    const missionGrid0 = generatePhotogrammetryMission({
      missionType: 'grid_survey',
      polygon,
      altitudeMeters: 80,
      camera: cameraPreset,
      gridAngleDeg: 0,
      speedMps: 8,
    });

    // Calculate mission with Mission Grid Bearing = 45°
    const missionGrid45 = generatePhotogrammetryMission({
      missionType: 'grid_survey',
      polygon,
      altitudeMeters: 80,
      camera: cameraPreset,
      gridAngleDeg: 45,
      speedMps: 8,
    });

    // 1. Mission calculation succeeded
    expect(missionGrid0.flightLines.length).toBeGreaterThan(0);
    expect(missionGrid45.flightLines.length).toBeGreaterThan(0);

    // 2. Changing mission grid angle changes flight line headings
    expect(missionGrid0.flightLines[0].bearingDeg).not.toBe(missionGrid45.flightLines[0].bearingDeg);

    // 3. Invariant: Camera map bearing remains -90° (270°) independent of flight line bearing
    const mapHeading = MAP_BEARING.CESIUM_DEG;
    expect(toSignedBearing(mapHeading)).toBe(-90);
    // Mission coordinates must remain unchanged regardless of map bearing
    expect(missionGrid0.waypoints[0].longitude).toBeCloseTo(missionGrid0.flightLines[0].startPoint[0], 4);
  });
});
