import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/index.js';

describe('Change Analyses API Tests (Issue A: GET /api/v1/areas/:areaId/change-analyses)', () => {
  let adminToken: string;
  let analystToken: string;
  let seededAreaId: string;
  let emptyAreaId: string;

  beforeAll(async () => {
    // 1. Login as Admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@geomonitor.local', password: 'Password123!' });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.accessToken;

    // 2. Login as Analyst
    const analystLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'analyst@geomonitor.local', password: 'Password123!' });
    expect(analystLogin.status).toBe(200);
    analystToken = analystLogin.body.data.accessToken;

    // 3. Find seeded area (e.g. Map Ta Phut with existing change analyses)
    const areaRes = await pool.query(
      `SELECT m.id FROM managed_areas m
       JOIN change_analyses ca ON m.id = ca.area_id
       LIMIT 1;`
    );
    if (areaRes.rows.length > 0) {
      seededAreaId = areaRes.rows[0].id;
    }

    // 4. Create an area without any change analyses for testing empty state
    const projRes = await pool.query(`SELECT id FROM projects LIMIT 1;`);
    const projectId = projRes.rows[0].id;
    const newAreaRes = await request(app)
      .post('/api/v1/areas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId,
        name: 'พื้นที่ทดสอบไม่มีการวิเคราะห์ (Empty Change Analyses Area)',
        description: 'Test area for zero change analyses validation',
        boundary: {
          type: 'Polygon',
          coordinates: [
            [
              [100.51, 13.75],
              [100.52, 13.75],
              [100.52, 13.76],
              [100.51, 13.76],
              [100.51, 13.75],
            ],
          ],
        },
      });
    expect(newAreaRes.status).toBe(201);
    emptyAreaId = newAreaRes.body.data.id;
  });

  afterAll(async () => {
    if (emptyAreaId) {
      await pool.query('DELETE FROM managed_areas WHERE id = $1;', [emptyAreaId]);
    }
  });

  it('GET /api/v1/areas/:areaId/change-analyses returns 200 and list of analyses for an area with existing analyses', async () => {
    if (!seededAreaId) return;

    const res = await request(app)
      .get(`/api/v1/areas/${seededAreaId}/change-analyses`)
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const first = res.body.data[0];
    expect(first.id).toBeDefined();
    expect(first.areaId).toBe(seededAreaId);
    expect(first.baselineSurveyId).toBeDefined();
    expect(first.comparisonSurveyId).toBeDefined();
    expect(typeof first.cutVolumeM3).toBe('number');
    expect(typeof first.fillVolumeM3).toBe('number');
    expect(typeof first.netVolumeM3).toBe('number');
    expect(typeof first.featureCount).toBe('number');
  });

  it('GET /api/v1/areas/:areaId/change-analyses returns 200 with empty array for an area with no analyses (admin)', async () => {
    const res = await request(app)
      .get(`/api/v1/areas/${emptyAreaId}/change-analyses`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  it('GET /api/v1/areas/:areaId/change-analyses returns 403 FORBIDDEN when user has no access to that area', async () => {
    const res = await request(app)
      .get(`/api/v1/areas/${emptyAreaId}/change-analyses`)
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('GET /api/v1/areas/:areaId/change-analyses returns 404 NOT_FOUND when area does not exist in database', async () => {
    const nonExistentUuid = '00000000-0000-0000-0000-000000000000';

    const res = await request(app)
      .get(`/api/v1/areas/${nonExistentUuid}/change-analyses`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('ไม่พบพื้นที่');
  });

  it('GET /api/v1/areas/:areaId/change-analyses returns 400 INVALID_UUID when areaId is not a valid UUID', async () => {
    const res = await request(app)
      .get('/api/v1/areas/invalid-area-uuid-123/change-analyses')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_UUID');
  });

  it('GET /api/v1/areas/:areaId/change-analyses returns 401 UNAUTHORIZED when no token is provided', async () => {
    const res = await request(app)
      .get(`/api/v1/areas/${seededAreaId || emptyAreaId}/change-analyses`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
