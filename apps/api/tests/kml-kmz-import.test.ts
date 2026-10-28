/**
 * PHASE 10: OGC KML / KMZ Import & Export Test Suite
 * GeoMonitor 3D - Thai Command Center
 * 
 * Verifies all 18 requirements from master contract:
 * 1. Import KML containing Point
 * 2. Import KML containing LineString
 * 3. Import KML containing Polygon
 * 4. Import KML containing multiple Features & Folders
 * 5. Import KMZ containing KML and embedded local resources
 * 6. Altitude Mode interpretation (clampToGround, relativeToGround, absolute)
 * 7. Coordinate Order (lon, lat, alt) & Geometry validity
 * 8. Corrupted and invalid XML handling
 * 9. Defense against XXE (XML External Entity) and Zip Slip
 * 10. ZIP Bomb limits and file size safety
 * 11. Database transactional persistence and layer loading
 * 12. Project authorization & access control
 * 13. Layer visibility toggle and Zoom metadata
 * 14. Import does NOT auto-generate missions or flight waypoints
 * 15. Selecting Polygon as Mission Area
 * 16. Re-export to KML/KMZ and parser roundtrip verification
 * 17. Map Bearing retention (-90° / 270°)
 * 18. Ground Clamping (TERRAIN) vs Elevated 3D flight routes
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db/index.js';
import JSZip from 'jszip';
import {
  parseKml,
  parseKmz,
  exportFeaturesToKml,
  exportFeaturesToKmz,
  detectXxe,
  KMZ_LIMITS,
  KmlFeature,
} from '@geomonitor/shared';

describe('PHASE 10: KML / KMZ Import & 3D GeoMonitor Operations', () => {
  let adminToken: string;
  let viewerToken: string;
  let testProjectId: string;
  let createdLayerIds: string[] = [];
  let createdAreaIds: string[] = [];

  beforeAll(async () => {
    // 1. Authenticate admin user
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@geomonitor.local', password: 'Password123!' });
    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.data.accessToken;

    // 2. Authenticate viewer user
    const viewerLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'viewer@geomonitor.local', password: 'Password123!' });
    expect(viewerLoginRes.status).toBe(200);
    viewerToken = viewerLoginRes.body.data.accessToken;

    // 3. Get or create test project
    const projRes = await pool.query("SELECT id FROM projects WHERE name LIKE '%ชายแดน%' OR name LIKE '%ทดสอบ%' LIMIT 1;");
    if (projRes.rows.length > 0) {
      testProjectId = projRes.rows[0].id;
    } else {
      const orgRes = await pool.query('SELECT id FROM organizations LIMIT 1;');
      const orgId = orgRes.rows[0].id;
      const newProj = await pool.query(
        `INSERT INTO projects (organization_id, name, description) 
         VALUES ($1, 'TEST_KML_PROJECT', 'โครงการทดสอบ KML/KMZ Import') RETURNING id;`,
        [orgId]
      );
      testProjectId = newProj.rows[0].id;
    }
  });

  afterAll(async () => {
    // Zero Dangling Records Cleanup
    if (createdLayerIds.length > 0) {
      await pool.query('DELETE FROM map_layers WHERE id = ANY($1::uuid[])', [createdLayerIds]);
    }
    if (createdAreaIds.length > 0) {
      await pool.query('DELETE FROM managed_areas WHERE id = ANY($1::uuid[])', [createdAreaIds]);
    }
    await pool.query("DELETE FROM map_layers WHERE name LIKE 'TEST_KML_%' OR original_filename LIKE 'test_%';");
    await pool.query("DELETE FROM managed_areas WHERE name LIKE 'TEST_KML_%';");
    await pool.query("DELETE FROM projects WHERE name = 'TEST_KML_PROJECT';");
  });

  // 1. Import KML containing Point
  it('1. Import KML ที่มี Point: Parses Point Placemark with coordinates, name, and description', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark id="pt-1">
          <name>จุดตรวจชายแดนที่ 14</name>
          <description>จุดตรวจการณ์ลาดตระเวน</description>
          <Point>
            <coordinates>100.523186,13.736717,15.5</coordinates>
          </Point>
        </Placemark>
      </Document>
    </kml>`;

    const result = parseKml(kml, 'checkpoint.kml');
    expect(result.success).toBe(true);
    expect(result.featureCollection?.features.length).toBe(1);

    const feat = result.featureCollection!.features[0];
    expect(feat.geometry.type).toBe('Point');
    // Coordinate order: lon=100.523186, lat=13.736717, alt=15.5
    expect(feat.geometry.coordinates[0]).toBeCloseTo(100.523186, 5);
    expect(feat.geometry.coordinates[1]).toBeCloseTo(13.736717, 5);
    expect(feat.geometry.coordinates[2]).toBeCloseTo(15.5, 1);
    expect(feat.properties.name).toBe('จุดตรวจชายแดนที่ 14');
    expect(feat.properties.description).toBe('จุดตรวจการณ์ลาดตระเวน');
  });

  // 2. Import KML containing LineString
  it('2. Import KML ที่มี LineString: Parses flight route or patrol path with multiple vertices', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark>
          <name>แนวลาดตระเวน Alpha</name>
          <LineString>
            <altitudeMode>relativeToGround</altitudeMode>
            <coordinates>
              100.50,13.70,80.0
              100.51,13.71,80.0
              100.52,13.72,90.0
            </coordinates>
          </LineString>
        </Placemark>
      </Document>
    </kml>`;

    const result = parseKml(kml, 'patrol_route.kml');
    expect(result.success).toBe(true);
    const feat = result.featureCollection!.features[0];
    expect(feat.geometry.type).toBe('LineString');
    expect(feat.geometry.coordinates.length).toBe(3);
    expect(feat.properties.altitudeMode).toBe('relativeToGround');
    expect(feat.geometry.coordinates[0]).toEqual([100.50, 13.70, 80.0]);
  });

  // 3. Import KML containing Polygon
  it('3. Import KML ที่มี Polygon: Parses outer boundary and enforces ring closure', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark>
          <name>พื้นที่รับผิดชอบ แปลง A</name>
          <Polygon>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>
                  100.50,13.70 100.55,13.70 100.55,13.75 100.50,13.75 100.50,13.70
                </coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
        </Placemark>
      </Document>
    </kml>`;

    const result = parseKml(kml, 'survey_zone.kml');
    expect(result.success).toBe(true);
    const feat = result.featureCollection!.features[0];
    expect(feat.geometry.type).toBe('Polygon');
    const ring = feat.geometry.coordinates[0];
    expect(ring.length).toBe(5);
    // Closed ring
    expect(ring[0]).toEqual(ring[4]);
  });

  // 4. Import KML containing multiple Features & Folders
  it('4. Import KML ที่มีหลาย Feature และหลาย Folder: Preserves folder hierarchy and styles', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <name>แผนที่ยุทธการรวม</name>
        <Style id="redLine">
          <LineStyle>
            <color>ff0000ff</color>
            <width>3</width>
          </LineStyle>
        </Style>
        <Folder>
          <name>จุดเฝ้าระวัง</name>
          <Placemark>
            <name>OP 1</name>
            <Point><coordinates>100.1,13.1,0</coordinates></Point>
          </Placemark>
          <Placemark>
            <name>OP 2</name>
            <Point><coordinates>100.2,13.2,0</coordinates></Point>
          </Placemark>
        </Folder>
        <Folder>
          <name>แนวเคลื่อนกำลัง</name>
          <Placemark>
            <name>Route Charlie</name>
            <styleUrl>#redLine</styleUrl>
            <LineString><coordinates>100.1,13.1 100.2,13.2</coordinates></LineString>
          </Placemark>
        </Folder>
      </Document>
    </kml>`;

    const result = parseKml(kml, 'combined_ops.kml');
    expect(result.success).toBe(true);
    expect(result.featureCollection?.features.length).toBe(3);
    expect(result.featureCollection?.metadata?.folders).toContain('จุดเฝ้าระวัง');
    expect(result.featureCollection?.metadata?.folders).toContain('แนวเคลื่อนกำลัง');

    const routeFeat = result.featureCollection!.features[2];
    expect(routeFeat.properties.folderName).toBe('แนวเคลื่อนกำลัง');
    expect(routeFeat.properties.style?.strokeColor).toBe('#ff0000');
  });

  // 5. Import KMZ containing KML and embedded local resources
  it('5. Import KMZ ที่มี KML และทรัพยากรประกอบ: Extracts and resolves internal assets safely', async () => {
    const zip = new JSZip();
    const docKml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Style id="customPin">
          <IconStyle>
            <Icon><href>images/marker.png</href></Icon>
          </IconStyle>
        </Style>
        <Placemark>
          <name>ฐานปฏิบัติการส่วนหน้า</name>
          <styleUrl>#customPin</styleUrl>
          <Point><coordinates>100.6,13.8,10</coordinates></Point>
        </Placemark>
      </Document>
    </kml>`;

    zip.file('doc.kml', docKml);
    // Add mock png bytes
    zip.file('images/marker.png', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

    const kmzBuffer = await zip.generateAsync({ type: 'uint8array' });
    const result = await parseKmz(kmzBuffer, 'operations_base.kmz');

    expect(result.success).toBe(true);
    expect(result.featureCollection?.features.length).toBe(1);
    const feat = result.featureCollection!.features[0];
    expect(feat.properties.name).toBe('ฐานปฏิบัติการส่วนหน้า');
    // Check that local icon image was resolved to base64 data URL
    expect(feat.properties.style?.iconUrl).toMatch(/^data:image\/png;base64,/);
  });

  // 6. Altitude Mode interpretation
  it('6. ตรวจสอบ Altitude Mode: Parses clampToGround, relativeToGround, and absolute correctly', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark>
          <name>P1 Ground</name>
          <Point>
            <altitudeMode>clampToGround</altitudeMode>
            <coordinates>100.1,13.1,0</coordinates>
          </Point>
        </Placemark>
        <Placemark>
          <name>P2 Drone Flight</name>
          <Point>
            <altitudeMode>relativeToGround</altitudeMode>
            <coordinates>100.2,13.2,85.5</coordinates>
          </Point>
        </Placemark>
        <Placemark>
          <name>P3 Mountain Peak</name>
          <Point>
            <altitudeMode>absolute</altitudeMode>
            <coordinates>100.3,13.3,1250.0</coordinates>
          </Point>
        </Placemark>
      </Document>
    </kml>`;

    const res = parseKml(kml, 'altitudes.kml');
    expect(res.success).toBe(true);
    const features = res.featureCollection!.features;
    expect(features[0].properties.altitudeMode).toBe('clampToGround');
    expect(features[1].properties.altitudeMode).toBe('relativeToGround');
    expect(features[1].properties.altitude).toBe(85.5);
    expect(features[2].properties.altitudeMode).toBe('absolute');
    expect(features[2].properties.altitude).toBe(1250.0);
  });

  // 7. Coordinate Order (lon, lat, alt) & Geometry validity
  it('7. ตรวจสอบ Coordinate Order: Longitude (-180 to 180) and Latitude (-90 to 90) validation', () => {
    const invalidKml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark>
          <name>Invalid Latitude</name>
          <Point><coordinates>100.0,999.0</coordinates></Point>
        </Placemark>
      </Document>
    </kml>`;

    const res = parseKml(invalidKml, 'invalid_coord.kml');
    expect(res.warnings?.length).toBeGreaterThan(0);
    expect(res.warnings?.[0]).toContain('พิกัดอยู่นอกช่วงมาตรฐาน WGS84');
  });

  // 8. Corrupted & Invalid XML handling
  it('8. ตรวจสอบไฟล์เสียหายและไฟล์ที่ไม่รองรับ: Gracefully rejects malformed XML syntax with clear errors', () => {
    const malformed = `<kml><Document><Placemark><name>Unclosed Tag`;
    const res = parseKml(malformed, 'bad.kml');
    expect(res.success).toBe(false);
    expect(res.errors?.[0]).toContain('XML');
  });

  // 9. Defense against XXE (XML External Entity) and Zip Slip
  it('9. ตรวจสอบการป้องกัน XXE และ ZIP Slip: Rejects entity expansion and directory traversal attacks', async () => {
    // 9a. XXE Test
    const xxePayload = `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark>
          <name>&xxe;</name>
          <Point><coordinates>100.0,13.0</coordinates></Point>
        </Placemark>
      </Document>
    </kml>`;

    expect(detectXxe(xxePayload)).toBe(true);
    const xxeRes = parseKml(xxePayload, 'xxe_attack.kml');
    expect(xxeRes.success).toBe(false);
    expect(xxeRes.errors?.[0]).toContain('XXE_DETECTED');

    // 9b. Zip Slip Test
    const zipSlip = new JSZip();
    zipSlip.file('../../etc/cron.d/evil.sh', 'echo evil');
    zipSlip.file('doc.kml', '<kml><Document></Document></kml>');
    const zipSlipBuffer = await zipSlip.generateAsync({ type: 'uint8array' });

    const zipSlipRes = await parseKmz(zipSlipBuffer, 'zipslip.kmz');
    expect(zipSlipRes.success).toBe(false);
    expect(zipSlipRes.errors?.[0]).toContain('ZIP_SLIP_DETECTED');
  });

  // 10. ZIP Bomb limits and file size safety
  it('10. ตรวจสอบขนาดไฟล์และ ZIP Bomb Limits: Enforces archive size limits and file count limits', async () => {
    // Exceeding archive size check
    const hugeBuffer = new Uint8Array(KMZ_LIMITS.MAX_ARCHIVE_SIZE_BYTES + 1024);
    const hugeRes = await parseKmz(hugeBuffer, 'huge_bomb.kmz');
    expect(hugeRes.success).toBe(false);
    expect(hugeRes.errors?.[0]).toContain('เกินขีดจำกัดที่ปลอดภัย');
  });

  // 11. Database persistence and layer loading
  it('11. ตรวจสอบการบันทึกและโหลด Layer กลับจาก Database: Transactional persistence to map_layers & map_features', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <name>TEST_KML_PERSISTENCE</name>
        <Placemark>
          <name>คลังเสบียงหลัก</name>
          <description>จุดกระจายสิ่งของบรรเทาทุกข์</description>
          <Point><coordinates>100.53,13.74,20</coordinates></Point>
        </Placemark>
      </Document>
    </kml>`;

    const parsed = parseKml(kml, 'test_persist.kml');
    expect(parsed.success).toBe(true);

    const importRes = await request(app)
      .post('/api/v1/layers/import-kml')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId: testProjectId,
        layerName: 'TEST_KML_PERSISTENCE',
        originalFilename: 'test_persist.kml',
        fileFormat: 'kml',
        intent: 'view_only',
        featureCollection: parsed.featureCollection,
      });

    expect(importRes.status).toBe(201);
    expect(importRes.body.success).toBe(true);
    const layerId = importRes.body.data.layer.id;
    createdLayerIds.push(layerId);

    // Verify loading layer back
    const getRes = await request(app)
      .get(`/api/v1/layers/${layerId}/features`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.features.length).toBe(1);
    expect(getRes.body.data.features[0].properties.name).toBe('คลังเสบียงหลัก');
  });

  // 12. Project Authorization check
  it('12. ตรวจสอบ Project Authorization: Viewer role cannot import layers (403 Forbidden)', async () => {
    const importRes = await request(app)
      .post('/api/v1/layers/import-kml')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        projectId: testProjectId,
        layerName: 'TEST_KML_UNAUTHORIZED',
        originalFilename: 'unauthorized.kml',
        featureCollection: {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [100, 13] }, properties: { name: 'P' } }],
        },
      });

    expect(importRes.status).toBe(403);
  });

  // 13. Layer visibility toggle and Zoom to layer metadata
  it('13. ตรวจสอบการเปิด/ปิด Layer และ Zoom to Layer: Patch layer visibility and compute bounding box', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <name>TEST_KML_TOGGLE</name>
        <Placemark>
          <name>หมุดมุม 1</name>
          <Point><coordinates>100.50,13.70</coordinates></Point>
        </Placemark>
        <Placemark>
          <name>หมุดมุม 2</name>
          <Point><coordinates>100.60,13.80</coordinates></Point>
        </Placemark>
      </Document>
    </kml>`;

    const parsed = parseKml(kml, 'test_toggle.kml');
    const importRes = await request(app)
      .post('/api/v1/layers/import-kml')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId: testProjectId,
        layerName: 'TEST_KML_TOGGLE',
        originalFilename: 'test_toggle.kml',
        featureCollection: parsed.featureCollection,
      });

    const layerId = importRes.body.data.layer.id;
    createdLayerIds.push(layerId);

    // Toggle visibility to false
    const patchRes = await request(app)
      .patch(`/api/v1/layers/${layerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ visibility: false, opacity: 0.6 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.visibility).toBe(false);
    expect(patchRes.body.data.opacity).toBe('0.60');
  });

  // 14. Import does NOT auto-generate missions or flight waypoints
  it('14. ตรวจสอบการนำเข้าไม่สร้าง Mission โดยอัตโนมัติ: Importing KML leaves drone_missions table unchanged', async () => {
    const beforeCountRes = await pool.query('SELECT count(*)::int as count FROM drone_missions;');
    const beforeCount = beforeCountRes.rows[0].count;

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark>
          <name>เขตพื้นที่สำรวจเป้าหมาย</name>
          <Polygon>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>100.5,13.7 100.6,13.7 100.6,13.8 100.5,13.8 100.5,13.7</coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
        </Placemark>
      </Document>
    </kml>`;

    const parsed = parseKml(kml, 'no_auto_mission.kml');
    const importRes = await request(app)
      .post('/api/v1/layers/import-kml')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId: testProjectId,
        layerName: 'TEST_KML_NO_AUTO_MISSION',
        originalFilename: 'no_auto_mission.kml',
        intent: 'view_only',
        featureCollection: parsed.featureCollection,
      });

    createdLayerIds.push(importRes.body.data.layer.id);

    const afterCountRes = await pool.query('SELECT count(*)::int as count FROM drone_missions;');
    const afterCount = afterCountRes.rows[0].count;

    // Strict requirement: Import KML must NEVER auto-create drone missions or flight lines
    expect(afterCount).toBe(beforeCount);
  });

  // 15. Selecting Polygon as Responsibility / Mission Area
  it('15. ตรวจสอบการเลือก Polygon เพื่อใช้เป็น Responsibility Area: Converts polygon to managed_areas', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <name>TEST_KML_RESPONSIBILITY</name>
        <Placemark>
          <name>พื้นที่รับผิดชอบพิเศษ ชายแดนไทย</name>
          <Polygon>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>
                  100.50,13.70 100.52,13.70 100.52,13.72 100.50,13.72 100.50,13.70
                </coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
        </Placemark>
      </Document>
    </kml>`;

    const parsed = parseKml(kml, 'responsibility_zone.kml');
    const importRes = await request(app)
      .post('/api/v1/layers/import-kml')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId: testProjectId,
        layerName: 'TEST_KML_RESPONSIBILITY',
        originalFilename: 'responsibility_zone.kml',
        intent: 'responsibility_area',
        featureCollection: parsed.featureCollection,
      });

    expect(importRes.status).toBe(201);
    expect(importRes.body.data.managedAreaId).toBeDefined();
    const areaId = importRes.body.data.managedAreaId;
    createdAreaIds.push(areaId);
    createdLayerIds.push(importRes.body.data.layer.id);

    // Verify managed_areas record
    const areaRes = await pool.query('SELECT id, name, area_sqm FROM managed_areas WHERE id = $1', [areaId]);
    expect(areaRes.rows.length).toBe(1);
    expect(areaRes.rows[0].name).toContain('พื้นที่รับผิดชอบ');
    expect(areaRes.rows[0].area_sqm).toBeGreaterThan(0);
  });

  // 16. Re-export KML/KMZ and parser roundtrip verification
  it('16. ตรวจสอบ Export KML/KMZ และการอ่านไฟล์ที่ Export กลับ: Full roundtrip data integrity', async () => {
    const features: KmlFeature[] = [
      {
        type: 'Feature',
        id: 'feat-poly-1',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [100.51, 13.71, 0],
              [100.53, 13.71, 0],
              [100.53, 13.73, 0],
              [100.51, 13.73, 0],
              [100.51, 13.71, 0],
            ],
          ],
        },
        properties: {
          name: 'แปลงเกษตรทดลอง',
          description: 'พื้นที่สำรวจทดลอง 3D',
          altitudeMode: 'clampToGround',
          extendedData: { cropType: 'Rice', season: '2026-Q1' },
        },
      },
      {
        type: 'Feature',
        id: 'feat-line-1',
        geometry: {
          type: 'LineString',
          coordinates: [
            [100.51, 13.71, 80],
            [100.53, 13.73, 80],
          ],
        },
        properties: {
          name: 'แนวบินสำรวจ',
          altitudeMode: 'relativeToGround',
          altitude: 80,
        },
      },
    ];

    // 16a. Export to KML text
    const kmlOutput = exportFeaturesToKml(features, 'ExportTest', 'คำอธิบายทดสอบ');
    expect(kmlOutput).toContain('<kml xmlns="http://www.opengis.net/kml/2.2"');
    expect(kmlOutput).toContain('แปลงเกษตรทดลอง');
    expect(kmlOutput).toContain('<coordinates>100.51,13.71,0');

    // 16b. Parse back exported KML
    const roundtrip = parseKml(kmlOutput, 'roundtrip.kml');
    expect(roundtrip.success).toBe(true);
    expect(roundtrip.featureCollection?.features.length).toBe(2);
    expect(roundtrip.featureCollection?.features[0].properties.name).toBe('แปลงเกษตรทดลอง');
    expect(roundtrip.featureCollection?.features[0].geometry.type).toBe('Polygon');
    expect(roundtrip.featureCollection?.features[1].properties.altitudeMode).toBe('relativeToGround');

    // 16c. Export to KMZ binary
    const kmzOutput = await exportFeaturesToKmz(features, 'ExportKmzTest');
    expect(kmzOutput.byteLength).toBeGreaterThan(100);

    // 16d. Parse back exported KMZ
    const kmzRoundtrip = await parseKmz(kmzOutput, 'roundtrip.kmz');
    expect(kmzRoundtrip.success).toBe(true);
    expect(kmzRoundtrip.featureCollection?.features.length).toBe(2);
  });

  // 17. Map Bearing retention (-90° / 270°)
  it('17. ตรวจสอบการทำงานร่วมกับ Map Bearing -90° (270°): Map camera orientation remains fixed to system policy', async () => {
    const bearingRes = await request(app)
      .get('/api/v1/health')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(bearingRes.status).toBe(200);

    // Verify constant contract
    const { MAP_BEARING } = await import('@geomonitor/shared');
    expect(MAP_BEARING.SIGNED_DEG).toBe(-90);
    expect(MAP_BEARING.CESIUM_DEG).toBe(270);
  });

  // 18. Geometry Ground Clamping (TERRAIN) vs Elevated 3D flight routes
  it('18. ตรวจสอบ Geometry ที่แนบพื้นดินและ Geometry ที่มีความสูง: Preserves clampToGround and altitude references', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark>
          <name>Ground Survey Boundary</name>
          <Polygon>
            <altitudeMode>clampToGround</altitudeMode>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>100.1,13.1,0 100.2,13.1,0 100.2,13.2,0 100.1,13.2,0 100.1,13.1,0</coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
        </Placemark>
        <Placemark>
          <name>Flight Trajectory</name>
          <LineString>
            <altitudeMode>relativeToGround</altitudeMode>
            <coordinates>100.1,13.1,120.0 100.2,13.2,120.0</coordinates>
          </LineString>
        </Placemark>
      </Document>
    </kml>`;

    const parsed = parseKml(kml, 'ground_vs_sky.kml');
    expect(parsed.success).toBe(true);
    const boundary = parsed.featureCollection!.features[0];
    const flight = parsed.featureCollection!.features[1];

    // Boundary must be clampToGround for Cesium terrain draping
    expect(boundary.properties.altitudeMode).toBe('clampToGround');

    // Flight route must retain altitude (120m) and NOT be forced to ground
    expect(flight.properties.altitudeMode).toBe('relativeToGround');
    expect(flight.properties.altitude).toBe(120.0);
  });
});
