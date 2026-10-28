import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/index.js';

describe('GeoMonitor 3D: Personnel & Field Operations Integration Tests', () => {
  let adminToken: string;
  let analystToken: string;
  let viewerToken: string;
  let projectId: string;
  let teamId: string;
  let locationId: string;
  let layerId: string;
  let simulationId: string;
  let participantId: string;

  beforeAll(async () => {
    // 1. Authenticate as Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@geomonitor.local', password: 'Password123!' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.accessToken;

    // 2. Authenticate as Analyst
    const analystRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'analyst@geomonitor.local', password: 'Password123!' });
    expect(analystRes.status).toBe(200);
    analystToken = analystRes.body.data.accessToken;

    // 3. Authenticate as Viewer
    const viewerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'viewer@geomonitor.local', password: 'Password123!' });
    expect(viewerRes.status).toBe(200);
    viewerToken = viewerRes.body.data.accessToken;

    // Ensure at least one project exists
    let projRes = await pool.query('SELECT id FROM projects LIMIT 1;');
    if (projRes.rows.length === 0) {
      const orgRes = await pool.query('SELECT id FROM organizations LIMIT 1;');
      const orgId = orgRes.rows[0].id;
      const newProj = await pool.query(
        `INSERT INTO projects (organization_id, name, description) VALUES ($1, $2, $3) RETURNING id;`,
        [orgId, 'โครงการฝึกซ้อมค้นหาและช่วยเหลือ (SAR Exercise)', 'โครงการสำหรับทดสอบโมดูล Operations']
      );
      projectId = newProj.rows[0].id;
    } else {
      projectId = projRes.rows[0].id;
    }

    // Clean up previous test teams if any
    await pool.query(`DELETE FROM teams WHERE identifier LIKE 'SAR-ALPHA-%';`);
  });

  // ==========================================
  // 1. Teams Management
  // ==========================================

  const testIdentifier = `SAR-ALPHA-${Date.now().toString().slice(-4)}`;

  it('POST /api/v1/teams should create a new field operations team', async () => {
    const payload = {
      projectId,
      name: 'ชุดปฏิบัติการค้นหาและกู้ภัย 1 (SAR Team Alpha)',
      identifier: testIdentifier,
      description: 'ทีมภาคสนามปฏิบัติการตอบโต้เหตุฉุกเฉินและสำรวจพื้นที่',
      status: 'active',
    };


    const res = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.identifier).toBe(testIdentifier);
    teamId = res.body.data.id;
  });


  it('POST /api/v1/teams should reject duplicate identifier in same project', async () => {
    const payload = {
      projectId,
      name: 'ชุดปฏิบัติการซ้ำ',
      identifier: testIdentifier,
    };


    const res = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/teams/:id/members should add member to team', async () => {
    const payload = {
      callsign: 'ALPHA-LEADER-01',
      roleInTeam: 'leader',
      isActive: true,
    };

    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.callsign).toBe('ALPHA-LEADER-01');
  });

  it('GET /api/v1/teams should list teams with member counts', async () => {
    const res = await request(app)
      .get(`/api/v1/teams?projectId=${projectId}`)
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((t: any) => t.id === teamId);
    expect(found).toBeDefined();
    expect(found.memberCount).toBeGreaterThanOrEqual(1);
  });

  // ==========================================
  // 2. Team Locations Management (PostGIS)
  // ==========================================

  it('POST /api/v1/locations should register a base camp with Point geometry', async () => {
    const payload = {
      projectId,
      teamId,
      name: 'ฐานปฏิบัติการส่วนหน้า มาบตาพุด (Forward Base MTP)',
      locationType: 'base_camp',
      geometry: {
        type: 'Point',
        coordinates: [101.145, 12.678],
      },
      description: 'ศูนย์บัญชาการชั่วคราวและจุดจอดอากาศยานไร้คนขับ',
      status: 'active',
    };

    const res = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.geometry.type).toBe('Point');
    locationId = res.body.data.id;
  });

  it('GET /api/v1/locations should query locations with bounding box filter', async () => {
    const bbox = '101.0,12.5,101.3,12.8';
    const res = await request(app)
      .get(`/api/v1/locations?projectId=${projectId}&bbox=${bbox}`)
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  // ==========================================
  // 3. Map Layers & Vector Features
  // ==========================================

  it('POST /api/v1/layers should create a new vector layer', async () => {
    const payload = {
      projectId,
      name: 'แนวตรวจการณ์ฉุกเฉิน (Emergency Patrol Corridors)',
      layerType: 'custom_vector',
      visibility: true,
      opacity: 0.85,
      isEditable: true,
      colorHex: '#38bdf8',
    };

    const res = await request(app)
      .post('/api/v1/layers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    layerId = res.body.data.id;
  });

  it('POST /api/v1/layers/:id/features should add a LineString feature to layer', async () => {
    const payload = {
      featureType: 'LineString',
      geometry: {
        type: 'LineString',
        coordinates: [
          [101.145, 12.678],
          [101.155, 12.685],
          [101.165, 12.688],
        ],
      },
      properties: {
        name: 'เส้นทางลาดตระเวนหลัก 01',
        strokeWidth: 3,
        color: '#38bdf8',
      },
    };

    const res = await request(app)
      .post(`/api/v1/layers/${layerId}/features`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  it('GET /api/v1/layers/:id/features should return GeoJSON FeatureCollection', async () => {
    const res = await request(app)
      .get(`/api/v1/layers/${layerId}/features`)
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('FeatureCollection');
    expect(res.body.data.features.length).toBeGreaterThanOrEqual(1);
  });

  // ==========================================
  // 4. Movement Simulation & Deterministic Replay
  // ==========================================

  it('POST /api/v1/simulations should create a simulation session', async () => {
    const startTime = '2026-10-26T08:00:00.000Z';
    const endTime = '2026-10-26T10:00:00.000Z';

    const payload = {
      projectId,
      name: 'การฝึกซ้อมค้นหาและส่งกลับสายแพทย์ (Medevac Exercise)',
      description: 'ข้อมูลจำลองการเคลื่อนที่สำหรับการฝึกซ้อมทางยุทธวิธี',
      startTime,
      endTime,
      speedMultiplier: 2.0,
    };

    const res = await request(app)
      .post('/api/v1/simulations')
      .set('Authorization', `Bearer ${analystToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    simulationId = res.body.data.id;
  });

  it('POST /api/v1/simulations/:id/participants should add a synthetic participant', async () => {
    const payload = {
      teamId,
      name: 'หน่วยเคลื่อนที่เร็ว ALPHA-01 (Synthetic)',
      callsign: 'RESCUE-01',
      iconSymbol: 'ambulance',
      colorHex: '#ef4444',
    };

    const res = await request(app)
      .post(`/api/v1/simulations/${simulationId}/participants`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    participantId = res.body.data.id;
  });

  it('POST /api/v1/simulations/:id/positions should ingest ordered timestamped positions', async () => {
    const positionsPayload = {
      positions: [
        {
          participantId,
          timestamp: '2026-10-26T08:00:00.000Z',
          latitude: 12.678,
          longitude: 101.145,
          altitudeM: 15,
          headingDeg: 45,
          speedMps: 0,
        },
        {
          participantId,
          timestamp: '2026-10-26T08:15:00.000Z',
          latitude: 12.682,
          longitude: 101.152,
          altitudeM: 18,
          headingDeg: 55,
          speedMps: 8.5,
        },
        {
          participantId,
          timestamp: '2026-10-26T08:30:00.000Z',
          latitude: 12.686,
          longitude: 101.160,
          altitudeM: 20,
          headingDeg: 60,
          speedMps: 9.2,
        },
      ],
    };

    const res = await request(app)
      .post(`/api/v1/simulations/${simulationId}/positions`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send(positionsPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.insertedCount).toBe(3);
  });

  it('GET /api/v1/simulations/:id/timeline should return deterministic chronological trackpoints', async () => {
    const res = await request(app)
      .get(`/api/v1/simulations/${simulationId}/timeline`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trackpoints.length).toBe(3);
    // Ensure strict ascending timestamp order
    const t0 = new Date(res.body.data.trackpoints[0].timestamp).getTime();
    const t1 = new Date(res.body.data.trackpoints[1].timestamp).getTime();
    const t2 = new Date(res.body.data.trackpoints[2].timestamp).getTime();
    expect(t0).toBeLessThan(t1);
    expect(t1).toBeLessThan(t2);
  });

  // ==========================================
  // 5. Authorized Field Location Updates & Consent
  // ==========================================

  it('POST /api/v1/location-updates should accept authorized location update with explicit consent', async () => {
    const payload = {
      projectId,
      teamId,
      deviceIdentifier: 'TRACKER-TAC-01',
      timestamp: new Date().toISOString(),
      latitude: 12.680,
      longitude: 101.148,
      altitudeM: 16.5,
      accuracyM: 2.1,
      source: 'field_app',
      consentConfirmed: true,
    };

    const res = await request(app)
      .post('/api/v1/location-updates')
      .set('Authorization', `Bearer ${analystToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.freshnessStatus).toBe('live');
    expect(res.body.data.consentConfirmed).toBe(true);
  });

  it('POST /api/v1/location-updates should REJECT update without consentConfirmed: true', async () => {
    const payload = {
      projectId,
      teamId,
      deviceIdentifier: 'TRACKER-TAC-01',
      timestamp: new Date().toISOString(),
      latitude: 12.680,
      longitude: 101.148,
      consentConfirmed: false,
    };

    const res = await request(app)
      .post('/api/v1/location-updates')
      .set('Authorization', `Bearer ${analystToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/location-updates/latest should return current team position', async () => {
    const res = await request(app)
      .get(`/api/v1/location-updates/latest?projectId=${projectId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].freshnessStatus).toBe('live');
  });

  it('GET /api/v1/location-updates/history should record access log in location_access_logs', async () => {
    const res = await request(app)
      .get(`/api/v1/location-updates/history?teamId=${teamId}`)
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.records)).toBe(true);

    // Verify audit log entry
    const auditRes = await pool.query(
      `SELECT action, resource_type, resource_id FROM location_access_logs WHERE resource_id = $1 ORDER BY accessed_at DESC LIMIT 1;`,
      [teamId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].action).toBe('location_history.query');
  });

  afterAll(async () => {
    try {
      if (layerId) {
        await pool.query('DELETE FROM map_features WHERE layer_id = $1;', [layerId]);
        await pool.query('DELETE FROM map_layers WHERE id = $1;', [layerId]);
      }
      await pool.query('DELETE FROM simulated_positions CASCADE;');
      await pool.query('DELETE FROM simulation_participants CASCADE;');
      await pool.query('DELETE FROM simulation_sessions CASCADE;');
      await pool.query('DELETE FROM authorized_location_updates CASCADE;');
      await pool.query('DELETE FROM location_access_logs CASCADE;');
      await pool.query('DELETE FROM team_locations CASCADE;');
      await pool.query('DELETE FROM team_members CASCADE;');
      await pool.query("DELETE FROM teams WHERE identifier LIKE 'SAR-ALPHA-%' OR name LIKE 'ทีม%';");
      await pool.query('DELETE FROM audit_logs;');
    } catch {
      // ignore
    }
  });
});
