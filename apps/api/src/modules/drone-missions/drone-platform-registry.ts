/**
 * GeoMonitor 3D — Multi-Platform Drone Adapter Registry (Backend API Service)
 */

import {
  PlatformId,
  PlatformCapabilities,
  DroneMissionDTO,
  ValidationIssue,
  AdapterExecutionResult,
  TelemetryDTO,
} from '@geomonitor/shared';

export const PLATFORM_REGISTRY: Record<PlatformId, PlatformCapabilities> = {
  dji_mini_4_pro: {
    platformId: 'dji_mini_4_pro',
    platformName: 'DJI Mini 4 Pro (MSDK V5 Android Bridge)',
    manufacturer: 'DJI',
    supportedMissionTypes: [
      'grid_survey',
      'crosshatch_survey',
      'waypoint_mission',
      'corridor_mapping',
      'polygon_survey',
      'orbit_poi',
    ],
    supportedAltitudeReferences: ['relative_to_home', 'amsl'],
    maxWaypoints: 99,
    maxFlightDistanceMeters: 15000,
    maxAltitudeMeters: 120,
    supportsLiveUpload: true,
    supportsPauseResume: true,
    supportsNativeFileExport: false,
    supportedExportFormats: ['generic_geojson', 'internal_json'],
    requiredSdkOrTool: 'DJI Mobile SDK V5.13.0+ (Android)',
    requiredController: 'DJI RC-N2 (USB-C to Android Mobile Device)',
    knownLimitations: [
      'DJI Fly application has NO official file import feature for .kmz/.kml flight plans.',
      'Autonomous flight requires GeoMonitor Drone Bridge Android app connected to DJI RC-N2.',
      'DJI RC 2 (remote with built-in screen) does NOT support third-party MSDK app sideloading.',
      'Maximum 99 waypoints supported per Waypoint V3 mission block.',
    ],
    verificationStatus: 'VERIFIED_WITH_LIMITATIONS',
  },

  dji_enterprise_wpml: {
    platformId: 'dji_enterprise_wpml',
    platformName: 'DJI Enterprise (M350 RTK, M300, Mavic 3E/3T, Inspire 3)',
    manufacturer: 'DJI Enterprise',
    supportedMissionTypes: [
      'grid_survey',
      'crosshatch_survey',
      'corridor_mapping',
      'waypoint_mission',
      'polygon_survey',
      'orbit_poi',
      'camera_inspection',
    ],
    supportedAltitudeReferences: ['relative_to_home', 'agl', 'amsl'],
    maxWaypoints: 65535,
    maxFlightDistanceMeters: 50000,
    maxAltitudeMeters: 500,
    supportsLiveUpload: true,
    supportsPauseResume: true,
    supportsNativeFileExport: true,
    supportedExportFormats: ['dji_pilot_wpml', 'generic_geojson', 'internal_json'],
    requiredSdkOrTool: 'DJI Pilot 2 / WPML 1.0 Spec / DJI Cloud API',
    requiredController: 'DJI RC Plus / Smart Controller Enterprise',
    knownLimitations: [
      'Requires Enterprise-tier aircraft with DJI Pilot 2 application installed.',
    ],
    verificationStatus: 'VERIFIED',
  },

  px4_mavlink: {
    platformId: 'px4_mavlink',
    platformName: 'PX4 Autopilot (MAVLink v2 / QGroundControl)',
    manufacturer: 'PX4 / Dronecode Foundation',
    supportedMissionTypes: [
      'grid_survey',
      'crosshatch_survey',
      'corridor_mapping',
      'waypoint_mission',
      'polygon_survey',
      'orbit_poi',
      'manual_route',
    ],
    supportedAltitudeReferences: ['relative_to_home', 'amsl', 'agl'],
    maxWaypoints: 2000,
    maxFlightDistanceMeters: 100000,
    maxAltitudeMeters: 500,
    supportsLiveUpload: true,
    supportsPauseResume: true,
    supportsNativeFileExport: true,
    supportedExportFormats: ['qgroundcontrol_plan', 'generic_geojson', 'internal_json'],
    requiredSdkOrTool: 'QGroundControl / MAVLink v2 Mission Protocol',
    requiredController: 'Any Telemetry Radio / GCS (Herelink, SIYI, PC QGC)',
    knownLimitations: [
      'Terrain clearance (AGL) relies on QGroundControl elevation service or onboard LiDAR sensor.',
    ],
    verificationStatus: 'VERIFIED',
  },

  ardupilot_mavlink: {
    platformId: 'ardupilot_mavlink',
    platformName: 'ArduPilot (ArduCopter / Mission Planner)',
    manufacturer: 'ArduPilot Project',
    supportedMissionTypes: [
      'grid_survey',
      'crosshatch_survey',
      'corridor_mapping',
      'waypoint_mission',
      'polygon_survey',
      'orbit_poi',
      'manual_route',
    ],
    supportedAltitudeReferences: ['relative_to_home', 'amsl', 'agl'],
    maxWaypoints: 2500,
    maxFlightDistanceMeters: 100000,
    maxAltitudeMeters: 500,
    supportsLiveUpload: true,
    supportsPauseResume: true,
    supportsNativeFileExport: true,
    supportedExportFormats: ['ardupilot_waypoints', 'qgroundcontrol_plan', 'generic_geojson', 'internal_json'],
    requiredSdkOrTool: 'Mission Planner / MAVProxy / QGC',
    requiredController: 'Any MAVLink Telemetry GCS',
    knownLimitations: [
      'Requires TERRAIN_ENABLE=1 in ArduPilot parameters for true terrain following.',
    ],
    verificationStatus: 'VERIFIED',
  },
};

