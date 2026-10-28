import { CameraParameters, DroneWaypointDTO, TurnStrategy } from '@geomonitor/shared';
import {
  LocalEnuProjector,
  calculateBearing,
  calculateGeodesicDistance,
  toDegrees,
  toRadians,
} from './mission-geometry-engine';
import { CameraFootprintCalculator } from './camera-footprint-calculator';
import {
  FlightLineSegment,
  OrbitConfig,
  PhotoCapturePosition,
  TransitionPath,
} from './types';

export interface OrbitFlightResult {
  flightLines: FlightLineSegment[];
  photoCapturePositions: PhotoCapturePosition[];
  transitionPaths: TransitionPath[];
  waypoints: DroneWaypointDTO[];
  totalFlightDistanceMeters: number;
  tiersCount: number;
}

/**
 * OrbitFlightGenerator
 * Generates circular 3D photogrammetry trajectories around a Point of Interest (POI)
 * with multi-tier altitudes, inward-facing headings, and calculated camera pitch.
 */
export class OrbitFlightGenerator {
  static generate(options: {
    config: OrbitConfig;
    camera: CameraParameters;
    homePoint?: [number, number, number];
    turnStrategy?: TurnStrategy;
  }): OrbitFlightResult {
    const {
      config,
      camera,
      homePoint,
      turnStrategy = 'adaptive_curve',
    } = options;

    const {
      centerPoi,
      radiusMeters,
      altitudeTiers,
      speedMps = 6,
      clockwise = true,
    } = config;

    const [centerLon, centerLat, centerAlt] = centerPoi;
    const proj = new LocalEnuProjector(centerLon, centerLat);

    const flightLines: FlightLineSegment[] = [];
    const photoPositions: PhotoCapturePosition[] = [];
    const transitionPaths: TransitionPath[] = [];
    const waypoints: DroneWaypointDTO[] = [];

    let currentPhotoSeq = 1;
    let currentWpSeq = 1;
    let totalDistanceMeters = 0;

    // Sort tiers from lower to higher or as configured
    const tiers = altitudeTiers && altitudeTiers.length > 0 ? altitudeTiers : [centerAlt + 40];

    tiers.forEach((altMeters, tierIdx) => {
      // Calculate footprint to determine photo spacing along circumference
      const fp = CameraFootprintCalculator.calculate(
        altMeters - centerAlt,
        camera,
        speedMps,
        -45
      );
      const circumference = 2 * Math.PI * radiusMeters;
      const numPhotos = config.photosPerCircle
        ? config.photosPerCircle
        : Math.max(12, Math.round(circumference / Math.max(fp.photoTriggerDistanceMeters, 5.0)));

      const tierPhotos: PhotoCapturePosition[] = [];
      const tierWaypoints: DroneWaypointDTO[] = [];
      const circlePoints: [number, number, number][] = [];

      // Calculate camera pitch angle to look down directly at center POI
      const deltaH = altMeters - centerAlt;
      const pitchRad = Math.atan2(deltaH, radiusMeters);
      const gimbalPitchDeg = -Number(toDegrees(pitchRad).toFixed(1)); // negative value looking down

      for (let i = 0; i < numPhotos; i++) {
        // Angle in radians (0 to 2PI)
        const angleFrac = i / numPhotos;
        const theta = clockwise ? angleFrac * 2 * Math.PI : -angleFrac * 2 * Math.PI;

        const x = radiusMeters * Math.cos(theta);
        const y = radiusMeters * Math.sin(theta);
        const [lon, lat] = proj.inverse(x, y);

        // Heading must point inwards towards center POI
        const headingDeg = calculateBearing(lon, lat, centerLon, centerLat);

        const photo: PhotoCapturePosition = {
          sequence: currentPhotoSeq++,
          longitude: lon,
          latitude: lat,
          altitudeMeters: altMeters,
          gimbalPitchDeg,
          headingDeg,
          flightLineIndex: tierIdx,
          triggerMode: 'distance_interval',
        };
        tierPhotos.push(photo);
        photoPositions.push(photo);

        circlePoints.push([lon, lat, altMeters]);

        // Autopilot waypoint
        const wp: DroneWaypointDTO = {
          sequence: currentWpSeq++,
          longitude: lon,
          latitude: lat,
          altitudeMeters: altMeters,
          speedMps,
          turnMode: turnStrategy,
          headingDeg,
          gimbalPitchDeg,
          action: 'take_photo',
          poiReference: centerPoi,
        };
        tierWaypoints.push(wp);
        waypoints.push(wp);
      }

      // Record circular segment as a FlightLineSegment
      flightLines.push({
        lineIndex: tierIdx,
        startPoint: circlePoints[0],
        endPoint: circlePoints[circlePoints.length - 1],
        lengthMeters: Number(circumference.toFixed(1)),
        bearingDeg: 0,
        photoPositions: tierPhotos,
      });

      totalDistanceMeters += circumference;

      // Transition between tiers
      if (tierIdx > 0) {
        const prevEnd = flightLines[tierIdx - 1].endPoint;
        const curStart = flightLines[tierIdx].startPoint;
        const climbDist = Math.abs(altMeters - tiers[tierIdx - 1]);
        transitionPaths.push({
          fromLineIndex: tierIdx - 1,
          toLineIndex: tierIdx,
          pathPoints: [prevEnd, curStart],
          lengthMeters: Number(climbDist.toFixed(1)),
          turnType: turnStrategy,
        });
        totalDistanceMeters += climbDist;
      }
    });

    // Transit from/to home point
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
      flightLines,
      photoCapturePositions: photoPositions,
      transitionPaths,
      waypoints,
      totalFlightDistanceMeters: Math.round(totalDistanceMeters),
      tiersCount: tiers.length,
    };
  }
}
