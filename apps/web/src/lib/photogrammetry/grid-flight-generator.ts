import { CameraParameters, DroneWaypointDTO, TurnStrategy } from '@geomonitor/shared';
import {
  LocalEnuProjector,
  calculateBearing,
  calculateGeodesicDistance,
  toRadians,
} from './mission-geometry-engine';
import { CameraFootprintCalculator } from './camera-footprint-calculator';
import {
  FlightLineSegment,
  PhotoCapturePosition,
  TransitionPath,
} from './types';

export interface GridFlightGeneratorOptions {
  polygon: [number, number][]; // WGS84 [lon, lat]
  altitudeMeters: number;
  camera: CameraParameters;
  gridAngleDeg?: number;
  speedMps?: number;
  turnStrategy?: TurnStrategy;
  homePoint?: [number, number, number];
  isCrosshatch?: boolean;
  gimbalPitchDeg?: number;
  marginMeters?: number;
}

export interface GridFlightResult {
  flightLines: FlightLineSegment[];
  photoCapturePositions: PhotoCapturePosition[];
  transitionPaths: TransitionPath[];
  waypoints: DroneWaypointDTO[];
  totalSurveyDistanceMeters: number;
  totalFlightDistanceMeters: number;
  flightLinesCount: number;
  passACount?: { lines: number; photos: number };
  passBCount?: { lines: number; photos: number };
}

/**
 * GridFlightGenerator
 * Produces Boustrophedon survey flight lines and computes dense photo capture
 * trigger points along every line based on forward/side camera overlap.
 */
export class GridFlightGenerator {
  /**
   * Generate 2D Grid or 3D Crosshatch survey plan
   */
  static generate(options: GridFlightGeneratorOptions): GridFlightResult {
    const {
      polygon,
      altitudeMeters,
      camera,
      gridAngleDeg = 0,
      speedMps = 8,
      turnStrategy = 'stop_and_turn',
      homePoint,
      isCrosshatch = false,
      gimbalPitchDeg = -90,
      marginMeters = 0,
    } = options;

    if (!polygon || polygon.length < 3) {
      return {
        flightLines: [],
        photoCapturePositions: [],
        transitionPaths: [],
        waypoints: [],
        totalSurveyDistanceMeters: 0,
        totalFlightDistanceMeters: 0,
        flightLinesCount: 0,
      };
    }

    // Clean boundary ring
    const ring = [...polygon];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) {
      ring.pop();
    }

    // Pass A: primary grid angle
    const passAResult = this.generateSinglePass({
      ring,
      altitudeMeters,
      camera,
      bearingDeg: gridAngleDeg,
      speedMps,
      turnStrategy,
      gimbalPitchDeg,
      marginMeters,
      passId: 'A',
      startSequence: 1,
    });

    if (!isCrosshatch) {
      return this.finalizeResult([passAResult], homePoint, speedMps, turnStrategy, altitudeMeters);
    }

    // Pass B: orthogonal grid (bearing + 90 deg)
    const passBResult = this.generateSinglePass({
      ring,
      altitudeMeters,
      camera,
      bearingDeg: (gridAngleDeg + 90) % 360,
      speedMps,
      turnStrategy,
      gimbalPitchDeg,
      marginMeters,
      passId: 'B',
      startSequence: passAResult.photoPositions.length + 1,
    });

    const result = this.finalizeResult(
      [passAResult, passBResult],
      homePoint,
      speedMps,
      turnStrategy,
      altitudeMeters
    );

    result.passACount = {
      lines: passAResult.flightLines.length,
      photos: passAResult.photoPositions.length,
    };
    result.passBCount = {
      lines: passBResult.flightLines.length,
      photos: passBResult.photoPositions.length,
    };

