import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  doublePrecision,
  integer,
  bigint,
  jsonb,
  pgEnum,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';

// PostGIS Geometry custom type
export const geometry = (name: string, srid = 4326) =>
  customType<{ data: string; driverData: string }>({
    dataType() {
      return `geometry(Polygon, ${srid})`;
    },
  })(name);

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'project_manager', 'analyst', 'viewer']);
export const areaStatusEnum = pgEnum('area_status', ['active', 'monitoring', 'archived']);
export const processingStatusEnum = pgEnum('processing_status', ['pending', 'processing', 'completed', 'failed']);
export const assetTypeEnum = pgEnum('asset_type', [
  'orthomosaic',
  'cog_raster',
  'dsm_raster',
  'dtm_raster',
  'point_cloud_las',
  'tiles_3d',
  'geojson_vector',
  'report_pdf',
]);
export const analysisTypeEnum = pgEnum('analysis_type', ['level1_image', 'level2_elevation', 'combined']);
export const reviewStatusEnum = pgEnum('review_status', ['pending_review', 'verified', 'rejected']);
export const featureTypeEnum = pgEnum('feature_type', [
  'earthwork_cut',
  'earthwork_fill',
  'construction_new',
  'vegetation_clearing',
  'water_body_change',
  'unclassified_anomaly',
]);
export const annotationStatusEnum = pgEnum('annotation_status', [
  'candidate',
  'confirmed_change',
  'false_positive_shadow',
  'false_positive_vegetation',
  'false_positive_misalignment',
]);

// 1. Organizations
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  role: userRoleEnum('role').default('viewer').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Projects
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. Managed Areas (PostGIS Polygon)
export const managedAreas = pgTable(
  'managed_areas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    boundary: geometry('boundary', 4326).notNull(),
    areaSqm: doublePrecision('area_sqm').notNull(),
    status: areaStatusEnum('status').default('active').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_managed_areas_boundary_gist').using('gist', table.boundary),
    index('idx_managed_areas_project_id').on(table.projectId),
  ]
);

