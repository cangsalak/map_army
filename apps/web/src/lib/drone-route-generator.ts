/**
 * Drone Mission Route Generator & Photogrammetry Calculations
 *
 * Implements:
 * 1. GSD (Ground Sampling Distance) & Camera Field of View
 * 2. Photogrammetry Line Spacing & Shutter Trigger Intervals
 * 3. Boustrophedon Grid Transect Survey Generator
 * 4. Corridor Mapping Generator
 * 5. Mission Validation Engine (PASS, WARNING, BLOCKED)
 */

import {
  calculateGeodesicDistance,
  toRadians,
  toDegrees,
} from './gis-engine';
import { calculateBearing } from './photogrammetry/mission-geometry-engine';
import {
  FlightLineSegment,
  PhotoCapturePosition,
  TransitionPath,
} from './photogrammetry/types';
import {
  CameraParameters,
  PhotogrammetryEstimates,
  DroneWaypointDTO,
  ValidationIssue,
  ValidationStatus,
  AltitudeReference,
  TurnStrategy,
} from '@geomonitor/shared';

export * from './photogrammetry';

export const CAMERA_PRESETS: Record<string, CameraParameters> = {
  'DJI Mini 4 Pro (Wide 24mm - 48MP)': {
    name: 'DJI Mini 4 Pro (Wide 24mm - 48MP)',
    sensorWidthMm: 9.6,
    sensorHeightMm: 7.2,
    focalLengthMm: 6.72,
    imageWidthPx: 8064,
    imageHeightPx: 6048,
    forwardOverlapPercent: 80,
    sideOverlapPercent: 70,
  },
  'DJI Mini 4 Pro (Wide 24mm - 12MP)': {
    name: 'DJI Mini 4 Pro (Wide 24mm - 12MP)',
    sensorWidthMm: 9.6,
    sensorHeightMm: 7.2,
    focalLengthMm: 6.72,
    imageWidthPx: 4032,
    imageHeightPx: 3024,
    forwardOverlapPercent: 80,
    sideOverlapPercent: 70,
  },
  'DJI Zenmuse P1 (35mm)': {
    name: 'DJI Zenmuse P1 (35mm)',
    sensorWidthMm: 35.9,
    sensorHeightMm: 24.0,
    focalLengthMm: 35.0,
    imageWidthPx: 8192,
    imageHeightPx: 5460,
    forwardOverlapPercent: 80,
    sideOverlapPercent: 70,
  },
  'DJI Mavic 3 Enterprise (Wide)': {
    name: 'DJI Mavic 3 Enterprise (Wide)',
    sensorWidthMm: 17.3,
    sensorHeightMm: 13.0,
    focalLengthMm: 12.2, // 24mm equivalent, actual 12.2mm
    imageWidthPx: 5280,
    imageHeightPx: 3956,
    forwardOverlapPercent: 80,
    sideOverlapPercent: 70,
  },
  'DJI Phantom 4 RTK (24mm)': {
    name: 'DJI Phantom 4 RTK (24mm)',
    sensorWidthMm: 13.2,
    sensorHeightMm: 8.8,
    focalLengthMm: 8.8,
    imageWidthPx: 5472,
    imageHeightPx: 3648,
    forwardOverlapPercent: 75,
    sideOverlapPercent: 65,
  },
  'Sony A7R IV (35mm)': {
    name: 'Sony A7R IV (35mm)',
    sensorWidthMm: 35.7,
    sensorHeightMm: 23.8,
    focalLengthMm: 35.0,
    imageWidthPx: 9504,
    imageHeightPx: 6336,
    forwardOverlapPercent: 80,
    sideOverlapPercent: 70,
  },
};

/**
 * 1. Compute Photogrammetry Parameters (GSD, Line Spacing, Photo Spacing)
 */
export function calculatePhotogrammetryParameters(
  camera: CameraParameters,
  altitudeMeters: number,
  flightSpeedMps = 8
) {
  return calculatePhotogrammetry(altitudeMeters, camera, flightSpeedMps);
}

