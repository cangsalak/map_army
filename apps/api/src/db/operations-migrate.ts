import { pool } from './index.js';

export async function runOperationsMigrations() {
  console.log('[Migration] Starting Personnel & Field Operations schema migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN;');

    // Custom Types / Enums
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE team_status AS ENUM ('active', 'standby', 'deployed', 'inactive');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE team_role AS ENUM ('leader', 'operator', 'medic', 'scout', 'analyst');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE location_type AS ENUM (
          'base_camp', 'staging_area', 'observation_post', 
          'checkpoint', 'incident_site', 'work_zone'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE layer_type AS ENUM (
          'personnel', 'team_locations', 'simulation_trail', 
          'hazard_zone', 'boundary', 'custom_vector'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE simulation_status AS ENUM ('draft', 'ready', 'running', 'completed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE freshness_status AS ENUM ('live', 'stale', 'unavailable', 'simulated');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // 1. Teams
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        identifier VARCHAR(50) NOT NULL,
        description TEXT,
        status team_status NOT NULL DEFAULT 'standby',
        team_leader_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_team_project_identifier UNIQUE (project_id, identifier)
      );
    `);

    // 2. Team Members
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        callsign VARCHAR(100) NOT NULL,
        role_in_team team_role NOT NULL DEFAULT 'operator',
        is_active BOOLEAN DEFAULT TRUE,
        joined_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
    `);

    // 3. Team Locations (Bases, Staging areas, Checkpoints) with PostGIS Geometry
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
        name VARCHAR(200) NOT NULL,
        location_type location_type NOT NULL DEFAULT 'staging_area',
        geometry geometry(Geometry, 4326) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        valid_from TIMESTAMPTZ,
        valid_to TIMESTAMPTZ,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_team_locations_geom ON team_locations USING GIST(geometry);
      CREATE INDEX IF NOT EXISTS idx_team_locations_project ON team_locations(project_id);
    `);

    // 4. Map Layers
    await client.query(`
      CREATE TABLE IF NOT EXISTS map_layers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        layer_type layer_type NOT NULL DEFAULT 'custom_vector',
        visibility BOOLEAN DEFAULT TRUE,
        opacity NUMERIC(3, 2) DEFAULT 1.0,
        is_editable BOOLEAN DEFAULT TRUE,
        color_hex VARCHAR(7) DEFAULT '#00ffff',
        permissions JSONB DEFAULT '{"canEditRoles": ["admin", "project_manager"], "canViewRoles": ["admin", "project_manager", "analyst", "viewer"]}',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_map_layers_project ON map_layers(project_id);
    `);

    // 5. Map Features (Vector geometries on layers)
    await client.query(`
      CREATE TABLE IF NOT EXISTS map_features (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        layer_id UUID NOT NULL REFERENCES map_layers(id) ON DELETE CASCADE,
        feature_type VARCHAR(50) NOT NULL,
        geometry geometry(Geometry, 4326) NOT NULL,
        properties JSONB DEFAULT '{}',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_map_features_geom ON map_features USING GIST(geometry);
      CREATE INDEX IF NOT EXISTS idx_map_features_layer ON map_features(layer_id);
    `);

    // 6. Simulation Sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS simulation_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        status simulation_status NOT NULL DEFAULT 'ready',
        speed_multiplier NUMERIC(4, 2) DEFAULT 1.0,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sim_sessions_project ON simulation_sessions(project_id);
    `);

    // 7. Simulation Participants
    await client.query(`
      CREATE TABLE IF NOT EXISTS simulation_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES simulation_sessions(id) ON DELETE CASCADE,
        team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
        name VARCHAR(150) NOT NULL,
        callsign VARCHAR(50) NOT NULL,
        icon_symbol VARCHAR(50) DEFAULT 'person',
        color_hex VARCHAR(7) DEFAULT '#38bdf8',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sim_part_session ON simulation_participants(session_id);
    `);

    // 8. Simulated Positions (Strictly separated from actual live updates)
    await client.query(`
      CREATE TABLE IF NOT EXISTS simulated_positions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        participant_id UUID NOT NULL REFERENCES simulation_participants(id) ON DELETE CASCADE,
        timestamp TIMESTAMPTZ NOT NULL,
        geometry geometry(Point, 4326) NOT NULL,
        altitude_m NUMERIC(7, 2) DEFAULT 0,
        heading_deg NUMERIC(5, 2) DEFAULT 0,
        speed_mps NUMERIC(6, 2) DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sim_pos_geom ON simulated_positions USING GIST(geometry);
      CREATE INDEX IF NOT EXISTS idx_sim_pos_time ON simulated_positions(participant_id, timestamp);
    `);

    // 9. Authorized Location Updates (Approved field exercises and response teams)
    await client.query(`
      CREATE TABLE IF NOT EXISTS authorized_location_updates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
        device_identifier VARCHAR(100) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        geometry geometry(Point, 4326) NOT NULL,
        altitude_m NUMERIC(7, 2),
        accuracy_m NUMERIC(6, 2),
        source VARCHAR(50) DEFAULT 'field_app',
        freshness_status freshness_status DEFAULT 'live',
        consent_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_auth_loc_geom ON authorized_location_updates USING GIST(geometry);
      CREATE INDEX IF NOT EXISTS idx_auth_loc_team_time ON authorized_location_updates(team_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_auth_loc_proj_time ON authorized_location_updates(project_id, timestamp DESC);
    `);

    // 10. Location Access Logs (Sensitive location access auditing)
    await client.query(`
      CREATE TABLE IF NOT EXISTS location_access_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id UUID,
        query_filters JSONB DEFAULT '{}',
        ip_address VARCHAR(45),
        user_agent TEXT,
        accessed_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_loc_access_user_time ON location_access_logs(user_id, accessed_at DESC);
    `);

    await client.query('COMMIT;');
    console.log('[Migration] Personnel & Field Operations schema migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[Migration Error] Operations schema migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}