// 5. Area Members
export const areaMembers = pgTable('area_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  areaId: uuid('area_id')
    .references(() => managedAreas.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  role: varchar('role', { length: 50 }).default('viewer').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 6. Drone Surveys
export const droneSurveys = pgTable(
  'drone_surveys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    areaId: uuid('area_id')
      .references(() => managedAreas.id, { onDelete: 'cascade' })
      .notNull(),
    surveyCode: varchar('survey_code', { length: 50 }).notNull(),
    surveyDate: timestamp('survey_date', { withTimezone: true }).notNull(),
    droneModel: varchar('drone_model', { length: 100 }),
    sensorType: varchar('sensor_type', { length: 100 }),
    flightAltitudeM: numeric('flight_altitude_m', { precision: 6, scale: 2 }),
    groundSampleDistanceCm: numeric('ground_sample_distance_cm', { precision: 4, scale: 2 }),
    crsHorizontal: varchar('crs_horizontal', { length: 50 }).default('EPSG:4326').notNull(),
    crsVertical: varchar('crs_vertical', { length: 50 }).default('EGM96 / WGS84 Ellipsoid').notNull(),
    processingStatus: processingStatusEnum('processing_status').default('pending').notNull(),
    processingLogs: jsonb('processing_logs').default(sql`'[]'::jsonb`),
    qualityMetrics: jsonb('quality_metrics').default(sql`'{}'::jsonb`),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_drone_surveys_area_id').on(table.areaId),
    index('idx_drone_surveys_date').on(table.surveyDate),
  ]
);

// 7. Survey Assets
export const surveyAssets = pgTable(
  'survey_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    surveyId: uuid('survey_id')
      .references(() => droneSurveys.id, { onDelete: 'cascade' })
      .notNull(),
    assetType: assetTypeEnum('asset_type').notNull(),
    storageBucket: varchar('storage_bucket', { length: 100 }).notNull(),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    checksumSha256: varchar('checksum_sha256', { length: 64 }).notNull(),
    boundingBox: geometry('bounding_box', 4326),
    resolutionMPerPx: numeric('resolution_m_per_px', { precision: 6, scale: 4 }),
    isPrimary: boolean('is_primary').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_survey_assets_survey_id').on(table.surveyId)]
);

// 8. Processing Jobs
export const processingJobs = pgTable('processing_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  surveyId: uuid('survey_id').references(() => droneSurveys.id, { onDelete: 'cascade' }),
  jobType: varchar('job_type', { length: 50 }).notNull(),
  bullmqJobId: varchar('bullmq_job_id', { length: 100 }),
  status: varchar('status', { length: 50 }).default('queued').notNull(),
  progressPercent: integer('progress_percent').default(0).notNull(),
  errorMessage: text('error_message'),
  logs: jsonb('logs').default(sql`'[]'::jsonb`),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 9. Change Analyses
export const changeAnalyses = pgTable('change_analyses', {
  id: uuid('id').defaultRandom().primaryKey(),
  areaId: uuid('area_id')
    .references(() => managedAreas.id, { onDelete: 'cascade' })
    .notNull(),
  baselineSurveyId: uuid('baseline_survey_id')
    .references(() => droneSurveys.id)
    .notNull(),
  comparisonSurveyId: uuid('comparison_survey_id')
    .references(() => droneSurveys.id)
    .notNull(),
  analysisType: analysisTypeEnum('analysis_type').notNull(),
  totalChangeAreaSqm: doublePrecision('total_change_area_sqm').default(0).notNull(),
  cutVolumeM3: doublePrecision('cut_volume_m3').default(0).notNull(),
  fillVolumeM3: doublePrecision('fill_volume_m3').default(0).notNull(),
  netVolumeM3: doublePrecision('net_volume_m3').default(0).notNull(),
  signConvention: varchar('sign_convention', { length: 100 })
    .default('Positive=Fill/ElevationGain, Negative=Cut/Excavation')
    .notNull(),
  confidenceScore: numeric('confidence_score', { precision: 3, scale: 2 }).default('0.90').notNull(),
  status: reviewStatusEnum('status').default('pending_review').notNull(),
  limitationsNotes: text('limitations_notes'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 10. Change Features
export const changeFeatures = pgTable(
  'change_features',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    changeAnalysisId: uuid('change_analysis_id')
      .references(() => changeAnalyses.id, { onDelete: 'cascade' })
      .notNull(),
    featureType: featureTypeEnum('feature_type').notNull(),
    geometry: geometry('geometry', 4326).notNull(),
    areaSqm: doublePrecision('area_sqm').notNull(),
    meanElevationChangeM: numeric('mean_elevation_change_m', { precision: 6, scale: 3 }),
    maxElevationChangeM: numeric('max_elevation_change_m', { precision: 6, scale: 3 }),
    estimatedVolumeM3: doublePrecision('estimated_volume_m3'),
    isConfirmed: boolean('is_confirmed').default(false).notNull(),
    confidence: numeric('confidence', { precision: 3, scale: 2 }).default('0.85').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_change_features_geometry_gist').using('gist', table.geometry),
    index('idx_change_features_analysis_id').on(table.changeAnalysisId),
  ]
);

// 11. Analyst Annotations
export const analystAnnotations = pgTable('analyst_annotations', {
  id: uuid('id').defaultRandom().primaryKey(),
  changeFeatureId: uuid('change_feature_id')
    .references(() => changeFeatures.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: uuid('author_id')
    .references(() => users.id)
    .notNull(),
  status: annotationStatusEnum('status').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 12. Reports
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  areaId: uuid('area_id')
    .references(() => managedAreas.id, { onDelete: 'cascade' })
    .notNull(),
  changeAnalysisId: uuid('change_analysis_id').references(() => changeAnalyses.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  reportType: varchar('report_type', { length: 50 }).notNull(),
  format: varchar('format', { length: 20 }).notNull(),
  fileStorageKey: varchar('file_storage_key', { length: 500 }),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  generatedBy: uuid('generated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 13. Audit Logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 50 }).notNull(),
    resourceId: uuid('resource_id').notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 255 }),
    payloadDiff: jsonb('payload_diff'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_logs_action').on(table.action),
    index('idx_audit_logs_created_at').on(table.createdAt),
  ]
);

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  managedAreas: many(managedAreas),
}));

export const managedAreasRelations = relations(managedAreas, ({ one, many }) => ({
  project: one(projects, {
    fields: [managedAreas.projectId],
    references: [projects.id],
  }),
  surveys: many(droneSurveys),
  changeAnalyses: many(changeAnalyses),
  members: many(areaMembers),
  reports: many(reports),
}));

export const droneSurveysRelations = relations(droneSurveys, ({ one, many }) => ({
  area: one(managedAreas, {
    fields: [droneSurveys.areaId],
    references: [managedAreas.id],
  }),
  assets: many(surveyAssets),
  processingJobs: many(processingJobs),
}));

export const changeAnalysesRelations = relations(changeAnalyses, ({ one, many }) => ({
  area: one(managedAreas, {
    fields: [changeAnalyses.areaId],
    references: [managedAreas.id],
  }),
  baselineSurvey: one(droneSurveys, {
    fields: [changeAnalyses.baselineSurveyId],
    references: [droneSurveys.id],
  }),
  comparisonSurvey: one(droneSurveys, {
    fields: [changeAnalyses.comparisonSurveyId],
    references: [droneSurveys.id],
  }),
  features: many(changeFeatures),
}));

export const changeFeaturesRelations = relations(changeFeatures, ({ one, many }) => ({
  analysis: one(changeAnalyses, {
    fields: [changeFeatures.changeAnalysisId],
    references: [changeAnalyses.id],
  }),
  annotations: many(analystAnnotations),
}));
