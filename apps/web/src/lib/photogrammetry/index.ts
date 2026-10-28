export * from './types';
export * from './mission-geometry-engine';
export * from './camera-footprint-calculator';
export * from './grid-flight-generator';
export * from './orbit-flight-generator';
export * from './corridor-flight-generator';
export * from './mission-estimator';

import {
  CameraParameters,
  DroneMissionType,
  PlatformId,
  TurnStrategy,
} from '@geomonitor/shared';
import {
  CorridorConfig,
  OrbitConfig,
  PhotogrammetryPlanResult,
} from './types';
import { CameraFootprintCalculator } from './camera-footprint-calculator';
import { GridFlightGenerator } from './grid-flight-generator';
import { OrbitFlightGenerator } from './orbit-flight-generator';
import { CorridorFlightGenerator } from './corridor-flight-generator';
import { MissionEstimator } from './mission-estimator';
import { calculatePolygonAreaM2 } from './mission-geometry-engine';
import { validatePlatformCompatibility } from '../drone-platform-registry';

export interface GenerateMissionOptions {
  missionType: DroneMissionType;
  polygon?: [number, number][]; // For 2D Grid / 3D Crosshatch
  orbitConfig?: OrbitConfig; // For 3D Orbit
  corridorConfig?: CorridorConfig; // For Corridor
  altitudeMeters: number;
  camera: CameraParameters;
  gridAngleDeg?: number;
  speedMps?: number;
  turnStrategy?: TurnStrategy;
  homePoint?: [number, number, number];
  gimbalPitchDeg?: number;
  targetPlatform?: PlatformId;
}

/**
 * High-Level Photogrammetry Mission Planning Engine
 * Dispatches to specialized generators based on missionType, computes dense photo positions,
 * realistic flight estimates, and validates platform constraints.
 */
export function generatePhotogrammetryMission(
  options: GenerateMissionOptions
): PhotogrammetryPlanResult {
  const {
    missionType,
    polygon = [],
    orbitConfig,
    corridorConfig,
    altitudeMeters,
    camera,
    gridAngleDeg = 0,
    speedMps = 8,
    turnStrategy = 'stop_and_turn',
    homePoint,
    gimbalPitchDeg = missionType === 'crosshatch_survey' ? -65 : -90,
    targetPlatform,
  } = options;

  const fp = CameraFootprintCalculator.calculate(
    altitudeMeters,
    camera,
    speedMps,
    gimbalPitchDeg
  );

  let flightLines: any[] = [];
  let photoPositions: any[] = [];
  let transitionPaths: any[] = [];
  let waypoints: any[] = [];
  let totalFlightDistanceMeters = 0;
  let passACount: any;
  let passBCount: any;

  if (missionType === 'orbit_poi' && orbitConfig) {
    const orbitResult = OrbitFlightGenerator.generate({
      config: orbitConfig,
      camera,
      homePoint,
      turnStrategy,
    });
    flightLines = orbitResult.flightLines;
    photoPositions = orbitResult.photoCapturePositions;
    transitionPaths = orbitResult.transitionPaths;
    waypoints = orbitResult.waypoints;
    totalFlightDistanceMeters = orbitResult.totalFlightDistanceMeters;
  } else if (missionType === 'corridor_mapping' && corridorConfig) {
    const corridorResult = CorridorFlightGenerator.generate({
      config: corridorConfig,
      camera,
      homePoint,
    });
    flightLines = corridorResult.flightLines;
    photoPositions = corridorResult.photoCapturePositions;
    transitionPaths = corridorResult.transitionPaths;
    waypoints = corridorResult.waypoints;
    totalFlightDistanceMeters = corridorResult.totalFlightDistanceMeters;
  } else {
    // Standard 2D Grid or 3D Crosshatch
    const isCrosshatch = missionType === 'crosshatch_survey';
    const gridResult = GridFlightGenerator.generate({
      polygon,
      altitudeMeters,
      camera,
      gridAngleDeg,
      speedMps,
      turnStrategy,
      homePoint,
      isCrosshatch,
      gimbalPitchDeg,
    });
    flightLines = gridResult.flightLines;
    photoPositions = gridResult.photoCapturePositions;
    transitionPaths = gridResult.transitionPaths;
    waypoints = gridResult.waypoints;
    totalFlightDistanceMeters = gridResult.totalFlightDistanceMeters;
    passACount = gridResult.passACount;
    passBCount = gridResult.passBCount;
  }

  // Calculate survey area
  const surveyAreaM2 = polygon.length >= 3 ? Math.round(calculatePolygonAreaM2(polygon)) : 0;

  // Run mission estimator
  const estimates = MissionEstimator.estimate({
    flightLines,
    photoPositions,
    transitionPaths,
    totalFlightDistanceMeters,
    flightSpeedMps: speedMps,
    transitSpeedMps: 12,
    turnStrategy,
    gsdCmPerPixel: fp.gsdCmPerPixel,
    groundCoverageWidthMeters: fp.groundCoverageWidthMeters,
    groundCoverageHeightMeters: fp.groundCoverageHeightMeters,
    flightLineSpacingMeters: fp.flightLineSpacingMeters,
    photoTriggerDistanceMeters: fp.photoTriggerDistanceMeters,
  });

  // Sample footprints along the route for visualization (e.g. 5 representative samples)
  const sampleFootprints: any[] = [];
  if (photoPositions.length > 0) {
    const sampleStep = Math.max(1, Math.floor(photoPositions.length / 5));
    for (let i = 0; i < photoPositions.length; i += sampleStep) {
      const p = photoPositions[i];
      const box = CameraFootprintCalculator.computeFootprintBox(
        p.longitude,
        p.latitude,
        p.altitudeMeters,
        camera,
        p.headingDeg,
        p.gimbalPitchDeg
      );
      sampleFootprints.push(box);
    }
  }

  // Multi-Axis Platform & Safety Validation
  const issues: any[] = [];
  if (targetPlatform) {
    const platformIssues = validatePlatformCompatibility(
      targetPlatform,
      {
        missionType,
        altitudeReference: 'relative_to_home',
        flightAltitudeMeters: altitudeMeters,
      },
      waypoints.length,
      totalFlightDistanceMeters
    );
    issues.push(...platformIssues);
  }

  const hasError = issues.some((i) => i.level === 'error');
  const hasWarning = issues.some((i) => i.level === 'warning');
  const validationStatus = hasError ? 'BLOCKED' : hasWarning ? 'WARNING' : 'PASS';

  return {
    missionType,
    waypoints,
    flightLines,
    photoCapturePositions: photoPositions,
    transitionPaths,
    estimates: {
      ...estimates,
      surveyAreaM2,
      flightLinesCount: flightLines.length,
      passACount,
      passBCount,
    },
    sampleFootprints,
    validationStatus,
    validationIssues: issues,
  };
}
