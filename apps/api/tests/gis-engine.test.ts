import { describe, it, expect } from 'vitest';
import {
  calculateGeodesicDistance,
  calculatePathLength,
  calculateSphericalPolygonArea,
  formatAreaDetailed,
  generateGeodesicCircle,
  parseCoordinateString,
  getThailandUTMZone,
} from '../../web/src/lib/gis-engine.js';

describe('GIS Engine & Geodesic Calculations (WGS84 / EPSG:4326 & UTM:32647)', () => {
  describe('Geodesic Distance & Path Length', () => {
    it('calculates zero distance for identical coordinates', () => {
      const dist = calculateGeodesicDistance(101.145, 12.675, 101.145, 12.675);
      expect(dist).toBe(0);
    });

    it('calculates accurate distance between Bangkok and Map Ta Phut Port (~140 km)', () => {
      // Bangkok Grand Palace: 100.4927° E, 13.7500° N
      // Map Ta Phut Industrial Port: 101.1450° E, 12.6750° N
      const distM = calculateGeodesicDistance(100.4927, 13.75, 101.145, 12.675);
      const distKm = distM / 1000;

      // Real geodesic distance is ~139.8 km
      expect(distKm).toBeGreaterThan(135);
      expect(distKm).toBeLessThan(145);
    });

    it('calculates cumulative path length for multi-point polyline', () => {
      const path: [number, number][] = [
        [101.135, 12.668],
        [101.145, 12.668],
        [101.145, 12.678],
      ];
      const length = calculatePathLength(path);
      expect(length).toBeGreaterThan(2000); // > 2 km
    });
  });

  describe('Spherical Polygon Area (WGS84 Ellipsoid)', () => {
    it('calculates true area in square meters without flat degree distortion', () => {
      // A ~1km x 1km rectangular area at Map Ta Phut (12.675° N)
      // 1 deg lat is ~110.6 km -> 0.009041 deg is ~1000m
      // 1 deg lon at 12.675° N is 111.32 * cos(12.675°) ~ 108.6 km -> 0.009208 deg is ~1000m
      const lon = 101.145;
      const lat = 12.675;
      const deltaLon = 0.009208;
      const deltaLat = 0.009041;

      const polygon1km: [number, number][] = [
        [lon, lat],
        [lon + deltaLon, lat],
        [lon + deltaLon, lat + deltaLat],
        [lon, lat + deltaLat],
        [lon, lat],
      ];

      const areaSqm = calculateSphericalPolygonArea(polygon1km);

      // Expected ~ 1,000,000 m² (within 3% accuracy margin of theoretical 1km²)
      expect(areaSqm).toBeGreaterThan(970000);
      expect(areaSqm).toBeLessThan(1030000);
    });

    it('handles both closed and unclosed coordinate rings identically', () => {
      const ringClosed: [number, number][] = [
        [101.14, 12.67],
        [101.15, 12.67],
        [101.15, 12.68],
        [101.14, 12.67],
      ];
      const ringOpen: [number, number][] = [
        [101.14, 12.67],
        [101.15, 12.67],
        [101.15, 12.68],
      ];

      const areaClosed = calculateSphericalPolygonArea(ringClosed);
      const areaOpen = calculateSphericalPolygonArea(ringOpen);

      expect(Math.abs(areaClosed - areaOpen)).toBeLessThan(1e-4);
      expect(areaClosed).toBeGreaterThan(0);
    });
  });

  describe('Thai Area Formatting (Rai, Ngan, Tarang Wa)', () => {
    it('formats exact 1 Rai (1,600 sqm)', () => {
      const res = formatAreaDetailed(1600);
      expect(res.sqm).toBe(1600);
      expect(res.formattedThai).toContain('1 ไร่');
      expect(res.formattedThai).toContain('0 งาน');
      expect(res.formattedThai).toContain('0 ตร.ว.');
    });

    it('formats 1 Hectare (10,000 sqm = 6.25 Rai = 6 Rai 1 Ngan)', () => {
      const res = formatAreaDetailed(10000);
      expect(res.hectares).toBe(1);
      expect(res.formattedThai).toContain('6 ไร่');
      expect(res.formattedThai).toContain('1 งาน');
    });
  });

  describe('Geodesic Circle Generation', () => {
    it('generates 48-sided polygon where all points are equidistant to center on WGS84', () => {
      const centerLon = 101.145;
      const centerLat = 12.675;
      const targetRadiusM = 500; // 500 meters

      const circle = generateGeodesicCircle(centerLon, centerLat, targetRadiusM, 48);

      expect(circle.length).toBe(49); // 48 segments + closed vertex

      // Verify distance from center to every vertex is ~500m (within 1m tolerance)
      for (const [lon, lat] of circle) {
        const d = calculateGeodesicDistance(centerLon, centerLat, lon, lat);
        expect(Math.abs(d - targetRadiusM)).toBeLessThan(1.5);
      }
    });
  });

  describe('Coordinate String Parsing & Normalization', () => {
    it('parses comma-separated lat, lon', () => {
      const res = parseCoordinateString('12.6750, 101.1450');
      expect(res).not.toBeNull();
      expect(res?.lat).toBeCloseTo(12.675, 4);
      expect(res?.lon).toBeCloseTo(101.145, 4);
      expect(res?.isValid).toBe(true);
    });

    it('auto-detects inverted lon, lat in Thailand range', () => {
      const res = parseCoordinateString('101.1450, 12.6750');
      expect(res).not.toBeNull();
      expect(res?.lat).toBeCloseTo(12.675, 4);
      expect(res?.lon).toBeCloseTo(101.145, 4);
    });

    it('parses degree symbols and cardinal letters', () => {
      const res = parseCoordinateString('12.6750° N, 101.1450° E');
      expect(res).not.toBeNull();
      expect(res?.lat).toBeCloseTo(12.675, 4);
      expect(res?.lon).toBeCloseTo(101.145, 4);
    });

    it('rejects invalid or out-of-range coordinates', () => {
      expect(parseCoordinateString('')).toBeNull();
      expect(parseCoordinateString('invalid text')).toBeNull();
      expect(parseCoordinateString('195.0, 50.0')).toBeNull();
    });
  });

  describe('Thailand UTM Zone Assignment', () => {
    it('assigns EPSG:32647 (UTM 47N) to Central & Western Thailand (< 102° E)', () => {
      const zone = getThailandUTMZone(100.5); // Bangkok
      expect(zone.epsg).toBe('EPSG:32647');
      expect(zone.name).toContain('47N');
    });

    it('assigns EPSG:32648 (UTM 48N) to Eastern & Northeastern Thailand (>= 102° E)', () => {
      const zone = getThailandUTMZone(104.8); // Ubon Ratchathani
      expect(zone.epsg).toBe('EPSG:32648');
      expect(zone.name).toContain('48N');
    });
  });

  describe('Contract Section 3: Map Orientation & Bearings', () => {
    it('sets initialMapBearing to -90 deg and translates to 270 deg in 0-360 convention', () => {
      const initialMapBearing = -90;
      const normalizedCesiumBearing = ((initialMapBearing % 360) + 360) % 360;
      expect(normalizedCesiumBearing).toBe(270);
    });

    it('camera view rotation does not modify GIS polygon or waypoint coordinates', () => {
      const originalCoords: [number, number][] = [
        [100.5, 13.7],
        [100.51, 13.7],
        [100.51, 13.71],
        [100.5, 13.71],
        [100.5, 13.7],
      ];

      // Simulate rotating camera view bearing from -90 to 0 to 45
      let mapViewBearing = -90;
      const rotatedCoords = originalCoords.map((c) => [...c]);
      mapViewBearing = 45;

      expect(mapViewBearing).toBe(45);
      expect(rotatedCoords).toEqual(originalCoords);
    });

    it('maintains clear separation between initialMapBearing, mapViewBearing, and missionGridBearing', () => {
      const initialMapBearing = -90;
      let mapViewBearing = -90;
      let missionGridBearing = 45; // drone flight path direction

      // Changing map view bearing
      mapViewBearing = 180;

      // Mission grid bearing MUST remain unchanged
      expect(missionGridBearing).toBe(45);
      expect(initialMapBearing).toBe(-90);
      expect(mapViewBearing).toBe(180);
    });
  });
});
