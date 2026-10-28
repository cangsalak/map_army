/**
 * GeoMonitor 3D — Core GIS Engine & Spatial Math Utilities
 * 
 * Provides geodesic calculations, WGS84 ellipsoidal distance,
 * spherical polygon area, coordinate parsing, and Thai land area formatting.
 */

// WGS84 Ellipsoid constants
export const WGS84_A = 6378137.0; // semi-major axis (meters)
export const WGS84_B = 6356752.314245; // semi-minor axis (meters)
export const WGS84_F = 1 / 298.257223563; // flattening
export const WGS84_MEAN_RADIUS = 6371008.8; // mean radius (meters)

/**
 * Degrees to radians conversion
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Radians to degrees conversion
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculate Great-Circle / Geodesic surface distance between two WGS84 points in meters
 * Uses the Haversine formula on Earth's mean radius (accurate to within 0.3% globally)
 */
export function calculateGeodesicDistance(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return WGS84_MEAN_RADIUS * c;
}

/**
 * Calculate cumulative path length along an array of [lon, lat] coordinates in meters
 */
export function calculatePathLength(coordinates: [number, number][]): number {
  if (!coordinates || coordinates.length < 2) return 0;
  let totalMeters = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i + 1];
    totalMeters += calculateGeodesicDistance(lon1, lat1, lon2, lat2);
  }
  return totalMeters;
}

/**
 * Calculate Spherical Polygon Area on WGS84 in square meters (m²)
 * Uses the spherical excess formula (Chamberlain-Duquette algorithm)
 * Strictly avoids flat Euclidean degree distortion!
 */
export function calculateSphericalPolygonArea(coordinates: [number, number][]): number {
  if (!coordinates || coordinates.length < 3) return 0;

  // Ensure ring is not self-closed for the loop, or ignore matching last vertex
  const pts = [...coordinates];
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) {
    pts.pop();
  }

  if (pts.length < 3) return 0;

  let totalAngle = 0;
  const n = pts.length;

  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];

    const lambda1 = toRadians(p1[0]);
    const phi1 = toRadians(p1[1]);
    const lambda2 = toRadians(p2[0]);
    const phi2 = toRadians(p2[1]);

    // Spherical trapezoid area component
    totalAngle += (lambda2 - lambda1) * (2 + Math.sin(phi1) + Math.sin(phi2));
  }

  const areaSqm = Math.abs((totalAngle * WGS84_MEAN_RADIUS * WGS84_MEAN_RADIUS) / 2.0);
  return areaSqm;
}

/**
 * Convert metric area to Thai standard units (Rai, Ngan, Tarang Wa) + Hectares
 */
export function formatAreaDetailed(areaSqm: number): {
  sqm: number;
  hectares: number;
  formattedThai: string;
  formattedMetric: string;
} {
  const hectares = areaSqm / 10000;
  const rai = Math.floor(areaSqm / 1600);
  const remainingAfterRai = areaSqm % 1600;
  const ngan = Math.floor(remainingAfterRai / 400);
  const tarangWa = Math.round((remainingAfterRai % 400) / 4);

  let thaiStr = '';
  if (rai > 0) thaiStr += `${rai} ไร่ `;
  if (ngan > 0 || rai > 0) thaiStr += `${ngan} งาน `;
  thaiStr += `${tarangWa} ตร.ว.`;

  return {
    sqm: Math.round(areaSqm),
    hectares: Number(hectares.toFixed(2)),
    formattedThai: thaiStr.trim(),
    formattedMetric: `${Math.round(areaSqm).toLocaleString('th-TH')} ตร.ม. (${hectares.toFixed(2)} เฮกตาร์)`,
  };
}

/**
 * Generate accurate Geodesic Circle coordinates on WGS84 given center and metric radius
 * Eliminates high-latitude flattening distortion caused by naive degree addition.
 */
export function generateGeodesicCircle(
  centerLon: number,
  centerLat: number,
  radiusMeters: number,
  segments: number = 64
): [number, number][] {
  const coords: [number, number][] = [];
  const phi1 = toRadians(centerLat);
  const lambda1 = toRadians(centerLon);
  const angularDist = radiusMeters / WGS84_MEAN_RADIUS;

  for (let i = 0; i <= segments; i++) {
    const bearing = (i / segments) * 2 * Math.PI;

    const phi2 = Math.asin(
      Math.sin(phi1) * Math.cos(angularDist) +
        Math.cos(phi1) * Math.sin(angularDist) * Math.cos(bearing)
    );

    const lambda2 =
      lambda1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDist) * Math.cos(phi1),
        Math.cos(angularDist) - Math.sin(phi1) * Math.sin(phi2)
      );

    coords.push([
      Number(toDegrees(lambda2).toFixed(6)),
      Number(toDegrees(phi2).toFixed(6)),
    ]);
  }

  return coords;
}

/**
 * Parse arbitrary user coordinate strings into [latitude, longitude]
 * Supports:
 * - "12.675, 101.145" (lat, lon)
 * - "101.145, 12.675" (auto-detected if lon > 50 and lat < 30)
 * - "12.675° N, 101.145° E"
 * - "12.675 101.145"
 */
export function parseCoordinateString(
  input: string
): { lat: number; lon: number; isValid: boolean } | null {
  if (!input || typeof input !== 'string') return null;

  const cleaned = input
    .replace(/[°NSEWnsew]/g, ' ')
    .replace(/,/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (cleaned.length < 2) return null;

  const n1 = parseFloat(cleaned[0]);
  const n2 = parseFloat(cleaned[1]);

  if (isNaN(n1) || isNaN(n2)) return null;

  let lat = n1;
  let lon = n2;

  // Thailand heuristics: Lon is typically between 97° and 106°, Lat between 5° and 21°
  if (n1 > 50 && n2 <= 50) {
    lon = n1;
    lat = n2;
  }

  if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    return { lat, lon, isValid: true };
  }

  return null;
}

/**
 * Determine suitable UTM Zone for Thai coordinates
 * Zone 47N: West/Central Thailand (< 102° E)
 * Zone 48N: East/Northeast Thailand (>= 102° E)
 */
export function getThailandUTMZone(longitude: number): {
  epsg: string;
  name: string;
} {
  if (longitude >= 102.0) {
    return { epsg: 'EPSG:32648', name: 'WGS 84 / UTM zone 48N' };
  }
  return { epsg: 'EPSG:32647', name: 'WGS 84 / UTM zone 47N' };
}
