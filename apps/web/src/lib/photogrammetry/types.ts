import {
  CameraParameters,
  DroneMissionType,
  DroneWaypointDTO,
  PhotogrammetryEstimates,
  TurnStrategy,
  ValidationIssue,
  ValidationStatus,
} from '@geomonitor/shared';

export interface PhotoCapturePosition {
  sequence: number;
  longitude: number;
  latitude: number;
  altitudeMeters: number;
  gimbalPitchDeg: number;
  headingDeg: number;
  flightLineIndex: number;
  passId?: 'A' | 'B';
  triggerMode: 'distance_interval' | 'time_interval' | 'stop_and_shoot';
}

export interface FlightLineSegment {
  lineIndex: number;
  passId?: 'A' | 'B';
  startPoint: [number, number, number]; // [lon, lat, alt]
  endPoint: [number, number, number];
  lengthMeters: number;
  bearingDeg: number;
  photoPositions: PhotoCapturePosition[];
}

export interface TransitionPath {
  fromLineIndex: number;
  toLineIndex: number;
  pathPoints: [number, number, number][];
  lengthMeters: number;
  turnType: TurnStrategy;
}

export interface CameraFootprintBox {
  center: [number, number]; // [lon, lat]
  corners: [number, number][]; // 4 corners [lon, lat]
  widthMeters: number;
  heightMeters: number;
}

export interface OrbitConfig {
  centerPoi: [number, number, number]; // [lon, lat, alt]
  radiusMeters: number;
  altitudeTiers: number[]; // e.g. [50, 75]
  photosPerCircle?: number;
  speedMps?: number;
  clockwise?: boolean;
}

export interface CorridorConfig {
  centerline: [number, number][]; // [[lon, lat], ...]
  corridorWidthMeters: number;
  altitudeMeters: number;
  speedMps?: number;
  turnStrategy?: TurnStrategy;
}

export interface PhotogrammetryPlanResult {
  missionType: DroneMissionType;
  waypoints: DroneWaypointDTO[];
  flightLines: FlightLineSegment[];
  photoCapturePositions: PhotoCapturePosition[];
  transitionPaths: TransitionPath[];
  estimates: PhotogrammetryEstimates & {
    flightLinesCount: number;
    turnCount: number;
    averageLineLengthMeters: number;
    surveyAreaM2: number;
    groundCoverageWidthMeters: number;
    groundCoverageHeightMeters: number;
    gsdCmPerPixel: number;
    passACount?: { lines: number; photos: number };
    passBCount?: { lines: number; photos: number };
  };
  sampleFootprints?: CameraFootprintBox[];
  validationStatus: ValidationStatus;
  validationIssues: ValidationIssue[];
}
