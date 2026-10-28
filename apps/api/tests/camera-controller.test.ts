import { describe, it, expect } from 'vitest';
import {
  computeBoundingBox,
  calculate2DGroundAltitude,
  getInitial2DCameraTarget,
  validateCameraState,
  approximateGeodesicDistance,
  isWithinTerritory,
  MAP_BEARING,
  DEFAULT_MAP_CENTER,
  THAILAND_BBOX,
} from '@geomonitor/shared';

describe('GeoMonitor 3D — Camera Controller & 2D-First Initialization Tests', () => {
  // Test Area Coordinates (Rayong MTP Phase 3)
  const mtpCoordinates: [number, number][] = [
    [101.135, 12.668],
    [101.155, 12.668],
    [101.155, 12.682],
    [101.135, 12.682],
    [101.135, 12.668],
  ];

  it('1. Computes bounding box and center coordinate accurately', () => {
    const bbox = computeBoundingBox(mtpCoordinates);
    expect(bbox).not.toBeNull();
    if (!bbox) return;

    expect(bbox.minLon).toBeCloseTo(101.135, 3);
    expect(bbox.maxLon).toBeCloseTo(101.155, 3);
    expect(bbox.minLat).toBeCloseTo(12.668, 3);
    expect(bbox.maxLat).toBeCloseTo(12.682, 3);
    expect(bbox.centerLon).toBeCloseTo(101.145, 3);
    expect(bbox.centerLat).toBeCloseTo(12.675, 3);

    // Bounding box span
    expect(bbox.widthMeters).toBeGreaterThan(2000);
    expect(bbox.widthMeters).toBeLessThan(2300);
    expect(bbox.heightMeters).toBeGreaterThan(1400);
    expect(bbox.heightMeters).toBeLessThan(1700);
  });

  it('2. Calculates 2D ground altitude with proper viewport padding', () => {
    const bbox = computeBoundingBox(mtpCoordinates);
    expect(bbox).not.toBeNull();
    if (!bbox) return;

    const altitude = calculate2DGroundAltitude(bbox);
    // For a ~2.1km x 1.5km site, height should be around 1,800m - 2,500m
    expect(altitude).toBeGreaterThan(1500);
    expect(altitude).toBeLessThan(3500);
  });

  it('3. Initial camera target prioritizes Drone Survey Polygon when available', () => {
    const dronePolygon: [number, number][] = [
      [100.824, 12.684],
      [100.827, 12.684],
      [100.827, 12.681],
      [100.824, 12.681],
      [100.824, 12.684],
    ];

    const target = getInitial2DCameraTarget({
      polygonCoords: dronePolygon,
      selectedAreaCoords: mtpCoordinates,
      areas: [{ id: 'a1', coordinates: mtpCoordinates }],
    });

    expect(target.source).toBe('drone_polygon');
    expect(target.sceneMode).toBe('2D');
    expect(target.pitch).toBe(-90); // Strictly top-down nadir
    expect(target.heading).toBe(MAP_BEARING.CESIUM_DEG); // 270° (-90°)
    expect(target.longitude).toBeCloseTo(100.8255, 3);
    expect(target.latitude).toBeCloseTo(12.6825, 3);
  });

  it('4. Initial camera target uses Selected Area when polygon is absent', () => {
    const target = getInitial2DCameraTarget({
      polygonCoords: [],
      selectedAreaCoords: mtpCoordinates,
      areas: [{ id: 'a1', coordinates: mtpCoordinates }],
    });

    expect(target.source).toBe('selected_area');
    expect(target.sceneMode).toBe('2D');
    expect(target.pitch).toBe(-90);
    expect(target.heading).toBe(MAP_BEARING.CESIUM_DEG);
    expect(target.longitude).toBeCloseTo(101.145, 3);
    expect(target.latitude).toBeCloseTo(12.675, 3);
  });

  it('5. Initial camera target falls back to First Area when no area is explicitly selected', () => {
    const target = getInitial2DCameraTarget({
      polygonCoords: [],
      selectedAreaCoords: [],
      areas: [{ id: 'a1', coordinates: mtpCoordinates }],
    });

    expect(target.source).toBe('first_area');
    expect(target.sceneMode).toBe('2D');
    expect(target.pitch).toBe(-90);
    expect(target.heading).toBe(MAP_BEARING.CESIUM_DEG);
    expect(target.longitude).toBeCloseTo(101.145, 3);
    expect(target.latitude).toBeCloseTo(12.675, 3);
  });

  it('6. Initial camera target uses Default Extent when no areas exist in database', () => {
    const target = getInitial2DCameraTarget({
      polygonCoords: [],
      selectedAreaCoords: [],
      areas: [],
    });

    expect(target.source).toBe('default_config');
    expect(target.sceneMode).toBe('2D');
    expect(target.pitch).toBe(-90); // Nadir top-down
    expect(target.heading).toBe(MAP_BEARING.CESIUM_DEG);
    expect(target.longitude).toBeCloseTo(DEFAULT_MAP_CENTER.longitude, 4);
    expect(target.latitude).toBeCloseTo(DEFAULT_MAP_CENTER.latitude, 4);
    expect(target.height).toBeGreaterThanOrEqual(8000);
  });

  it('7. Validates camera state and rejects corrupted or out-of-bounds states', () => {
    // Valid state
    expect(
      validateCameraState({
        longitude: 101.145,
        latitude: 12.675,
        height: 2000,
        heading: 270,
        pitch: -90,
        sceneMode: '2D',
      })
    ).toBe(true);

    // Invalid: NaN longitude
    expect(
      validateCameraState({
        longitude: NaN,
        latitude: 12.675,
        height: 2000,
        heading: 270,
        pitch: -90,
        sceneMode: '2D',
      })
    ).toBe(false);

    // Invalid: out-of-bounds latitude
    expect(
      validateCameraState({
        longitude: 101.145,
        latitude: 95.0,
        height: 2000,
        heading: 270,
        pitch: -90,
        sceneMode: '2D',
      })
    ).toBe(false);

    // Invalid: negative height
    expect(
      validateCameraState({
        longitude: 101.145,
        latitude: 12.675,
        height: -500,
        heading: 270,
        pitch: -90,
        sceneMode: '2D',
      })
    ).toBe(false);

    // Invalid: invalid sceneMode string
    expect(
      validateCameraState({
        longitude: 101.145,
        latitude: 12.675,
        height: 2000,
        heading: 270,
        pitch: -90,
        sceneMode: 'INVALID_MODE',
      })
    ).toBe(false);

    // Invalid: null or non-object
    expect(validateCameraState(null)).toBe(false);
    expect(validateCameraState('camera')).toBe(false);
  });

  it('8. Territory boundary check verifies coordinates within Thailand', () => {
    // Bangkok
    expect(isWithinTerritory(100.5018, 13.7563)).toBe(true);
    // Rayong MTP
    expect(isWithinTerritory(101.145, 12.675)).toBe(true);
    // Chiang Mai
    expect(isWithinTerritory(98.9853, 18.7883)).toBe(true);
    // Outside Thailand (London)
    expect(isWithinTerritory(-0.1276, 51.5074)).toBe(false);
    // Outside Thailand (Tokyo)
    expect(isWithinTerritory(139.6917, 35.6895)).toBe(false);
  });
});

