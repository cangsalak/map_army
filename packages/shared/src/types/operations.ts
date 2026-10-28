/**
 * Personnel & Field Operations Mapping Types
 */

export type TeamStatus = 'active' | 'standby' | 'deployed' | 'inactive';

export type TeamRole = 'leader' | 'operator' | 'medic' | 'scout' | 'analyst';

export type LocationType =
  | 'base_camp'
  | 'staging_area'
  | 'observation_post'
  | 'checkpoint'
  | 'incident_site'
  | 'work_zone';

export type LayerType =
  | 'personnel'
  | 'team_locations'
  | 'simulation_trail'
  | 'hazard_zone'
  | 'boundary'
  | 'custom_vector'
  | 'imported_kml';

export type FeatureGeometryType =
  | 'Point'
  | 'LineString'
  | 'Polygon'
  | 'MultiPoint'
  | 'MultiLineString'
  | 'MultiPolygon';

export type SimulationStatus = 'draft' | 'ready' | 'running' | 'completed';

export type FreshnessStatus = 'live' | 'stale' | 'unavailable' | 'simulated';

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: number[][]; // [ [lng, lat], [lng, lat], ... ]
}

export interface GeoJSONFeature<G = any, P = any> {
  type: 'Feature';
  id?: string;
  geometry: G;
  properties: P;
}

export interface GeoJSONFeatureCollection<G = any, P = any> {
  type: 'FeatureCollection';
  features: GeoJSONFeature<G, P>[];
}

export interface TeamMemberDTO {
  id: string;
  teamId: string;
  userId?: string | null;
  callsign: string;
  roleInTeam: TeamRole;
  isActive: boolean;
  joinedAt: string;
}

export interface TeamDTO {
  id: string;
  organizationId: string;
  projectId: string;
  projectName?: string;
  name: string;
  identifier: string; // e.g. "SAR-ALPHA-1"
  description: string | null;
  status: TeamStatus;
  teamLeaderId?: string | null;
  teamLeaderName?: string | null;
  memberCount?: number;
  members?: TeamMemberDTO[];
  latestLocation?: {
    latitude: number;
    longitude: number;
    altitudeM?: number | null;
    timestamp: string;
    freshness: FreshnessStatus;
  } | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamLocationDTO {
  id: string;
  organizationId: string;
  projectId: string;
  projectName?: string;
  teamId?: string | null;
  teamName?: string | null;
  name: string;
  locationType: LocationType;
  geometry: GeoJSONPoint | { type: 'Polygon'; coordinates: number[][][] };
  description: string | null;
  status: 'active' | 'temporary' | 'inactive';
  validFrom: string | null;
  validTo: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MapLayerDTO {
  id: string;
  projectId: string;
  name: string;
  layerType: LayerType;
  visibility: boolean;
  opacity: number;
  isEditable: boolean;
  colorHex: string;
  permissions: {
    canEditRoles: string[];
    canViewRoles: string[];
  };
  featureCount?: number;
  originalFilename?: string | null;
  fileFormat?: string | null;
  sourceMetadata?: Record<string, any> | null;
  coordinateReferenceSystem?: string | null;
  altitudeReference?: string | null;
  importStatus?: string | null;
  validationWarnings?: string[] | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MapFeatureDTO {
  id: string;
  layerId: string;
  featureType: FeatureGeometryType;
  geometry: any; // GeoJSON geometry
  properties: {
    name?: string;
    description?: string;
    color?: string;
    strokeWidth?: number;
    icon?: string;
    [key: string]: any;
  };
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationParticipantDTO {
  id: string;
  sessionId: string;
  teamId?: string | null;
  teamName?: string | null;
  name: string;
  callsign: string;
  iconSymbol: string;
  colorHex: string;
}

export interface SimulatedPositionDTO {
  id: string;
  participantId: string;
  participantCallsign?: string;
  timestamp: string; // ISO 8601
  latitude: number;
  longitude: number;
  altitudeM: number;
  headingDeg: number;
  speedMps: number;
  metadata?: Record<string, any>;
}

export interface SimulationSessionDTO {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  status: SimulationStatus;
  speedMultiplier: number;
  participantCount?: number;
  participants?: SimulationParticipantDTO[];
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthorizedLocationUpdateDTO {
  id: string;
  organizationId: string;
  projectId: string;
  teamId?: string | null;
  teamName?: string | null;
  deviceIdentifier: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  altitudeM?: number | null;
  accuracyM?: number | null;
  source: 'field_app' | 'manual_entry' | 'vehicle_tracker';
  freshnessStatus: FreshnessStatus;
  consentConfirmed: boolean;
  createdAt: string;
}
