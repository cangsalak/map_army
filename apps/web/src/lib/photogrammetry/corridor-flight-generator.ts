import { CameraParameters, DroneWaypointDTO, TurnStrategy } from '@geomonitor/shared';
import {
  LocalEnuProjector,
  calculateBearing,
  calculateGeodesicDistance,
} from './mission-geometry-engine';
import { CameraFootprintCalculator } from './camera-footprint-calculator';
import {
  CorridorConfig,
  FlightLineSegment,
  PhotoCapturePosition,
  TransitionPath,
} from './types';

export interface CorridorFlightResult {
  flightLines: FlightLineSegment[];
  photoCapturePositions: PhotoCapturePosition[];
  transitionPaths: TransitionPath[];
  waypoints: DroneWaypointDTO[];
  totalFlightDistanceMeters: number;
  flightLinesCount: number;
}

/**
 * CorridorFlightGenerator
 * Produces parallel flight lines along linear infrastructure (roads, rivers, pipelines, power lines)
 * based on centerline coordinates, corridor swath width, and camera footprint overlap.
 */
export class CorridorFlightGenerator {
  static generate(options: {
    config: CorridorConfig;
    camera: CameraParameters;
    homePoint?: [number, number, number];
  }): CorridorFlightResult {
    const { config, camera, homePoint } = options;
    const {
      centerline,
      corridorWidthMeters,
      altitudeMeters,
      speedMps = 8,
      turnStrategy = 'stop_and_turn',
    } = config;

    if (!centerline || centerline.length < 2) {
      return {
        flightLines: [],
        photoCapturePositions: [],
        transitionPaths: [],
        waypoints: [],
        totalFlightDistanceMeters: 0,
        flightLinesCount: 0,
      };
    }

    // Reference center for local ENU projection
    const midIdx = Math.floor(centerline.length / 2);
    const proj = new LocalEnuProjector(centerline[midIdx][0], centerline[midIdx][1]);

    const localCenterline: [number, number][] = centerline.map(([lon, lat]) =>
      proj.forward(lon, lat)
    );

    // Calculate footprint and line spacing
    const fp = CameraFootprintCalculator.calculate(altitudeMeters, camera, speedMps, -90);
    const lineSpacing = fp.flightLineSpacingMeters;
    const photoSpacing = fp.photoTriggerDistanceMeters;

    // Calculate number of parallel lines needed
    const numLines = Math.max(1, Math.ceil(corridorWidthMeters / lineSpacing));
    const offsets: number[] = [];

    if (numLines === 1) {
      offsets.push(0);
    } else {
      const startOffset = -((numLines - 1) * lineSpacing) / 2;
      for (let i = 0; i < numLines; i++) {
        offsets.push(startOffset + i * lineSpacing);
      }
    }

    const flightLines: FlightLineSegment[] = [];
    const photoPositions: PhotoCapturePosition[] = [];
    const transitionPaths: TransitionPath[] = [];

    let currentPhotoSeq = 1;
    let reverse = false;

    offsets.forEach((offsetMeters, lineIdx) => {
      // Offset the local centerline perpendicular to segment headings
      const offsetLocalPoints: [number, number][] = [];

      for (let i = 0; i < localCenterline.length; i++) {
        let dx: number;
        let dy: number;

        if (i === 0) {
          dx = localCenterline[1][0] - localCenterline[0][0];
          dy = localCenterline[1][1] - localCenterline[0][1];
        } else if (i === localCenterline.length - 1) {
          dx = localCenterline[i][0] - localCenterline[i - 1][0];
          dy = localCenterline[i][1] - localCenterline[i - 1][1];
        } else {
          dx = localCenterline[i + 1][0] - localCenterline[i - 1][0];
          dy = localCenterline[i + 1][1] - localCenterline[i - 1][1];
        }

        const len = Math.hypot(dx, dy) || 1;
        // Perpendicular unit vector (normal)
        const nx = -dy / len;
        const ny = dx / len;

        offsetLocalPoints.push([
          localCenterline[i][0] + nx * offsetMeters,
          localCenterline[i][1] + ny * offsetMeters,
        ]);
      }

      // If reversed, reverse the points for boustrophedon sweep
      const sweepPoints = reverse ? [...offsetLocalPoints].reverse() : offsetLocalPoints;
      reverse = !reverse;

      // Convert sweep points to WGS84 and compute photo intervals along the line
      const wgsPoints: [number, number, number][] = sweepPoints.map(([x, y]) => {
        const [lon, lat] = proj.inverse(x, y);
        return [lon, lat, altitudeMeters];
      });

      let lineTotalDist = 0;
      for (let j = 0; j < wgsPoints.length - 1; j++) {
        lineTotalDist += calculateGeodesicDistance(
          wgsPoints[j][0],
          wgsPoints[j][1],
          wgsPoints[j + 1][0],
          wgsPoints[j + 1][1]
        );
      }

      // Photo capture positions along this corridor line
      const linePhotos: PhotoCapturePosition[] = [];
      const numPhotos = Math.max(2, Math.floor(lineTotalDist / photoSpacing) + 1);

      for (let p = 0; p < numPhotos; p++) {
        const targetDist = p * (lineTotalDist / (numPhotos - 1));
        // Find segment containing targetDist
        let accumulated = 0;
        let photoCoord = wgsPoints[0];
        let segBearing = calculateBearing(wgsPoints[0][0], wgsPoints[0][1], wgsPoints[1][0], wgsPoints[1][1]);

        for (let j = 0; j < wgsPoints.length - 1; j++) {
          const segDist = calculateGeodesicDistance(
            wgsPoints[j][0],
            wgsPoints[j][1],
            wgsPoints[j + 1][0],
            wgsPoints[j + 1][1]
          );
          if (accumulated + segDist >= targetDist || j === wgsPoints.length - 2) {
            const ratio = segDist > 0 ? (targetDist - accumulated) / segDist : 0;
            const lon = wgsPoints[j][0] + ratio * (wgsPoints[j + 1][0] - wgsPoints[j][0]);
            const lat = wgsPoints[j][1] + ratio * (wgsPoints[j + 1][1] - wgsPoints[j][1]);
            photoCoord = [lon, lat, altitudeMeters];
            segBearing = calculateBearing(wgsPoints[j][0], wgsPoints[j][1], wgsPoints[j + 1][0], wgsPoints[j + 1][1]);
            break;
          }
          accumulated += segDist;
        }

        const photo: PhotoCapturePosition = {
          sequence: currentPhotoSeq++,
          longitude: Number(photoCoord[0].toFixed(7)),
          latitude: Number(photoCoord[1].toFixed(7)),
          altitudeMeters,
          gimbalPitchDeg: -90,
          headingDeg: segBearing,
          flightLineIndex: lineIdx,
          triggerMode: 'distance_interval',
        };
        linePhotos.push(photo);
        photoPositions.push(photo);
      }

      flightLines.push({
        lineIndex: lineIdx,
        startPoint: wgsPoints[0],
        endPoint: wgsPoints[wgsPoints.length - 1],
        lengthMeters: Number(lineTotalDist.toFixed(1)),
        bearingDeg: calculateBearing(wgsPoints[0][0], wgsPoints[0][1], wgsPoints[1][0], wgsPoints[1][1]),
        photoPositions: linePhotos,
      });

      if (lineIdx > 0) {
        const prevEnd = flightLines[lineIdx - 1].endPoint;
        const curStart = flightLines[lineIdx].startPoint;
        const dist = calculateGeodesicDistance(prevEnd[0], prevEnd[1], curStart[0], curStart[1]);
        transitionPaths.push({
          fromLineIndex: lineIdx - 1,
          toLineIndex: lineIdx,
          pathPoints: [prevEnd, curStart],
          lengthMeters: Number(dist.toFixed(1)),
          turnType: turnStrategy,
        });
      }
    });

    // Assemble autopilot waypoints
    const waypoints: DroneWaypointDTO[] = [];
    let wpSeq = 1;

    for (const line of flightLines) {
      waypoints.push({
        sequence: wpSeq++,
        longitude: line.startPoint[0],
        latitude: line.startPoint[1],
        altitudeMeters: line.startPoint[2],
        speedMps,
        turnMode: turnStrategy,
        headingDeg: line.bearingDeg,
        gimbalPitchDeg: -90,
        action: 'start_recording',
      });
      waypoints.push({
        sequence: wpSeq++,
        longitude: line.endPoint[0],
        latitude: line.endPoint[1],
        altitudeMeters: line.endPoint[2],
        speedMps,
        turnMode: turnStrategy,
        headingDeg: line.bearingDeg,
        gimbalPitchDeg: -90,
        action: 'stop_recording',
      });
    }

    let totalFlightDist = 0;
    for (const l of flightLines) totalFlightDist += l.lengthMeters;
    for (const t of transitionPaths) totalFlightDist += t.lengthMeters;

    if (homePoint && waypoints.length > 0) {
      totalFlightDist += calculateGeodesicDistance(homePoint[0], homePoint[1], waypoints[0].longitude, waypoints[0].latitude);
      totalFlightDist += calculateGeodesicDistance(waypoints[waypoints.length - 1].longitude, waypoints[waypoints.length - 1].latitude, homePoint[0], homePoint[1]);
    }

    return {
      flightLines,
      photoCapturePositions: photoPositions,
      transitionPaths,
      waypoints,
      totalFlightDistanceMeters: Math.round(totalFlightDist),
      flightLinesCount: flightLines.length,
    };
  }
}