export function calculatePhotogrammetry(
  altitudeMeters: number,
  camera: CameraParameters,
  flightSpeedMps = 8,
  batteryMinutes = 25
): {
  gsdCmPerPixel: number;
  groundCoverageWidthMeters: number;
  groundCoverageHeightMeters: number;
  flightLineSpacingMeters: number;
  photoTriggerDistanceMeters: number;
  photoIntervalSeconds: number;
} {
  // GSD = (H * Sw) / (F * Iw) * 100
  const gsdCmPerPixel =
    ((altitudeMeters * camera.sensorWidthMm) /
      (camera.focalLengthMm * camera.imageWidthPx)) *
    100;

  // Ground footprint width = (H * Sw) / F
  const groundCoverageWidthMeters = (altitudeMeters * camera.sensorWidthMm) / camera.focalLengthMm;
  // Ground footprint height = (H * Sh) / F
  const groundCoverageHeightMeters = (altitudeMeters * camera.sensorHeightMm) / camera.focalLengthMm;

  // Line spacing based on side overlap
  const sideOverlapFrac = Math.min(Math.max(camera.sideOverlapPercent / 100, 0.1), 0.95);
  const flightLineSpacingMeters = Math.max(
    groundCoverageWidthMeters * (1 - sideOverlapFrac),
    5.0
  );

  // Photo trigger distance based on forward overlap
  const forwardOverlapFrac = Math.min(Math.max(camera.forwardOverlapPercent / 100, 0.1), 0.95);
  const photoTriggerDistanceMeters = Math.max(
    groundCoverageHeightMeters * (1 - forwardOverlapFrac),
    3.0
  );

  const photoIntervalSeconds = photoTriggerDistanceMeters / Math.max(flightSpeedMps, 1.0);

  return {
    gsdCmPerPixel: Number(gsdCmPerPixel.toFixed(2)),
    groundCoverageWidthMeters: Number(groundCoverageWidthMeters.toFixed(1)),
    groundCoverageHeightMeters: Number(groundCoverageHeightMeters.toFixed(1)),
    flightLineSpacingMeters: Number(flightLineSpacingMeters.toFixed(1)),
    photoTriggerDistanceMeters: Number(photoTriggerDistanceMeters.toFixed(1)),
    photoIntervalSeconds: Number(photoIntervalSeconds.toFixed(1)),
  };
}

/**
 * Helper: Find polygon bounding box in degrees [minLon, minLat, maxLon, maxLat]
 */
export function getPolygonBoundingBox(polygon: [number, number][]): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of polygon) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

function pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Helper: Ray-casting Point-in-Polygon check with boundary tolerance
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][], tolerance = 1e-5): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    if (pointToSegmentDistance(x, y, xi, yi, xj, yj) <= tolerance) {
      return true;
    }

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 2. Generate Boustrophedon Grid Survey Flight Lines
 */
