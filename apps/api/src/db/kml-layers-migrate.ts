import { pool } from './index.js';

export async function runKmlLayersMigrations() {
  console.log('[Migration] Starting KML / KMZ Layers schema migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN;');

    // 1. Add 'imported_kml' to layer_type enum if not present
    await client.query(`
      DO $$ BEGIN
        ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'imported_kml';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Enhance map_layers with KML/KMZ metadata columns
    await client.query(`
      ALTER TABLE map_layers ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255);
      ALTER TABLE map_layers ADD COLUMN IF NOT EXISTS file_format VARCHAR(20);
      ALTER TABLE map_layers ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}';
      ALTER TABLE map_layers ADD COLUMN IF NOT EXISTS coordinate_reference_system VARCHAR(50) DEFAULT 'EPSG:4326';
      ALTER TABLE map_layers ADD COLUMN IF NOT EXISTS altitude_reference VARCHAR(50) DEFAULT 'clampToGround';
      ALTER TABLE map_layers ADD COLUMN IF NOT EXISTS import_status VARCHAR(50) DEFAULT 'completed';
      ALTER TABLE map_layers ADD COLUMN IF NOT EXISTS validation_warnings JSONB DEFAULT '[]';
    `);

    // 3. Create index for layer lookups by project and format
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_map_layers_format ON map_layers(file_format);
      CREATE INDEX IF NOT EXISTS idx_map_layers_status ON map_layers(import_status);
    `);

    await client.query('COMMIT;');
    console.log('[Migration] KML / KMZ Layers schema migration finished successfully.');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[Migration] KML / KMZ Layers migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}
