import { pool } from './index.js';

export async function runDroneMissionsMigrations() {
  console.log('[Migration] Starting Drone Mission Planner schema migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN;');

    // 1. Drone Missions
    await client.query(`
      CREATE TABLE IF NOT EXISTS drone_missions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        area_id UUID REFERENCES managed_areas(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        drone_model VARCHAR(100) NOT NULL DEFAULT 'DJI Matrice 350 RTK',
        camera_model VARCHAR(100) NOT NULL DEFAULT 'DJI Zenmuse P1 (35mm)',
        mission_type VARCHAR(50) NOT NULL DEFAULT 'grid_survey',
        flight_speed_ms NUMERIC(6, 2) NOT NULL DEFAULT 10.0,
        target_altitude_m NUMERIC(8, 2) NOT NULL DEFAULT 80.0,
        altitude_reference VARCHAR(50) NOT NULL DEFAULT 'relative_to_home',
        rth_altitude_m NUMERIC(8, 2) NOT NULL DEFAULT 100.0,
        survey_boundary JSONB,
        home_point JSONB,
        takeoff_point JSONB,
        landing_point JSONB,
        finish_action VARCHAR(50) NOT NULL DEFAULT 'go_home',
        photogrammetry_config JSONB DEFAULT '{}',
        grid_config JSONB DEFAULT '{}',
        statistics JSONB DEFAULT '{}',
        validation_result JSONB DEFAULT '{}',
        version INT NOT NULL DEFAULT 1,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_drone_missions_org_proj ON drone_missions(organization_id, project_id);
      CREATE INDEX IF NOT EXISTS idx_drone_missions_updated_at ON drone_missions(updated_at DESC);
    `);

    // 2. Drone Mission Waypoints
    await client.query(`
      CREATE TABLE IF NOT EXISTS drone_mission_waypoints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mission_id UUID NOT NULL REFERENCES drone_missions(id) ON DELETE CASCADE,
        sequence_number INT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        altitude_m NUMERIC(8, 2) NOT NULL,
        speed_ms NUMERIC(6, 2),
        heading_deg NUMERIC(6, 2),
        gimbal_pitch_deg NUMERIC(6, 2) DEFAULT -90.0,
        turn_mode VARCHAR(50) DEFAULT 'to_point_and_stop',
        actions JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_mission_waypoints_seq ON drone_mission_waypoints(mission_id, sequence_number ASC);
    `);

    // 3. Drone Mission Export History
    await client.query(`
      CREATE TABLE IF NOT EXISTS drone_mission_exports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mission_id UUID NOT NULL REFERENCES drone_missions(id) ON DELETE CASCADE,
        mission_version INT NOT NULL DEFAULT 1,
        export_target VARCHAR(50) NOT NULL,
        file_format VARCHAR(20) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size_bytes INT,
        validation_snapshot JSONB DEFAULT '{}',
        exported_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_mission_exports_mission ON drone_mission_exports(mission_id, created_at DESC);
    `);

    await client.query('COMMIT;');
    console.log('[Migration] Drone Mission Planner schema migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[Migration] Drone Mission Planner migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}
