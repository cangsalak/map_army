import { describe, it, expect, afterAll } from 'vitest';
import { checkDatabaseHealth, pool } from '../src/db/index.js';

describe('Phase 1 Verification: Database & System Environment', () => {
  it('should successfully connect to PostgreSQL with PostGIS extension', async () => {
    const health = await checkDatabaseHealth();
    expect(health.ok).toBe(true);
    expect(health.postgisVersion).toBeDefined();
    expect(health.postgisVersion).toContain('3.4');
  });

  it('should verify PostGIS spatial calculations and polygon transformations', async () => {
    const res = await pool.query(`
      SELECT ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[101.135,12.668],[101.155,12.668],[101.155,12.682],[101.135,12.682],[101.135,12.668]]]}'), 4326), 32647)) as area_sqm;
    `);
    expect(Number(res.rows[0].area_sqm)).toBeGreaterThan(1000000);
  });

  it('should verify seeded test accounts exist with roles', async () => {
    const res = await pool.query(`SELECT email, role, full_name FROM users ORDER BY role;`);
    const roles = res.rows.map((r) => r.role);
    expect(roles).toContain('admin');
    expect(roles).toContain('project_manager');
    expect(roles).toContain('analyst');
    expect(roles).toContain('viewer');
  });

  afterAll(async () => {
    await pool.end();
  });
});
