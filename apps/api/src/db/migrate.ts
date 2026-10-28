import { pool } from './index.js';

export async function runMigrations() {
  console.log('[Migration] Starting PostGIS schema migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN;');

    // Extensions
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "postgis";
    `);

    // Enums
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'project_manager', 'analyst', 'viewer');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE area_status AS ENUM ('active', 'monitoring', 'archived');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE asset_type AS ENUM (
          'orthomosaic', 'cog_raster', 'dsm_raster', 'dtm_raster', 
          'point_cloud_las', 'tiles_3d', 'geojson_vector', 'report_pdf'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE analysis_type AS ENUM ('level1_image', 'level2_elevation', 'combined');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE review_status AS ENUM ('pending_review', 'verified', 'rejected');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE feature_type AS ENUM (
          'earthwork_cut', 'earthwork_fill', 'construction_new', 
          'vegetation_clearing', 'water_body_change', 'unclassified_anomaly'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE annotation_status AS ENUM (
          'candidate', 'confirmed_change', 
          'false_positive_shadow', 'false_positive_vegetation', 'false_positive_misalignment'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // Organizations
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        role user_role NOT NULL DEFAULT 'viewer',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Projects
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Managed Areas with PostGIS Polygon geometry
    await client.query(`
      CREATE TABLE IF NOT EXISTS managed_areas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        boundary GEOMETRY(Polygon, 4326) NOT NULL,
        area_sqm DOUBLE PRECISION NOT NULL,
        status area_status DEFAULT 'active',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_managed_areas_boundary_gist ON managed_areas USING GIST (boundary);
      CREATE INDEX IF NOT EXISTS idx_managed_areas_project_id ON managed_areas (project_id);
    `);

    // Area Members
    await client.query(`
      CREATE TABLE IF NOT EXISTS area_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        area_id UUID NOT NULL REFERENCES managed_areas(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'viewer',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(area_id, user_id)
      );
    `);

    // Drone Surveys
    await client.query(`
      CREATE TABLE IF NOT EXISTS drone_surveys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        area_id UUID NOT NULL REFERENCES managed_areas(id) ON DELETE CASCADE,
        survey_code VARCHAR(50) NOT NULL,
        survey_date TIMESTAMPTZ NOT NULL,
        drone_model VARCHAR(100),
        sensor_type VARCHAR(100),
        flight_altitude_m NUMERIC(6,2),
        ground_sample_distance_cm NUMERIC(4,2),
        crs_horizontal VARCHAR(50) DEFAULT 'EPSG:4326',
        crs_vertical VARCHAR(50) DEFAULT 'EGM96 / WGS84 Ellipsoid',
        processing_status processing_status DEFAULT 'pending',
        processing_logs JSONB DEFAULT '[]',
        quality_metrics JSONB DEFAULT '{}',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_drone_surveys_area_id ON drone_surveys (area_id);
      CREATE INDEX IF NOT EXISTS idx_drone_surveys_date ON drone_surveys (survey_date);
    `);

    // Survey Assets
    await client.query(`
      CREATE TABLE IF NOT EXISTS survey_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        survey_id UUID NOT NULL REFERENCES drone_surveys(id) ON DELETE CASCADE,
        asset_type asset_type NOT NULL,
        storage_bucket VARCHAR(100) NOT NULL,
        storage_key VARCHAR(500) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size_bytes BIGINT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        checksum_sha256 VARCHAR(64) NOT NULL,
        bounding_box GEOMETRY(Polygon, 4326),
        resolution_m_per_px NUMERIC(6,4),
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_survey_assets_survey_id ON survey_assets (survey_id);
      CREATE INDEX IF NOT EXISTS idx_survey_assets_bbox_gist ON survey_assets USING GIST (bounding_box);
    `);

    // Processing Jobs
    await client.query(`
      CREATE TABLE IF NOT EXISTS processing_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        survey_id UUID REFERENCES drone_surveys(id) ON DELETE CASCADE,
        job_type VARCHAR(50) NOT NULL,
        bullmq_job_id VARCHAR(100),
        status VARCHAR(50) DEFAULT 'queued',
        progress_percent INT DEFAULT 0,
        error_message TEXT,
        logs JSONB DEFAULT '[]',
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Change Analyses
    await client.query(`
      CREATE TABLE IF NOT EXISTS change_analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        area_id UUID NOT NULL REFERENCES managed_areas(id) ON DELETE CASCADE,
        baseline_survey_id UUID NOT NULL REFERENCES drone_surveys(id),
        comparison_survey_id UUID NOT NULL REFERENCES drone_surveys(id),
        analysis_type analysis_type NOT NULL,
        total_change_area_sqm DOUBLE PRECISION DEFAULT 0,
        cut_volume_m3 DOUBLE PRECISION DEFAULT 0,
        fill_volume_m3 DOUBLE PRECISION DEFAULT 0,
        net_volume_m3 DOUBLE PRECISION DEFAULT 0,
        sign_convention VARCHAR(100) DEFAULT 'Positive=Fill/ElevationGain, Negative=Cut/Excavation',
        confidence_score NUMERIC(3,2) DEFAULT 0.90,
        status review_status DEFAULT 'pending_review',
        limitations_notes TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Change Features
    await client.query(`
      CREATE TABLE IF NOT EXISTS change_features (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        change_analysis_id UUID NOT NULL REFERENCES change_analyses(id) ON DELETE CASCADE,
        feature_type feature_type NOT NULL,
        geometry GEOMETRY(Polygon, 4326) NOT NULL,
        area_sqm DOUBLE PRECISION NOT NULL,
        mean_elevation_change_m NUMERIC(6,3),
        max_elevation_change_m NUMERIC(6,3),
        estimated_volume_m3 DOUBLE PRECISION,
        is_confirmed BOOLEAN DEFAULT FALSE,
        confidence NUMERIC(3,2) DEFAULT 0.85,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_change_features_geometry_gist ON change_features USING GIST (geometry);
      CREATE INDEX IF NOT EXISTS idx_change_features_analysis_id ON change_features (change_analysis_id);
    `);

    // Analyst Annotations
    await client.query(`
      CREATE TABLE IF NOT EXISTS analyst_annotations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        change_feature_id UUID NOT NULL REFERENCES change_features(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id),
        status annotation_status NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Reports
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        area_id UUID NOT NULL REFERENCES managed_areas(id) ON DELETE CASCADE,
        change_analysis_id UUID REFERENCES change_analyses(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        report_type VARCHAR(50) NOT NULL,
        format VARCHAR(20) NOT NULL,
        file_storage_key VARCHAR(500),
        metadata JSONB DEFAULT '{}',
        generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Audit Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id UUID NOT NULL,
        ip_address VARCHAR(45),
        user_agent VARCHAR(255),
        payload_diff JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
    `);

    await client.query('COMMIT;');
    console.log('[Migration] Database schema migration completed successfully.');

    // Run Operations module migration
    const { runOperationsMigrations } = await import('./operations-migrate.js');
    await runOperationsMigrations();

    // Run Symbol Catalog & Drawing Tools migration
    const { runSymbolsMigrations } = await import('./symbols-migrate.js');
    await runSymbolsMigrations();

    // Run Drone Mission Planner migration
    const { runDroneMissionsMigrations } = await import('./drone-missions-migrate.js');
    await runDroneMissionsMigrations();

    // Run KML / KMZ Layers migration (Phase 10)
    const { runKmlLayersMigrations } = await import('./kml-layers-migrate.js');
    await runKmlLayersMigrations();
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[Migration] Migration failed:', err);
    throw err;

  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

