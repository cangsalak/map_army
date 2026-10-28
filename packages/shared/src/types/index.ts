/**
 * Shared Type Definitions for GeoMonitor 3D
 */

export type UserRole = 'admin' | 'project_manager' | 'analyst' | 'viewer';

export type AreaStatus = 'active' | 'monitoring' | 'archived';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type AssetType =
  | 'orthomosaic'
  | 'cog_raster'
  | 'dsm_raster'
  | 'dtm_raster'
  | 'point_cloud_las'
  | 'tiles_3d'
  | 'geojson_vector'
  | 'report_pdf';

export type AnalysisType = 'level1_image' | 'level2_elevation' | 'combined';

export type ReviewStatus = 'pending_review' | 'verified' | 'rejected';

export type FeatureType =
  | 'earthwork_cut'
  | 'earthwork_fill'
  | 'construction_new'
  | 'vegetation_clearing'
  | 'water_body_change'
  | 'unclassified_anomaly';

export type AnnotationStatus =
  | 'candidate'
  | 'confirmed_change'
  | 'false_positive_shadow'
  | 'false_positive_vegetation'
  | 'false_positive_misalignment';

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // [ [ [lng, lat], [lng, lat], ... ] ]
}

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId?: string | null;
  organizationName?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ManagedAreaDTO {
  id: string;
  projectId: string;
  projectName?: string;
  name: string;
  description: string | null;
  boundary: GeoJSONPolygon;
  areaSqm: number;
  status: AreaStatus;
  surveyCount?: number;
  latestSurveyDate?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DroneSurveyDTO {
  id: string;
  areaId: string;
  surveyCode: string;
  surveyDate: string;
  droneModel: string | null;
  sensorType: string | null;
  flightAltitudeM: number | null;
  groundSampleDistanceCm: number | null;
  crsHorizontal: string;
  crsVertical: string;
  processingStatus: ProcessingStatus;
  processingLogs?: Array<{ timestamp: string; message: string; level: string }>;
  qualityMetrics?: {
    reprojectionErrorPx?: number;
    alignedPhotos?: number;
    tiePoints?: number;
    groundResolutionMm?: number;
  };
  assetCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyAssetDTO {
  id: string;
  surveyId: string;
  assetType: AssetType;
  storageBucket: string;
  storageKey: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  checksumSha256: string;
  boundingBox?: GeoJSONPolygon | null;
  resolutionMPerPx?: number | null;
  isPrimary: boolean;
  downloadUrl?: string;
  createdAt: string;
}

export interface ChangeAnalysisDTO {
  id: string;
  areaId: string;
  areaName?: string;
  baselineSurveyId: string;
  baselineSurveyDate?: string;
  comparisonSurveyId: string;
  comparisonSurveyDate?: string;
  analysisType: AnalysisType;
  totalChangeAreaSqm: number;
  cutVolumeM3: number;
  fillVolumeM3: number;
  netVolumeM3: number;
  signConvention: string;
  confidenceScore: number;
  status: ReviewStatus;
  limitationsNotes: string | null;
  featureCount?: number;
  createdAt: string;
}

export interface ChangeFeatureDTO {
  id: string;
  changeAnalysisId: string;
  featureType: FeatureType;
  geometry: GeoJSONPolygon;
  areaSqm: number;
  meanElevationChangeM?: number | null;
  maxElevationChangeM?: number | null;
  estimatedVolumeM3?: number | null;
  isConfirmed: boolean;
  confidence: number;
  annotations?: Array<{
    id: string;
    authorName: string;
    status: AnnotationStatus;
    notes: string | null;
    createdAt: string;
  }>;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