    return result;
  }

  /**
   * Helper: Generate a single parallel grid sweep pass
   */
  private static generateSinglePass(opts: {
    ring: [number, number][];
    altitudeMeters: number;
    camera: CameraParameters;
    bearingDeg: number;
    speedMps: number;
    turnStrategy: TurnStrategy;
    gimbalPitchDeg: number;
    marginMeters: number;
    passId: 'A' | 'B';
    startSequence: number;
  }): {
    flightLines: FlightLineSegment[];
    photoPositions: PhotoCapturePosition[];
    transitionPaths: TransitionPath[];
  } {
    const {
      ring,
      altitudeMeters,
      camera,
      bearingDeg,
      speedMps,
      turnStrategy,
      gimbalPitchDeg,
      marginMeters,
      passId,
      startSequence,
    } = opts;

    // Calculate footprint parameters
    const fp = CameraFootprintCalculator.calculate(
      altitudeMeters,
      camera,
      speedMps,
      gimbalPitchDeg
    );
    const lineSpacing = fp.flightLineSpacingMeters;
    const photoSpacing = fp.photoTriggerDistanceMeters;

    // Project polygon to local metric coordinates
    let sumLon = 0;
    let sumLat = 0;
    for (const [lon, lat] of ring) {
      sumLon += lon;
      sumLat += lat;
    }
    const centerLon = sumLon / ring.length;
    const centerLat = sumLat / ring.length;
    const proj = new LocalEnuProjector(centerLon, centerLat);

    // Rotate points by -bearingDeg so flight lines become horizontal along X'
    const rad = toRadians(-bearingDeg);
    const cosRad = Math.cos(rad);
    const sinRad = Math.sin(rad);

    const rotatedPoints: [number, number][] = ring.map(([lon, lat]) => {
      const [x, y] = proj.forward(lon, lat);
      const rx = x * cosRad - y * sinRad;
      const ry = x * sinRad + y * cosRad;
      return [rx, ry];
    });

    // Compute bounding box in rotated space
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

    // Expand by margin if requested
    if (marginMeters > 0) {
      minRx -= marginMeters;
      minRy -= marginMeters;
      maxRx += marginMeters;
      maxRy += marginMeters;
    }

    // Generate scanlines from minRy to maxRy
    const rawSegments: { xStart: number; xEnd: number; y: number }[] = [];
    const step = Math.max(lineSpacing, 5.0);

    for (let y = minRy + step / 2; y <= maxRy; y += step) {
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

      // Pair interior segments
      for (let i = 0; i < intersections.length - 1; i += 2) {
        const xStart = intersections[i];
        const xEnd = intersections[i + 1];
        if (xEnd - xStart > 2.0) {
          rawSegments.push({ xStart, xEnd, y });
        }
      }
    }

    // Inverse rotation helper back to WGS84
    const invRad = toRadians(bearingDeg);
    const invCos = Math.cos(invRad);
    const invSin = Math.sin(invRad);

    const toWgs84 = (rx: number, ry: number): [number, number] => {
      const x = rx * invCos - ry * invSin;
      const y = rx * invSin + ry * invCos;
      return proj.inverse(x, y);
    };

    const flightLines: FlightLineSegment[] = [];
    const photoPositions: PhotoCapturePosition[] = [];
    const transitionPaths: TransitionPath[] = [];

    let currentPhotoSeq = startSequence;
    let reverse = false;

    for (let idx = 0; idx < rawSegments.length; idx++) {
      const seg = rawSegments[idx];
      // Alternate left-to-right and right-to-left
      const pStartRot: [number, number] = reverse ? [seg.xEnd, seg.y] : [seg.xStart, seg.y];
      const pEndRot: [number, number] = reverse ? [seg.xStart, seg.y] : [seg.xEnd, seg.y];

      const [startLon, startLat] = toWgs84(pStartRot[0], pStartRot[1]);
      const [endLon, endLat] = toWgs84(pEndRot[0], pEndRot[1]);

      const lineLengthMeters = Math.abs(seg.xEnd - seg.xStart);
      const lineBearing = calculateBearing(startLon, startLat, endLon, endLat);

      // Interpolate photo capture positions along line segment
      const numPhotos = Math.max(2, Math.floor(lineLengthMeters / photoSpacing) + 1);
      const linePhotos: PhotoCapturePosition[] = [];

      for (let pIdx = 0; pIdx < numPhotos; pIdx++) {
        const frac = numPhotos === 1 ? 0.5 : pIdx / (numPhotos - 1);
        const rx = pStartRot[0] + frac * (pEndRot[0] - pStartRot[0]);
        const ry = pStartRot[1];
        const [photoLon, photoLat] = toWgs84(rx, ry);

        const photo: PhotoCapturePosition = {
          sequence: currentPhotoSeq++,
          longitude: photoLon,
          latitude: photoLat,
          altitudeMeters,
          gimbalPitchDeg,
          headingDeg: lineBearing,
          flightLineIndex: idx,
          passId,
          triggerMode: 'distance_interval',
        };
        linePhotos.push(photo);
        photoPositions.push(photo);
      }

      flightLines.push({
        lineIndex: idx,
        passId,
        startPoint: [startLon, startLat, altitudeMeters],
        endPoint: [endLon, endLat, altitudeMeters],
        lengthMeters: Number(lineLengthMeters.toFixed(1)),
        bearingDeg: lineBearing,
        photoPositions: linePhotos,
      });

      // Transition turn to next line
      if (idx > 0) {
        const prevEnd = flightLines[idx - 1].endPoint;
        const curStart = flightLines[idx].startPoint;
        const dist = calculateGeodesicDistance(
          prevEnd[0],
          prevEnd[1],
          curStart[0],
          curStart[1]
        );

        transitionPaths.push({
          fromLineIndex: idx - 1,
          toLineIndex: idx,
          pathPoints: [prevEnd, curStart],
          lengthMeters: Number(dist.toFixed(1)),
          turnType: turnStrategy,
        });
      }

      reverse = !reverse;
    }

    return { flightLines, photoPositions, transitionPaths };
  }

  /**
   * Assemble complete mission result and autopilot waypoints
   */
  private static finalizeResult(
    passes: {
      flightLines: FlightLineSegment[];
      photoPositions: PhotoCapturePosition[];
      transitionPaths: TransitionPath[];
    }[],
    homePoint: [number, number, number] | undefined,
    speedMps: number,
    turnStrategy: TurnStrategy,
    altitudeMeters: number
  ): GridFlightResult {
    const allFlightLines: FlightLineSegment[] = [];
    const allPhotos: PhotoCapturePosition[] = [];
    const allTransitions: TransitionPath[] = [];

    passes.forEach((p) => {
      allFlightLines.push(...p.flightLines);
      allPhotos.push(...p.photoPositions);
      allTransitions.push(...p.transitionPaths);
    });

    let totalSurveyDistance = 0;
    for (const line of allFlightLines) {
      totalSurveyDistance += line.lengthMeters;
    }
    for (const trans of allTransitions) {
      totalSurveyDistance += trans.lengthMeters;
    }

    let totalFlightDistance = totalSurveyDistance;

    // Convert flight lines into sequential navigational waypoints for drone autopilot
    const waypoints: DroneWaypointDTO[] = [];
    let wpSeq = 1;

    for (const line of allFlightLines) {
      // Start of mapping line
      waypoints.push({
        sequence: wpSeq++,
        longitude: line.startPoint[0],
        latitude: line.startPoint[1],
        altitudeMeters: line.startPoint[2],
        speedMps,
        turnMode: turnStrategy,
        headingDeg: line.bearingDeg,
        gimbalPitchDeg: line.photoPositions[0]?.gimbalPitchDeg ?? -90,
        action: 'start_recording',
      });

      // End of mapping line
      waypoints.push({
        sequence: wpSeq++,
        longitude: line.endPoint[0],
        latitude: line.endPoint[1],
        altitudeMeters: line.endPoint[2],
        speedMps,
        turnMode: turnStrategy,
        headingDeg: line.bearingDeg,
        gimbalPitchDeg: line.photoPositions[0]?.gimbalPitchDeg ?? -90,
        action: 'stop_recording',
      });
    }

    // Add transit distances to/from home
    if (homePoint && waypoints.length > 0) {
      totalFlightDistance += calculateGeodesicDistance(
        homePoint[0],
        homePoint[1],
        waypoints[0].longitude,
        waypoints[0].latitude
      );
      totalFlightDistance += calculateGeodesicDistance(
        waypoints[waypoints.length - 1].longitude,
        waypoints[waypoints.length - 1].latitude,
        homePoint[0],
        homePoint[1]
      );
    }

    return {
      flightLines: allFlightLines,
      photoCapturePositions: allPhotos,
      transitionPaths: allTransitions,
      waypoints,
      totalSurveyDistanceMeters: Math.round(totalSurveyDistance),
      totalFlightDistanceMeters: Math.round(totalFlightDistance),
      flightLinesCount: allFlightLines.length,
    };
  }
}