export function validatePlatformCompatibility(
  platformId: PlatformId,
  mission: Partial<DroneMissionDTO>,
  waypointCount: number,
  totalDistanceMeters: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const caps = PLATFORM_REGISTRY[platformId];

  if (!caps) {
    issues.push({
      category: 'platform',
      level: 'error',
      code: 'UNKNOWN_PLATFORM',
      message: `ไม่พบแพลตฟอร์ม ${platformId} ในระบบ Capability Registry`,
    });
    return issues;
  }

  if (mission.missionType && !caps.supportedMissionTypes.includes(mission.missionType)) {
    issues.push({
      category: 'platform',
      level: 'error',
      code: 'UNSUPPORTED_MISSION_TYPE',
      message: `แพลตฟอร์ม ${caps.platformName} ไม่รองรับภารกิจประเภท ${mission.missionType}`,
    });
  }

  if (mission.altitudeReference && !caps.supportedAltitudeReferences.includes(mission.altitudeReference)) {
    issues.push({
      category: 'altitude',
      level: 'error',
      code: 'UNSUPPORTED_ALTITUDE_REF',
      message: `แพลตฟอร์ม ${caps.platformName} ไม่รองรับโหมดความสูงแบบ ${mission.altitudeReference}`,
    });
  }

  if (waypointCount > caps.maxWaypoints) {
    issues.push({
      category: 'aircraft',
      level: 'error',
      code: 'WAYPOINT_LIMIT_EXCEEDED',
      message: `จำนวนจุด Waypoint (${waypointCount} จุด) เกินขีดจำกัดสูงสุดของ ${caps.platformName} (สูงสุด ${caps.maxWaypoints} จุด)`,
    });
  }

  if (totalDistanceMeters > caps.maxFlightDistanceMeters) {
    issues.push({
      category: 'operational',
      level: 'error',
      code: 'DISTANCE_LIMIT_EXCEEDED',
      message: `ระยะทางบินรวม (${(totalDistanceMeters / 1000).toFixed(1)} km) เกินระยะปลอดภัยของ ${caps.platformName} (${(caps.maxFlightDistanceMeters / 1000).toFixed(1)} km)`,
    });
  }

  return issues;
}
