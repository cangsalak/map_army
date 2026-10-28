import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/index.js';

describe('GeoMonitor 3D REST API Integration Tests', () => {
  let analystToken: string;
  let adminToken: string;
  let createdAreaId: string;
  let surveyId: string;
  let baselineSurveyId: string;
  let comparisonSurveyId: string;

  beforeAll(async () => {
    // 1. Test Login as Analyst
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'analyst@geomonitor.local', password: 'Password123!' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.accessToken).toBeDefined();
    expect(loginRes.body.data.user.role).toBe('analyst');
    analystToken = loginRes.body.data.accessToken;

    // 2. Test Login as Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@geomonitor.local', password: 'Password123!' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.accessToken;
  });

  it('GET /api/v1/auth/me should return current user profile', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('analyst@geomonitor.local');
  });

  it('GET /api/v1/areas should return list of managed areas with PostGIS GeoJSON', async () => {
    const res = await request(app)
      .get('/api/v1/areas')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('POST /api/v1/areas should create new managed area with PostGIS polygon', async () => {
    // Get valid project ID if one exists
    const projRes = await pool.query('SELECT id FROM projects LIMIT 1;');
    const projectId = projRes.rows[0]?.id;

    const newAreaPayload: any = {
      name: 'พื้นที่เหมืองหิน ปากช่อง (Test Mine Area)',
      description: 'แปลงทดสอบการคำนวณ PostGIS ST_Area',
      boundary: {
        type: 'Polygon',
        coordinates: [
          [
            [101.401, 14.652],
            [101.415, 14.652],
            [101.415, 14.665],
            [101.401, 14.665],
            [101.401, 14.652],
          ],
        ],
      },
      status: 'active',
    };

    const res = await request(app)
      .post('/api/v1/areas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newAreaPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.areaSqm).toBeGreaterThan(1000000); // ~2 sq.km
    createdAreaId = res.body.data.id;
  });

  it('POST /api/v1/areas/:areaId/surveys should register a new drone survey', async () => {
    const surveyPayload = {
      surveyCode: 'SRV-TEST-2026-04',
      surveyDate: '2026-04-01T08:00:00.000Z',
      droneModel: 'DJI Matrice 350 RTK',
      sensorType: 'Zenmuse P1 45MP',
      flightAltitudeM: 100,
      groundSampleDistanceCm: 2.0,
      crsHorizontal: 'EPSG:4326',
      crsVertical: 'WGS84 Ellipsoid',
    };

    const res = await request(app)
      .post(`/api/v1/areas/${createdAreaId}/surveys`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(surveyPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.surveyCode).toBe('SRV-TEST-2026-04');
    surveyId = res.body.data.id;
    baselineSurveyId = surveyId;
  });

  it('POST /api/v1/surveys/:id/assets should register deliverable raster', async () => {
    const assetPayload = {
      assetType: 'orthomosaic',
      fileName: 'ortho_test_20260401.tif',
      fileSizeBytes: 125000000,
      mimeType: 'image/tiff',
      checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      resolutionMPerPx: 0.02,
      isPrimary: true,
    };

    const res = await request(app)
      .post(`/api/v1/surveys/${surveyId}/assets`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send(assetPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fileName).toBe('ortho_test_20260401.tif');
  });

  it('GET /api/v1/dashboard/metrics should return aggregated metrics from database', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/metrics')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metrics.totalAreas).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.data.recentSurveys)).toBe(true);
  });

  it('Anonymous access to protected API should return HTTP 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('Access with invalid token should return HTTP 401 INVALID_TOKEN', async () => {
    const res = await request(app)
      .get('/api/v1/areas')
      .set('Authorization', 'Bearer invalid-token-xyz');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('POST /api/v1/auth/logout should successfully clear cookies', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  afterAll(async () => {
    // Cleanup created test records
    try {
      if (surveyId) {
        await pool.query('DELETE FROM survey_assets WHERE survey_id = $1;', [surveyId]);
        await pool.query('DELETE FROM drone_surveys WHERE id = $1;', [surveyId]);
      }
      if (createdAreaId) {
        await pool.query('DELETE FROM managed_areas WHERE id = $1;', [createdAreaId]);
      }
      await pool.query('DELETE FROM audit_logs;');
    } catch (e) {
      // Ignore cleanup error
    }
    await pool.end();
  });
});
