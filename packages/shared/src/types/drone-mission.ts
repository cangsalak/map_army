/**
 * GeoMonitor 3D — Multi-Platform Drone Mission Types & Interfaces
 */

export type DroneMissionType =
  | 'grid_survey'
  | 'crosshatch_survey'
  | 'corridor_mapping'
  | 'waypoint_mission'
  | 'polygon_survey'
  | 'orbit_poi'
  | 'manual_route'
  | 'camera_inspection';

export type AltitudeReference = 'relative_to_home' | 'agl' | 'amsl';

export type FinishAction = 'return_to_home' | 'land_at_last_waypoint' | 'hover';

export type SignalLossAction = 'return_to_home' | 'hover_and_wait' | 'continue_mission';

export type TurnStrategy = 'stop_and_turn' | 'bank_turn' | 'adaptive_curve';

export type PlatformId =
  | 'dji_mini_4_pro'
  | 'dji_enterprise_wpml'
  | 'px4_mavlink'
  | 'ardupilot_mavlink';

export type ExportPlatform =
  | 'dji_pilot_wpml'
  | 'standard_kml'
  | 'standard_kmz'
  | 'qgroundcontrol_plan'
  | 'ardupilot_waypoints'
  | 'generic_geojson'
  | 'internal_json';

export type ValidationStatus = 'PASS' | 'WARNING' | 'BLOCKED' | 'NOT_VERIFIED';

export type MissionWorkflowState =
  | 'EMPTY'
  | 'AREA_DEFINED'
  | 'CONFIGURING'
  | 'READY_TO_CALCULATE'
  | 'CALCULATING'
  | 'CALCULATED'
  | 'OUTDATED'
  | 'VALIDATION_FAILED'
  | 'EXPORT_READY';

export interface ValidationIssue {
  category: 'geometry' | 'altitude' | 'aircraft' | 'operational' | 'data' | 'platform';
  level: 'warning' | 'error' | 'info';
  code: string;
  message: string;
  waypointIndex?: number;
}

export interface CameraParameters {
  name: string;
  sensorWidthMm: number;
  sensorHeightMm: number;
  focalLengthMm: number;
  imageWidthPx: number;
  imageHeightPx: number;
  forwardOverlapPercent: number; // e.g. 75
  sideOverlapPercent: number; // e.g. 70
}

export interface PhotogrammetryEstimates {
  gsdCmPerPixel: number;
  groundCoverageWidthMeters: number;
  groundCoverageHeightMeters: number;
  flightLineSpacingMeters: number;
  photoTriggerDistanceMeters: number;
  estimatedPhotoCount: number;
  estimatedFlightDistanceMeters: number;
  estimatedFlightTimeSeconds: number;
  batteryCountNeeded: number;
}

export interface DroneWaypointDTO {
  id?: string;
  sequence: number;
  longitude: number;
  latitude: number;
  altitudeMeters: number;
  altitudeReference?: AltitudeReference;
  speedMps?: number;
  turnMode?: TurnStrategy;
  headingDeg?: number;
  gimbalPitchDeg?: number;
  hoverDurationSec?: number;
  action?: 'take_photo' | 'start_recording' | 'stop_recording' | 'hover' | 'none';
  actionParam?: number;
  poiReference?: [number, number, number]; // [lon, lat, alt]
}

export interface CoordinateReferenceSystem {
  horizontalCrs: string; // e.g. "EPSG:4326 (WGS84)"
  verticalDatum: string; // e.g. "EGM96" | "Ellipsoidal"
  coordinateUnits: 'degrees' | 'meters';
}

import { GeoJSONPolygon } from './index.js';

export interface DroneMissionDTO {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  version: string; // e.g. "2.0.0"
  targetPlatform: PlatformId;
  missionType: DroneMissionType;
  droneModel: string;
  firmwareVersion?: string;
  crs: CoordinateReferenceSystem;
  cameraParams: CameraParameters;
  altitudeReference: AltitudeReference;
  flightAltitudeMeters: number;
  flightSpeedMps: number;
  maxAltitudeMeters: number;
  returnToHomeAltitudeMeters: number;
  surveyArea?: GeoJSONPolygon;
  homePoint: [number, number, number]; // [lon, lat, alt]
  takeoffPoint?: [number, number, number];
  landingPoint?: [number, number, number];
  gridAngleDeg: number;
  turnStrategy: TurnStrategy;
  finishAction: FinishAction;
  signalLossAction: SignalLossAction;
  waypoints: DroneWaypointDTO[];
  estimates?: PhotogrammetryEstimates;
  validationStatus: ValidationStatus;
  validationIssues?: ValidationIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDroneMissionDTO {
  projectId: string;
  name: string;
  description?: string;
  version?: string;
  targetPlatform?: PlatformId;
  missionType?: DroneMissionType;
  droneModel?: string;
  firmwareVersion?: string;
  cameraParams?: Partial<CameraParameters>;
  altitudeReference?: AltitudeReference;
  flightAltitudeMeters?: number;
  flightSpeedMps?: number;
  maxAltitudeMeters?: number;
  returnToHomeAltitudeMeters?: number;
  surveyArea?: GeoJSONPolygon;
  homePoint?: [number, number, number];
  takeoffPoint?: [number, number, number];
  landingPoint?: [number, number, number];
  gridAngleDeg?: number;
  turnStrategy?: TurnStrategy;
  finishAction?: FinishAction;
  signalLossAction?: SignalLossAction;
  waypoints?: DroneWaypointDTO[];
}

export interface PlatformCapabilities {
  platformId: PlatformId;
  platformName: string;
  manufacturer: string;
  supportedMissionTypes: DroneMissionType[];
  supportedAltitudeReferences: AltitudeReference[];
  maxWaypoints: number;
  maxFlightDistanceMeters: number;
  maxAltitudeMeters: number;
  supportsLiveUpload: boolean;
  supportsPauseResume: boolean;
  supportsNativeFileExport: boolean;
  supportedExportFormats: ExportPlatform[];
  requiredSdkOrTool: string;
  requiredController: string;
  knownLimitations: string[];
  verificationStatus: 'VERIFIED' | 'VERIFIED_WITH_LIMITATIONS' | 'NEEDS_DEVICE_TEST' | 'NOT_SUPPORTED';
}

export interface AdapterExecutionResult<T = any> {
  status: 'SUCCESS' | 'NOT_SUPPORTED' | 'FAILED' | 'BLOCKED';
  code: string;
  message: string;
  data?: T;
  timestamp: string;
}

export interface TelemetryDTO {
  missionId?: string;
  latitude: number;
  longitude: number;
  altitudeMetersAmsl: number;
  altitudeMetersRelative: number;
  headingDeg: number;
  pitchDeg: number;
  batteryPercent: number;
  satellitesCount: number;
  flightMode: string;
  isFlying: boolean;
  currentWaypointIndex: number;
  timestamp: string;
}
