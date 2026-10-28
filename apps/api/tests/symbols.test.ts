import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/index.js';

describe('GeoMonitor 3D: Map Symbol Library & Drawing Integration Tests', () => {
  let adminToken: string;
  let analystToken: string;
  let viewerToken: string;
  let projectId: string;
  let layerId1: string;
  let layerId2: string;
  let readOnlyLayerId: string;
  let testSymbolId: string;
  let placedFeatureId: string;

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

    // Ensure a project exists
    const projRes = await pool.query('SELECT id FROM projects LIMIT 1;');
    if (projRes.rows.length === 0) {
      const orgRes = await pool.query('SELECT id FROM organizations LIMIT 1;');
      const orgId = orgRes.rows[0].id;
      const newProj = await pool.query(
        `INSERT INTO projects (organization_id, name, description) VALUES ($1, $2, $3) RETURNING id;`,
        [orgId, 'โครงการทดสอบสัญลักษณ์ยุทธวิธี', 'สำหรับรันการทดสอบ Symbol Library']
      );
      projectId = newProj.rows[0].id;
    } else {
      projectId = projRes.rows[0].id;
    }

    // Clean up test layers
    await pool.query(`DELETE FROM map_layers WHERE name LIKE 'TEST_%';`);
  });

  // ==========================================
  // 1. Symbol Catalog Search & Filtering
  // ==========================================
  describe('1. Symbol Catalog Queries', () => {
    it('should list seeded symbols from symbol catalog', async () => {
      const res = await request(app)
        .get('/api/v1/symbols')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(10);

      // Save a symbol id for subsequent tests
      testSymbolId = res.body.data[0].id;
      expect(testSymbolId).toBeDefined();
    });

    it('should filter symbols by specific category', async () => {
      const res = await request(app)
        .get('/api/v1/symbols?category=medical_emergency')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((sym: any) => {
        expect(sym.category).toBe('medical_emergency');
      });
    });

    it('should search symbols by keyword', async () => {
      const res = await request(app)
        .get('/api/v1/symbols?search=drone')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 2. User Favorites & Recent Symbols
  // ==========================================
  describe('2. User Favorites & Recent Symbols', () => {
    it('should add a symbol to favorites', async () => {
      const res = await request(app)
        .post(`/api/v1/symbols/${testSymbolId}/favorite`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should list favorite symbols', async () => {
      const res = await request(app)
        .get('/api/v1/symbols/favorites')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const fav = res.body.data.find((s: any) => s.id === testSymbolId);
      expect(fav).toBeDefined();
      expect(fav.isFavorite).toBe(true);
    });

    it('should record and list recently used symbols', async () => {
      // Record usage
      await request(app)
        .post(`/api/v1/symbols/${testSymbolId}/use`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get('/api/v1/symbols/recent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const recent = res.body.data.find((s: any) => s.id === testSymbolId);
      expect(recent).toBeDefined();
    });

    it('should remove a symbol from favorites', async () => {
      const res = await request(app)
        .delete(`/api/v1/symbols/${testSymbolId}/favorite`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await request(app)
        .get('/api/v1/symbols/favorites')
        .set('Authorization', `Bearer ${adminToken}`);
      const fav = listRes.body.data.find((s: any) => s.id === testSymbolId);
      expect(fav).toBeUndefined();
    });
  });

  // ==========================================
  // 3. Custom Symbol Creation & Safe SVG Validation
  // ==========================================
  describe('3. Custom Symbol Creation & Security Validation', () => {
    it('should create a custom symbol with clean valid SVG', async () => {
      const res = await request(app)
        .post('/api/v1/symbols')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'จุดส่งกำลังพิเศษ (Special Supply Drop)',
          description: 'สัญลักษณ์ทดสอบพร้อม SVG สะอาด',
          category: 'custom_symbols',
          iconKey: 'package',
          defaultColor: '#a855f7',
          defaultSize: 32,
          defaultRotation: 0,
          tags: ['supply', 'custom', 'special'],
          svgContent: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isCustom).toBe(true);
      expect(res.body.data.name).toBe('จุดส่งกำลังพิเศษ (Special Supply Drop)');
    });

    it('should REJECT malicious SVG containing <script> tags', async () => {
      const res = await request(app)
        .post('/api/v1/symbols')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'สัญลักษณ์โจมตี XSS',
          category: 'custom_symbols',
          iconKey: 'alert-triangle',
          defaultColor: '#ef4444',
          defaultSize: 24,
          defaultRotation: 0,
          tags: ['exploit'],
          svgContent: '<svg><script>alert("hacked")</script><circle cx="10" cy="10" r="5"/></svg>',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should REJECT malicious SVG containing onload event handlers or javascript: URLs', async () => {
      const res = await request(app)
        .post('/api/v1/symbols')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'สัญลักษณ์โจมตี OnLoad',
          category: 'custom_symbols',
          iconKey: 'alert-triangle',
          defaultColor: '#ef4444',
          defaultSize: 24,
          defaultRotation: 0,
          tags: ['exploit'],
          svgContent: '<svg onload="alert(1)"><circle cx="10" cy="10" r="5"/></svg>',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 4. Layer Creation, Ordering & Permissions
  // ==========================================
  describe('4. Layers Management & Reordering', () => {
    it('should create two editable layers and one read-only layer', async () => {
      // Layer 1
      const res1 = await request(app)
        .post('/api/v1/layers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId,
          name: 'TEST_Layer_Tactical_1',
          layerType: 'custom_vector',
          visibility: true,
          opacity: 1.0,
          isEditable: true,
          colorHex: '#00f0ff',
          permissions: { canView: ['*'], canEdit: ['admin', 'project_manager'] },
        });
      expect(res1.status).toBe(201);
      layerId1 = res1.body.data.id;

      // Layer 2
      const res2 = await request(app)
        .post('/api/v1/layers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId,
          name: 'TEST_Layer_Tactical_2',
          layerType: 'custom_vector',
          visibility: true,
          opacity: 0.8,
          isEditable: true,
          colorHex: '#10b981',
          permissions: { canView: ['*'], canEdit: ['admin', 'project_manager'] },
        });
      expect(res2.status).toBe(201);
      layerId2 = res2.body.data.id;

      // Read-Only Layer
      const res3 = await request(app)
        .post('/api/v1/layers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId,
          name: 'TEST_Layer_ReadOnly',
          layerType: 'custom_vector',
          visibility: true,
          opacity: 1.0,
          isEditable: false,
          colorHex: '#64748b',
          permissions: { canView: ['*'], canEdit: [] },
        });
      expect(res3.status).toBe(201);
      readOnlyLayerId = res3.body.data.id;
    });

    it('should reorder layers via /layers/reorder', async () => {
      const reorderPayload = {
        items: [
          { id: layerId2, orderIndex: 0 },
          { id: layerId1, orderIndex: 1 },
        ],
      };

      const res = await request(app)
        .post('/api/v1/layers/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reorderPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify layers query reflects updated order
      const listRes = await request(app)
        .get(`/api/v1/layers?projectId=${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const l2 = listRes.body.data.find((l: any) => l.id === layerId2);
      const l1 = listRes.body.data.find((l: any) => l.id === layerId1);
      expect(l2.orderIndex).toBe(0);
      expect(l1.orderIndex).toBe(1);
    });
  });

  // ==========================================
  // 5. Symbol Placement & Feature Persistence
  // ==========================================
  describe('5. Symbol Placement & Vector Drawings', () => {
    it('should place a symbol onto the active layer with WGS84 coordinates and custom style', async () => {
      const featurePayload = {
        layerId: layerId1,
        projectId,
        symbolId: testSymbolId,
        featureType: 'Point',
        name: 'จุดสัญลักษณ์ บก. ฉุกเฉิน',
        description: 'วางผ่านระบบ Symbol Placement บนแผนที่ 3 มิติ',
        geometry: {
          type: 'Point',
          coordinates: [101.1455, 12.6788],
        },
        style: {
          color: '#ef4444',
          size: 28,
          rotation: 45,
          opacity: 0.9,
          visible: true,
          labelText: 'บก. ฉุกเฉิน 01',
          showLabel: true,
          labelSize: 13,
        },
        properties: {
          callsign: 'HQ-EMERGENCY',
        },
      };

      const res = await request(app)
        .post(`/api/v1/layers/${layerId1}/features`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send(featurePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('จุดสัญลักษณ์ บก. ฉุกเฉิน');
      expect(res.body.data.style.color).toBe('#ef4444');
      expect(res.body.data.geometry.coordinates).toEqual([101.1455, 12.6788]);

      placedFeatureId = res.body.data.id;
    });

    it('should retrieve layer features with style information preserved', async () => {
      const res = await request(app)
        .get(`/api/v1/layers/${layerId1}/features`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('FeatureCollection');

      const feature = res.body.data.features.find((f: any) => f.id === placedFeatureId);
      expect(feature).toBeDefined();
      expect(feature.properties.style.color).toBe('#ef4444');
      expect(feature.properties.style.size).toBe(28);
    });

    it('should draw and persist a Polyline feature', async () => {
      const polylinePayload = {
        layerId: layerId1,
        projectId,
        featureType: 'LineString',
        name: 'เส้นทางลาดตระเวน Alpha',
        geometry: {
          type: 'LineString',
          coordinates: [
            [101.140, 12.670],
            [101.145, 12.675],
            [101.150, 12.680],
          ],
        },
        style: {
          strokeColor: '#38bdf8',
          strokeWidth: 4,
          opacity: 1.0,
        },
      };

      const res = await request(app)
        .post(`/api/v1/layers/${layerId1}/features`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send(polylinePayload);

      expect(res.status).toBe(201);
      expect(res.body.data.featureType).toBe('LineString');
      expect(res.body.data.geometry.coordinates.length).toBe(3);
    });

    it('should draw and persist a Polygon feature', async () => {
      const polygonPayload = {
        layerId: layerId1,
        projectId,
        featureType: 'Polygon',
        name: 'พื้นที่เฝ้าระวังพิเศษ (Sector 4)',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [101.140, 12.670],
              [101.160, 12.670],
              [101.160, 12.685],
              [101.140, 12.685],
              [101.140, 12.670],
            ],
          ],
        },
        style: {
          fillColor: '#10b981',
          fillOpacity: 0.35,
          strokeColor: '#10b981',
          strokeWidth: 2,
        },
      };

      const res = await request(app)
        .post(`/api/v1/layers/${layerId1}/features`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send(polygonPayload);

      expect(res.status).toBe(201);
      expect(res.body.data.featureType).toBe('Polygon');
    });
  });

  // ==========================================
  // 6. Feature Editing, Duplication & Move Layer
  // ==========================================
  describe('6. Feature Editing & Duplication', () => {
    it('should update feature style and name via PATCH /features/:id', async () => {
      const updatePayload = {
        name: 'จุดสัญลักษณ์ บก. ฉุกเฉิน (ปรับปรุง)',
        style: {
          color: '#eab308',
          size: 36,
          rotation: 90,
          opacity: 1.0,
          labelText: 'บก. ปรับปรุง',
          showLabel: true,
        },
      };

      const res = await request(app)
        .patch(`/api/v1/features/${placedFeatureId}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('จุดสัญลักษณ์ บก. ฉุกเฉิน (ปรับปรุง)');
      expect(res.body.data.style.color).toBe('#eab308');
      expect(res.body.data.style.size).toBe(36);
    });

    it('should duplicate a feature and append (สำเนา)', async () => {
      const res = await request(app)
        .post(`/api/v1/features/${placedFeatureId}/duplicate`)
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toContain('สำเนา');
      expect(res.body.data.id).not.toBe(placedFeatureId);
    });

    it('should move a feature between layers', async () => {
      const res = await request(app)
        .patch(`/api/v1/features/${placedFeatureId}/move-layer`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ targetLayerId: layerId2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.layerId).toBe(layerId2);
    });
  });

  // ==========================================
  // 7. Read-Only Permission Enforcement
  // ==========================================
  describe('7. Read-Only Layer Enforcement', () => {
    it('should REJECT adding features to a read-only layer (403 Forbidden)', async () => {
      const payload = {
        layerId: readOnlyLayerId,
        projectId,
        featureType: 'Point',
        name: 'พยายามวางในเลเยอร์อ่านอย่างเดียว',
        geometry: { type: 'Point', coordinates: [101.145, 12.678] },
      };

      const res = await request(app)
        .post(`/api/v1/layers/${readOnlyLayerId}/features`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send(payload);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('READ_ONLY');
    });

    it('should REJECT moving features into a read-only layer (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/features/${placedFeatureId}/move-layer`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ targetLayerId: readOnlyLayerId });

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // 8. GeoJSON Import with Style Preservation
  // ==========================================
  describe('8. GeoJSON Import with Custom Styles', () => {
    it('should import GeoJSON FeatureCollection while preserving custom style attributes', async () => {
      const geojsonPayload = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [101.155, 12.688],
            },
            properties: {
              name: 'จุดสัญลักษณ์นำเข้า 1',
              description: 'ทดสอบนำเข้าจากไฟล์ GeoJSON',
              style: {
                color: '#10b981',
                size: 26,
                labelText: 'จุดนำเข้า 1',
              },
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [101.150, 12.680],
                [101.155, 12.685],
              ],
            },
            properties: {
              name: 'เส้นทางนำเข้า 2',
              style: {
                strokeColor: '#f97316',
                strokeWidth: 3,
              },
            },
          },
        ],
      };

      const res = await request(app)
        .post(`/api/v1/layers/${layerId2}/import`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(geojsonPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.insertedCount).toBe(2);

      // Verify layer features now include imported ones
      const layerRes = await request(app)
        .get(`/api/v1/layers/${layerId2}/features`)
        .set('Authorization', `Bearer ${adminToken}`);

      const importedPt = layerRes.body.data.features.find(
        (f: any) => f.properties.name === 'จุดสัญลักษณ์นำเข้า 1'
      );
      expect(importedPt).toBeDefined();
      expect(importedPt.properties.style.color).toBe('#10b981');
    });

    it('should REJECT invalid GeoJSON structure', async () => {
      const res = await request(app)
        .post(`/api/v1/layers/${layerId2}/import`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'InvalidType', features: 'not-an-array' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_GEOJSON');
    });
  });

  afterAll(async () => {
    try {
      if (layerId1) await pool.query('DELETE FROM map_features WHERE layer_id = $1;', [layerId1]);
      if (layerId2) await pool.query('DELETE FROM map_features WHERE layer_id = $1;', [layerId2]);
      if (readOnlyLayerId) await pool.query('DELETE FROM map_features WHERE layer_id = $1;', [readOnlyLayerId]);
      await pool.query("DELETE FROM map_layers WHERE name LIKE 'TEST_%';");
      await pool.query("DELETE FROM user_recent_symbols CASCADE;");
      await pool.query("DELETE FROM user_symbol_favorites CASCADE;");
      await pool.query("DELETE FROM audit_logs;");
    } catch {
      // ignore
    }
  });
});
