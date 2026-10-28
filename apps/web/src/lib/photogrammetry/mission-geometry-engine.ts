/**
 * Mission Geometry Engine
 *
 * Implements:
 * 1. Metric Local Tangent Plane (ENU) Projection on WGS84 Ellipsoid
 * 2. 2D Planar polygon manipulation, bounding boxes, and rotation
 * 3. Scanline intersection and Boustrophedon (lawn-mower) path sequencing
 * 4. Geodesic distance and bearing calculations
 */

export const WGS84_A = 6378137.0; // semi-major axis (meters)
export const WGS84_F = 1 / 298.257223563; // flattening
export const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F; // eccentricity squared

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Local Tangent Plane (ENU) Projector centered at a reference origin.
 * Converts [lon, lat] in WGS84 degrees to local meters [x (East), y (North)].
 */
export class LocalEnuProjector {
  readonly originLon: number;
  readonly originLat: number;
  private readonly radLat: number;
  private readonly metersPerDegLat: number;
  private readonly metersPerDegLon: number;

  constructor(originLon: number, originLat: number) {
    this.originLon = originLon;
    this.originLat = originLat;
    this.radLat = toRadians(originLat);

    const sinLat = Math.sin(this.radLat);
    const denom = Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
    const radiusN = WGS84_A / denom;
    const radiusM = (WGS84_A * (1 - WGS84_E2)) / (denom * denom * denom);

    this.metersPerDegLat = (Math.PI / 180) * radiusM;
    this.metersPerDegLon = (Math.PI / 180) * radiusN * Math.cos(this.radLat);
  }

  forward(lon: number, lat: number): [number, number] {
    const x = (lon - this.originLon) * this.metersPerDegLon;
    const y = (lat - this.originLat) * this.metersPerDegLat;
    return [x, y];
  }

  inverse(x: number, y: number): [number, number] {
    const lon = this.originLon + x / this.metersPerDegLon;
    const lat = this.originLat + y / this.metersPerDegLat;
    return [Number(lon.toFixed(7)), Number(lat.toFixed(7))];
  }
}

/**
 * Calculate geodesic distance between two points in WGS84 (meters)
 */
export function calculateGeodesicDistance(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return WGS84_A * c;
}

/**
 * Calculate initial bearing from point 1 to point 2 (degrees, 0-360)
 */
export function calculateBearing(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const y = Math.sin(toRadians(lon2 - lon1)) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.cos(toRadians(lon2 - lon1));
  const bearing = (toDegrees(Math.atan2(y, x)) + 360) % 360;
  return Number(bearing.toFixed(1));
}

/**
 * Compute spherical polygon area in square meters
 */
export function calculatePolygonAreaM2(polygon: [number, number][]): number {
  if (!polygon || polygon.length < 3) return 0;
  const ring = [...polygon];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) {
    ring.pop();
  }
  if (ring.length < 3) return 0;

  // Planar shoelace with local ENU projector
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of ring) {
    sumLon += lon;
    sumLat += lat;
  }
  const proj = new LocalEnuProjector(sumLon / ring.length, sumLat / ring.length);
  const pts = ring.map(([lon, lat]) => proj.forward(lon, lat));

  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  return Math.abs(area) / 2.0;
}

/**
 * Point-in-polygon ray-casting test
 */
export function isPointInPolygon(
  point: [number, number],
  polygon: [number, number][],
  tolerance = 1e-6
): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Compute centroid of polygon [lon, lat]
 */
export function getPolygonCentroid(polygon: [number, number][]): [number, number] {
  let sumLon = 0;
  let sumLat = 0;
  let count = 0;
  for (const [lon, lat] of polygon) {
    sumLon += lon;
    sumLat += lat;
    count++;
  }
  return [sumLon / (count || 1), sumLat / (count || 1)];
}