export function generateGridSurveyWaypoints(options: {
  polygon: [number, number][]; // WGS84 [lon, lat]
  altitudeMeters: number;
  flightLineSpacingMeters: number;
  gridAngleDeg?: number;
  speedMps?: number;
  turnStrategy?: TurnStrategy;
  homePoint?: [number, number, number];
}): {
  waypoints: DroneWaypointDTO[];
  totalDistanceMeters: number;
  flightLinesCount: number;
  flightLines?: FlightLineSegment[];
  photoPositions?: PhotoCapturePosition[];
  transitionPaths?: TransitionPath[];
} {
  const {
    polygon,
    gridAngleDeg = 0,
    turnStrategy = 'stop_and_turn',
    homePoint,
  } = options;

  const altitudeMeters = options.altitudeMeters ?? (options as any).flightAltitudeMeters ?? 80;
  const flightLineSpacingMeters = options.flightLineSpacingMeters ?? (options as any).lineSpacingMeters ?? 25;
  const speedMps = options.speedMps ?? (options as any).flightSpeedMps ?? 8;

  if (!polygon || polygon.length < 3) {
    return {
      waypoints: [],
      totalDistanceMeters: 0,
      flightLinesCount: 0,
      flightLines: [],
      photoPositions: [],
      transitionPaths: [],
    };
  }

  // Remove duplicate end vertex if present
  const ring = [...polygon];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) {
    ring.pop();
  }

  // Center of polygon to use as origin for planar rotation
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of ring) {
    sumLon += lon;
    sumLat += lat;
  }
  const centerLon = sumLon / ring.length;
  const centerLat = sumLat / ring.length;

  // Meters per degree approximation at center
  const metersPerDegLat = 111132.954;
  const metersPerDegLon = 111412.84 * Math.cos(toRadians(centerLat));

  const rad = toRadians(-gridAngleDeg);
  const cosRad = Math.cos(rad);
  const sinRad = Math.sin(rad);

  // Transform ring to local Cartesian meters, then rotate
  const rotatedPoints: [number, number][] = ring.map(([lon, lat]) => {
    const x = (lon - centerLon) * metersPerDegLon;
    const y = (lat - centerLat) * metersPerDegLat;
    const rx = x * cosRad - y * sinRad;
    const ry = x * sinRad + y * cosRad;
    return [rx, ry];
  });

  // Find bounding box in rotated meter coordinate system
  let minRx = Infinity;
  let minRy = Infinity;
  let maxRx = -Infinity;
  let maxRy = -Infinity;
  for (const [rx, ry] of rotatedPoints) {
    if (rx < minRx) minRx = rx;
    if (ry < minRy) minRy = ry;
    if (rx > maxRx) maxRx = rx;
    if (ry > maxRy) maxRy = ry;
  }

  const spacing = Math.max(flightLineSpacingMeters, 5.0);
  const rawFlightLines: [number, number][][] = [];

  // Generate sweep scanlines from minRy to maxRy
  for (let y = minRy + spacing / 2; y <= maxRy; y += spacing) {
    // Intersect horizontal line y = const with rotated polygon edges
    const intersections: number[] = [];
    for (let i = 0; i < rotatedPoints.length; i++) {
      const p1 = rotatedPoints[i];
      const p2 = rotatedPoints[(i + 1) % rotatedPoints.length];

      if ((p1[1] <= y && p2[1] > y) || (p2[1] <= y && p1[1] > y)) {
        const t = (y - p1[1]) / (p2[1] - p1[1]);
        const x = p1[0] + t * (p2[0] - p1[0]);
        intersections.push(x);
      }
    }

    intersections.sort((a, b) => a - b);

    // Pair intersections into valid interior segments
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const xStart = intersections[i];
      const xEnd = intersections[i + 1];
      if (xEnd - xStart > 2.0) {
        rawFlightLines.push([
          [xStart, y],
          [xEnd, y],
        ]);
      }
    }
  }

  if (rawFlightLines.length === 0) {
    return {
      waypoints: [],
      totalDistanceMeters: 0,
      flightLinesCount: 0,
      flightLines: [],
      photoPositions: [],
      transitionPaths: [],
    };
  }

  // Inverse rotation back to WGS84 helper
  const invRad = toRadians(gridAngleDeg);
  const invCos = Math.cos(invRad);
  const invSin = Math.sin(invRad);

  const toWgs84Point = (rx: number, ry: number): [number, number] => {
    const x = rx * invCos - ry * invSin;
    const y = rx * invSin + ry * invCos;
    const lon = Number((centerLon + x / metersPerDegLon).toFixed(7));
    const lat = Number((centerLat + y / metersPerDegLat).toFixed(7));
    return [lon, lat];
  };

  const photoSpacing =
    (options as any).photoDistanceMeters ||
    (options as any).photoTriggerDistanceMeters ||
    Math.max(15, flightLineSpacingMeters * 0.7);

  const flightLines: any[] = [];
  const photoPositions: any[] = [];
  const transitionPaths: any[] = [];
  const finalLocalPath: [number, number][] = [];
  let reverse = false;
  let photoSeq = 1;

  for (let idx = 0; idx < rawFlightLines.length; idx++) {
    const line = rawFlightLines[idx];
    const pStartRot: [number, number] = reverse ? [line[1][0], line[1][1]] : [line[0][0], line[0][1]];
    const pEndRot: [number, number] = reverse ? [line[0][0], line[0][1]] : [line[1][0], line[1][1]];

    finalLocalPath.push(pStartRot, pEndRot);

    const [startLon, startLat] = toWgs84Point(pStartRot[0], pStartRot[1]);
    const [endLon, endLat] = toWgs84Point(pEndRot[0], pEndRot[1]);
    const lineLength = Math.abs(pEndRot[0] - pStartRot[0]);
    const bearing = calculateBearing(startLon, startLat, endLon, endLat);

    // Compute photo capture trigger positions along this line
    const numPhotosOnLine = Math.max(2, Math.floor(lineLength / photoSpacing) + 1);
    const linePhotos: any[] = [];

    for (let pIdx = 0; pIdx < numPhotosOnLine; pIdx++) {
      const frac = pIdx / (numPhotosOnLine - 1);
      const rx = pStartRot[0] + frac * (pEndRot[0] - pStartRot[0]);
      const ry = pStartRot[1];
      const [photoLon, photoLat] = toWgs84Point(rx, ry);

      const photo = {
        sequence: photoSeq++,
        longitude: photoLon,
        latitude: photoLat,
        altitudeMeters,
        gimbalPitchDeg: -90,
        headingDeg: bearing,
        flightLineIndex: idx,
        passId: 'A' as const,
        triggerMode: 'distance_interval' as const,
      };
      linePhotos.push(photo);
      photoPositions.push(photo);
    }

    flightLines.push({
      lineIndex: idx,
      passId: 'A',
      startPoint: [startLon, startLat, altitudeMeters],
      endPoint: [endLon, endLat, altitudeMeters],
      lengthMeters: Number(lineLength.toFixed(1)),
      bearingDeg: bearing,
      photoPositions: linePhotos,
    });

    if (idx > 0) {
      const prevEnd = flightLines[idx - 1].endPoint;
      const curStart = flightLines[idx].startPoint;
      const transDist = calculateGeodesicDistance(prevEnd[0], prevEnd[1], curStart[0], curStart[1]);
      transitionPaths.push({
        fromLineIndex: idx - 1,
        toLineIndex: idx,
        pathPoints: [prevEnd, curStart],
        lengthMeters: Number(transDist.toFixed(1)),
        turnType: turnStrategy,
      });
    }

    reverse = !reverse;
  }

  const waypoints: DroneWaypointDTO[] = finalLocalPath.map(([rx, ry], idx) => {
    const [lon, lat] = toWgs84Point(rx, ry);
    return {
      sequence: idx + 1,
      longitude: lon,
      latitude: lat,
      altitudeMeters,
      speedMps,
      turnMode: turnStrategy,
      gimbalPitchDeg: -90,
      action: idx % 2 === 0 ? 'start_recording' : 'stop_recording',
    };
  });

  // Calculate total route distance
  let totalDistanceMeters = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalDistanceMeters += calculateGeodesicDistance(
      waypoints[i].longitude,
      waypoints[i].latitude,
      waypoints[i + 1].longitude,
      waypoints[i + 1].latitude
    );
  }

  // Add transit from home if available
  if (homePoint && waypoints.length > 0) {
    totalDistanceMeters += calculateGeodesicDistance(
      homePoint[0],
      homePoint[1],
      waypoints[0].longitude,
      waypoints[0].latitude
    );
    totalDistanceMeters += calculateGeodesicDistance(
      waypoints[waypoints.length - 1].longitude,
      waypoints[waypoints.length - 1].latitude,
      homePoint[0],
      homePoint[1]
    );
  }

  return {
    waypoints,
    totalDistanceMeters: Math.round(totalDistanceMeters),
    flightLinesCount: rawFlightLines.length,
    flightLines,
    photoPositions,
    transitionPaths,
  };
}

