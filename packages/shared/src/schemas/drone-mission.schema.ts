import { z } from 'zod';

export const DroneMissionTypeSchema = z.enum([
  'grid_survey',
  'crosshatch_survey',
  'corridor_mapping',
  'waypoint_mission',
  'polygon_survey',
  'orbit_poi',
  'manual_route',
  'camera_inspection',
]);

export const AltitudeReferenceSchema = z.enum(['relative_to_home', 'agl', 'amsl']);

export const FinishActionSchema = z.enum(['return_to_home', 'land_at_last_waypoint', 'hover']);

export const SignalLossActionSchema = z.enum(['return_to_home', 'hover_and_wait', 'continue_mission']);

export const TurnStrategySchema = z.enum(['stop_and_turn', 'bank_turn', 'adaptive_curve']);

export const PlatformIdSchema = z.enum([
  'dji_mini_4_pro',
  'dji_enterprise_wpml',
  'px4_mavlink',
  'ardupilot_mavlink',
]);

export const ExportPlatformSchema = z.enum([
  'dji_pilot_wpml',
  'standard_kml',
  'standard_kmz',
  'qgroundcontrol_plan',
  'ardupilot_waypoints',
  'generic_geojson',
  'internal_json',
]);

export const CameraParametersSchema = z.object({
  name: z.string().default('DJI Zenmuse / Mavic 3E Standard Camera'),
  sensorWidthMm: z.number().positive().default(17.3),
  sensorHeightMm: z.number().positive().default(13.0),
  focalLengthMm: z.number().positive().default(12.3),
  imageWidthPx: z.number().int().positive().default(5280),
  imageHeightPx: z.number().int().positive().default(3956),
  forwardOverlapPercent: z.number().min(20).max(95).default(75),
  sideOverlapPercent: z.number().min(20).max(95).default(70),
});

export const DroneWaypointSchema = z.object({
  id: z.string().optional(),
  sequence: z.number().int().nonnegative(),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  altitudeMeters: z.number().min(1).max(500),
  altitudeReference: AltitudeReferenceSchema.optional(),
  speedMps: z.number().min(0.5).max(30).optional(),
  turnMode: TurnStrategySchema.optional(),
  headingDeg: z.number().min(0).max(360).optional(),
  gimbalPitchDeg: z.number().min(-90).max(30).optional(),
  hoverDurationSec: z.number().min(0).max(3600).optional(),
  action: z.enum(['take_photo', 'start_recording', 'stop_recording', 'hover', 'none']).optional(),
  actionParam: z.number().optional(),
  poiReference: z.tuple([z.number(), z.number(), z.number()]).optional(),
});

export const CoordinateReferenceSystemSchema = z.object({
  horizontalCrs: z.string().default('EPSG:4326 (WGS84)'),
  verticalDatum: z.string().default('EGM96'),
  coordinateUnits: z.enum(['degrees', 'meters']).default('degrees'),
});

export const CreateDroneMissionSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1, 'ต้องระบุชื่อภารกิจ').max(200),
  description: z.string().max(1000).optional(),
  version: z.string().default('2.0.0'),
  targetPlatform: PlatformIdSchema.default('dji_mini_4_pro'),
  missionType: DroneMissionTypeSchema.default('grid_survey'),
  droneModel: z.string().default('DJI Mini 4 Pro'),
  firmwareVersion: z.string().optional(),
  cameraParams: CameraParametersSchema.partial().optional(),
  altitudeReference: AltitudeReferenceSchema.default('relative_to_home'),
  flightAltitudeMeters: z.number().min(10).max(500).default(80),
  flightSpeedMps: z.number().min(1).max(25).default(8),
  maxAltitudeMeters: z.number().min(10).max(500).default(120),
  returnToHomeAltitudeMeters: z.number().min(10).max(500).default(60),
  surveyArea: z.any().optional(),
  homePoint: z.tuple([z.number(), z.number(), z.number()]).optional(),
  takeoffPoint: z.tuple([z.number(), z.number(), z.number()]).optional(),
  landingPoint: z.tuple([z.number(), z.number(), z.number()]).optional(),
  gridAngleDeg: z.number().min(0).max(360).default(0),
  turnStrategy: TurnStrategySchema.default('stop_and_turn'),
  finishAction: FinishActionSchema.default('return_to_home'),
  signalLossAction: SignalLossActionSchema.default('return_to_home'),
  waypoints: z.array(DroneWaypointSchema).optional(),
});

export const UpdateDroneMissionSchema = CreateDroneMissionSchema.partial();
