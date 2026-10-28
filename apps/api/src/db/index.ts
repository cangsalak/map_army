import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client', err);
});

export const db = drizzle(pool, { schema });

/**
 * Spatial helper to convert GeoJSON polygon to PostGIS geometry SQL
 */
export function geojsonToPostgisPolygon(geojson: { type: string; coordinates: number[][][] }) {
  const jsonStr = JSON.stringify(geojson);
  return `ST_SetSRID(ST_GeomFromGeoJSON('${jsonStr}'), 4326)`;
}

/**
 * Health check for database connection and PostGIS extension
 */
export async function checkDatabaseHealth(): Promise<{ ok: boolean; postgisVersion?: string; error?: string }> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT PostGIS_Version() as version;');
      return { ok: true, postgisVersion: res.rows[0]?.version };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