import { PLATFORM_REGISTRY, validatePlatformCompatibility } from './drone-platform-registry';
import { PlatformId } from '@geomonitor/shared';

/**
 * 3. Multi-Axis Mission Validation Engine
 */
export function validateDroneMission(mission: {
  name: string;
  waypoints: DroneWaypointDTO[];
  surveyArea?: { coordinates: number[][][] };
  homePoint?: [number, number, number];
  altitudeReference: AltitudeReference;
  flightAltitudeMeters: number;
  maxAltitudeMeters: number;
  droneModel?: string;
  targetPlatform?: PlatformId;
  totalDistanceMeters?: number;
}): {
  status: ValidationStatus;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];

  // 0. Platform Specific Capability Check
  if (mission.targetPlatform) {
    const platformIssues = validatePlatformCompatibility(
      mission.targetPlatform,
      mission as any,
      mission.waypoints?.length || 0,
      mission.totalDistanceMeters || 0
    );
    issues.push(...platformIssues);
  }

  // 1. Data Validation
  if (!mission.name || mission.name.trim().length === 0) {
    issues.push({
      category: 'data',
      level: 'error',
      code: 'MISSING_NAME',
      message: 'ต้องระบุชื่อภารกิจการบิน',
    });
  }

  // 2. Geometry Validation
  if (!mission.waypoints || mission.waypoints.length === 0) {
    issues.push({
      category: 'geometry',
      level: 'error',
      code: 'NO_WAYPOINTS',
      message: 'ภารกิจต้องมีจุด Waypoint อย่างน้อย 1 จุด',
    });
  } else if (mission.waypoints.length > 500) {
    issues.push({
      category: 'aircraft',
      level: 'warning',
      code: 'HIGH_WAYPOINT_COUNT',
      message: `จำนวน Waypoint (${mission.waypoints.length}) สูง อาจเกินขีดจำกัดโดรนบางรุ่น (DJI แนะนำ <= 500 จุด)`,
    });
  }

  // 3. Operational Home Point Validation
  if (!mission.homePoint) {
    issues.push({
      category: 'operational',
      level: 'error',
      code: 'NO_HOME_POINT',
      message: 'ไม่ได้กำหนดจุดขึ้นบิน (Home Point) ที่ปลอดภัยสำหรับการ Return-to-Home',
    });
  }

  // 4. Altitude Validation
  if (mission.flightAltitudeMeters > mission.maxAltitudeMeters) {
    issues.push({
      category: 'altitude',
      level: 'error',
      code: 'ALTITUDE_EXCEEDED',
      message: `ความสูงการบิน (${mission.flightAltitudeMeters}m) เกินกว่าเพดานบินสูงสุดที่อนุญาต (${mission.maxAltitudeMeters}m)`,
    });
  }

  if (mission.flightAltitudeMeters > 120) {
    issues.push({
      category: 'altitude',
      level: 'warning',
      code: 'CAAT_ALTITUDE_LIMIT',
      message: 'ความสูงการบินเกิน 120 เมตร (400 ฟุต AGL) ต้องขออนุญาตทำการบินกรณีพิเศษตามกฎหมายการบินพลเรือน',
    });
  }

  if (mission.altitudeReference === 'agl') {
    issues.push({
      category: 'altitude',
      level: 'warning',
      code: 'AGL_TERRAIN_CHECK',
      message: 'โหมด AGL (Terrain Following) ต้องใช้ข้อมูลระดับความสูงผิวดินจริง ห้ามทำการบินหากไม่มีเซนเซอร์เรดาร์วัดระดับ',
    });
  }

  // 5. Waypoints out-of-boundary check
  if (mission.surveyArea && mission.surveyArea.coordinates?.[0]?.length >= 3) {
    const polyRing = mission.surveyArea.coordinates[0] as [number, number][];
    let outCount = 0;
    mission.waypoints.forEach((wp, idx) => {
      if (!isPointInPolygon([wp.longitude, wp.latitude], polyRing)) {
        outCount++;
        if (outCount <= 3) {
          issues.push({
            category: 'geometry',
            level: 'warning',
            code: 'WAYPOINT_OUT_OF_BOUNDS',
            message: `Waypoint #${wp.sequence} ออกนอกขอบเขตสำรวจที่กำหนด`,
            waypointIndex: wp.sequence,
          });
        }
      }
    });

    if (outCount > 3) {
      issues.push({
        category: 'geometry',
        level: 'warning',
        code: 'MULTIPLE_OUT_OF_BOUNDS',
        message: `มี Waypoint ออกนอกพื้นที่สำรวจทั้งหมด ${outCount} จุด`,
      });
    }
  }

  // Determine overall status
  const hasErrors = issues.some((i) => i.level === 'error');
  const hasWarnings = issues.some((i) => i.level === 'warning');

  let status: ValidationStatus = 'PASS';
  if (hasErrors) {
    status = 'BLOCKED';
  } else if (hasWarnings) {
    status = 'WARNING';
  }

  return { status, issues };
}
