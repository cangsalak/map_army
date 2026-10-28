/**
 * GeoMonitor 3D — Shared Camera Controller & 2D-First Geospatial Initializer
 *
 * Implements deterministic 2D top-down nadir camera view calculation,
 * bounding box fitting, zoom altitude derivation, and camera state validation
 * conforming to Master Specification: Shared Map 2D-First & Ground-Level Initialization.
 */

import { MAP_BEARING, DEFAULT_MAP_CENTER, THAILAND_BBOX } from '../constants/spatial.js';

export interface CameraBoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  centerLon: number;
  centerLat: number;
  widthMeters: number;
  heightMeters: number;
}

export interface CameraTargetView {
  longitude: number;
  latitude: number;
  height: number;
  heading: number; // degrees (0-360, default 270 / -90°)
  pitch: number;   // degrees (-90 to 0, default -90 for 2D nadir)
  roll: number;
  sceneMode: '2D' | '3D';
  source: 'selected_area' | 'drone_polygon' | 'first_area' | 'default_config';
}

export interface CameraState {
  longitude: number;
  latitude: number;
  height: number;
  heading: number;
  pitch: number;
  sceneMode: '2D' | '3D';
}

/**
 * Approximate WGS84 geodesic distance in meters between two lat/lon points
 */
export function approximateGeodesicDistance(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const R = 6378137.0; // WGS84 Earth equatorial radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const lat1Rad = (lat1 * Math.PI) / 180.0;
  const lat2Rad = (lat2 * Math.PI) / 180.0;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes bounding box and center coordinate from a list of [lon, lat] points
 */
export function computeBoundingBox(coords: [number, number][]): CameraBoundingBox | null {
  if (!coords || coords.length === 0) return null;

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const pt of coords) {
    if (!pt || pt.length < 2) continue;
    const [lon, lat] = pt;
    if (typeof lon !== 'number' || typeof lat !== 'number' || isNaN(lon) || isNaN(lat)) continue;

    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  if (minLon === Infinity || maxLon === -Infinity) return null;

  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;

  const widthMeters = approximateGeodesicDistance(minLon, centerLat, maxLon, centerLat);
  const heightMeters = approximateGeodesicDistance(centerLon, minLat, centerLon, maxLat);

  return {
    minLon,
    minLat,
    maxLon,
    maxLat,
    centerLon,
    centerLat,
    widthMeters,
    heightMeters,
  };
}

/**
 * Calculates top-down camera height (in meters) to fit the bounding box in the viewport
 */
export function calculate2DGroundAltitude(
  bbox: CameraBoundingBox,
  options?: {
    padding?: number;
    minHeight?: number;
    maxHeight?: number;
    viewportAspect?: number;
  }
): number {
  const padding = options?.padding ?? 1.35;
  const minHeight = options?.minHeight ?? 400;
  const maxHeight = options?.maxHeight ?? 150000;
  const aspect = options?.viewportAspect ?? 1.6; // default landscape ~16:10

  // Effective visible dimension in vertical FOV (approx 60 deg)
  const maxDim = Math.max(bbox.heightMeters, bbox.widthMeters / aspect);
  const calculatedHeight = maxDim * padding;

  return Math.min(Math.max(calculatedHeight, minHeight), maxHeight);
}

/**
 * Determines initial 2D camera target strictly following Phase 3 priority:
 * 1. Selected area coordinates (if provided)
 * 2. Drone survey polygon (if provided with >= 3 points)
 * 3. First existing responsibility area in project
 * 4. Fallback to system default configuration extent
 */
export function getInitial2DCameraTarget(params: {
  selectedAreaCoords?: [number, number][];
  polygonCoords?: [number, number][];
  areas?: { coordinates?: [number, number][] | number[][][] | any; [key: string]: any }[];
  defaultCenter?: { longitude: number; latitude: number; height: number };
}): CameraTargetView {
  // 1. Drone Survey Polygon (if drawn or loaded)
  if (params.polygonCoords && params.polygonCoords.length >= 3) {
    const bbox = computeBoundingBox(params.polygonCoords);
    if (bbox) {
      const height = calculate2DGroundAltitude(bbox);
      return {
        longitude: bbox.centerLon,
        latitude: bbox.centerLat,
        height,
        heading: MAP_BEARING.CESIUM_DEG,
        pitch: -90,
        roll: 0,
        sceneMode: '2D',
        source: 'drone_polygon',
      };
    }
  }

  // 2. Selected Area Coordinates
  if (params.selectedAreaCoords && params.selectedAreaCoords.length >= 3) {
    const bbox = computeBoundingBox(params.selectedAreaCoords);
    if (bbox) {
      const height = calculate2DGroundAltitude(bbox);
      return {
        longitude: bbox.centerLon,
        latitude: bbox.centerLat,
        height,
        heading: MAP_BEARING.CESIUM_DEG,
        pitch: -90,
        roll: 0,
        sceneMode: '2D',
        source: 'selected_area',
      };
    }
  }

  // 3. First Area in Project Area List
  if (params.areas && params.areas.length > 0) {
    for (const a of params.areas) {
      let coords: [number, number][] | null = null;
      if (Array.isArray(a.coordinates)) {
        if (Array.isArray(a.coordinates[0]) && typeof a.coordinates[0][0] === 'number') {
          coords = a.coordinates as [number, number][];
        } else if (Array.isArray(a.coordinates[0]) && Array.isArray(a.coordinates[0][0])) {
          coords = a.coordinates[0] as [number, number][];
        }
      }
      if (coords && coords.length >= 3) {
        const bbox = computeBoundingBox(coords);
        if (bbox) {
          const height = calculate2DGroundAltitude(bbox);
          return {
            longitude: bbox.centerLon,
            latitude: bbox.centerLat,
            height,
            heading: MAP_BEARING.CESIUM_DEG,
            pitch: -90,
            roll: 0,
            sceneMode: '2D',
            source: 'first_area',
          };
        }
      }
    }
  }

  // 4. Default Extent from System Configuration (Bangkok Strategic Monitoring Center)
  const def = params.defaultCenter || DEFAULT_MAP_CENTER;
  return {
    longitude: def.longitude,
    latitude: def.latitude,
    height: Math.max(def.height, 8000), // Ground-level overview height
    heading: MAP_BEARING.CESIUM_DEG,
    pitch: -90, // Strictly top-down nadir for 2D mode
    roll: 0,
    sceneMode: '2D',
    source: 'default_config',
  };
}

/**
 * Validates a saved or restored camera state.
 * Returns true only if coordinates, height, heading, pitch, and sceneMode are within valid ranges.
 * Rejecting invalid states prevents automatic restoration from causing wild camera flyaway.
 */
export function validateCameraState(state: any): state is CameraState {
  if (!state || typeof state !== 'object') return false;

  const { longitude, latitude, height, heading, pitch, sceneMode } = state;

  if (typeof longitude !== 'number' || isNaN(longitude) || longitude < -180 || longitude > 180) {
    return false;
  }
  if (typeof latitude !== 'number' || isNaN(latitude) || latitude < -90 || latitude > 90) {
    return false;
  }
  if (typeof height !== 'number' || isNaN(height) || height < 10 || height > 5000000) {
    return false;
  }
  if (typeof heading !== 'number' || isNaN(heading)) {
    return false;
  }
  if (typeof pitch !== 'number' || isNaN(pitch) || pitch < -90.5 || pitch > 0.5) {
    return false;
  }
  if (sceneMode !== '2D' && sceneMode !== '3D') {
    return false;
  }

  return true;
}

/**
 * Checks whether coordinates lie within Thailand territorial bounds or specified bbox
 */
export function isWithinTerritory(
  lon: number,
  lat: number,
  bbox = THAILAND_BBOX
): boolean {
  return (
    lon >= bbox.minLon &&
    lon <= bbox.maxLon &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat
  );
}

