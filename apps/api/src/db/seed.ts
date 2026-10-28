import bcrypt from 'bcryptjs';
import { pool } from './index.js';

export async function runSeed() {
  console.log('[Seed] Seeding realistic Thai GIS dataset and users...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN;');

    // 1. Organization
    const orgRes = await client.query(`
      INSERT INTO organizations (name, code)
      VALUES ('สำนักงานพัฒนาเทคโนโลยีอวกาศและภูมิสารสนเทศ (GISTDA / EEC Monitor)', 'GISTDA-EEC')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const orgId = orgRes.rows[0].id;

    // 2. Users
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const usersData = [
      { email: 'admin@geomonitor.local', name: 'พล.ท. ชาญชัย สุวรรณรัตน์ (Chief Administrator)', role: 'admin' },
      { email: 'pm@geomonitor.local', name: 'กิตติศักดิ์ รัตนวิบูลย์ (Senior Project Director)', role: 'project_manager' },
      { email: 'analyst@geomonitor.local', name: 'ธีรภัทร วงศ์เจริญ (Lead Photogrammetry Analyst)', role: 'analyst' },
      { email: 'viewer@geomonitor.local', name: 'นภัสสร ศิริวัฒนา (Environmental Inspector)', role: 'viewer' },
    ];

    const userIds: Record<string, string> = {};
    for (const u of usersData) {
      const res = await client.query(
        `INSERT INTO users (organization_id, email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role
         RETURNING id;`,
        [orgId, u.email, passwordHash, u.name, u.role]
      );
      userIds[u.role] = res.rows[0].id;
    }

    // 3. Projects
    const projRes = await client.query(
      `INSERT INTO projects (organization_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id;`,
      [
        orgId,
        'โครงการพัฒนาระเบียงเศรษฐกิจพิเศษภาคตะวันออก (EEC Drone Monitoring)',
        'การสำรวจติดตามความก้าวหน้าโครงการก่อสร้างขนาดใหญ่และการเปลี่ยนแปลงสภาพแวดล้อม',
      ]
    );
    const projId = projRes.rows[0].id;

    // 4. Managed Areas (Map Ta Phut Phase 3, Mae Moh Mine, Suvarnabhumi)
    const areas = [
      {
        name: 'นิคมอุตสาหกรรมมาบตาพุด ระยะที่ 3 (Rayong MTP Phase 3)',
        description: 'โครงการถมทะเล ก่อสร้างท่าเรือก๊าซ LNG และพื้นที่นิคมอุตสาหกรรมปิโตรเคมี',
        coords: [[[101.1350, 12.6680], [101.1550, 12.6680], [101.1550, 12.6820], [101.1350, 12.6820], [101.1350, 12.6680]]],
        status: 'monitoring',
      },
      {
        name: 'เหมืองแม่เมาะ กฟผ. (Lampang Lignite Mine)',
        description: 'ติดตามปริมาตรการขุดเปิดหน้าดินและเหมืองถ่านหินลิกไนต์ประจำไตรมาส',
        coords: [[[99.7050, 18.2850], [99.7280, 18.2850], [99.7280, 18.3050], [99.7050, 18.3050], [99.7050, 18.2850]]],
        status: 'active',
      },
      {
        name: 'ท่าอากาศยานสุวรรณภูมิ ส่วนต่อขยาย (Suvarnabhumi Airport Extension)',
        description: 'งานปรับระดับพื้นที่และก่อสร้างทางวิ่งเส้นที่ 3 (Runway 3 Expansion)',
        coords: [[[100.7380, 13.6800], [100.7620, 13.6800], [100.7620, 13.7000], [100.7380, 13.7000], [100.7380, 13.6800]]],
        status: 'active',
      },
    ];

    const areaIds: string[] = [];
    for (const a of areas) {
      const geojsonStr = JSON.stringify({ type: 'Polygon', coordinates: a.coords });
      const res = await client.query(
        `INSERT INTO managed_areas (project_id, name, description, boundary, area_sqm, status, created_by)
         VALUES (
           $1, $2, $3,
           ST_SetSRID(ST_GeomFromGeoJSON($4), 4326),
           ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326), 32647)),
           $5, $6
         )
         RETURNING id, area_sqm;`,
        [projId, a.name, a.description, geojsonStr, a.status, userIds['admin']]
      );
      areaIds.push(res.rows[0].id);

      // Area membership
      await client.query(
        `INSERT INTO area_members (area_id, user_id, role)
         VALUES ($1, $2, 'lead_analyst')
         ON CONFLICT (area_id, user_id) DO NOTHING;`,
        [res.rows[0].id, userIds['analyst']]
      );
    }

    const mtpAreaId = areaIds[0];

    // 5. Drone Surveys for Map Ta Phut (2 dates: 15 Jan 2026 baseline, 15 Mar 2026 comparison)
    const survey1Res = await client.query(
      `INSERT INTO drone_surveys (
         area_id, survey_code, survey_date, drone_model, sensor_type,
         flight_altitude_m, ground_sample_distance_cm, crs_horizontal, crs_vertical,
         processing_status, quality_metrics, created_by
       ) VALUES (
         $1, 'SRV-MTP-2026-01-15', '2026-01-15T08:30:00Z', 'DJI Matrice 350 RTK', 'Zenmuse P1 45MP RGB',
         120.00, 2.45, 'EPSG:4326', 'WGS84 Ellipsoid',
         'completed', '{"reprojectionErrorPx": 0.42, "alignedPhotos": 482, "tiePoints": 182400}', $2
       ) RETURNING id;`,
      [mtpAreaId, userIds['analyst']]
    );
    const survey1Id = survey1Res.rows[0].id;

    const survey2Res = await client.query(
      `INSERT INTO drone_surveys (
         area_id, survey_code, survey_date, drone_model, sensor_type,
         flight_altitude_m, ground_sample_distance_cm, crs_horizontal, crs_vertical,
         processing_status, quality_metrics, created_by
       ) VALUES (
         $1, 'SRV-MTP-2026-03-15', '2026-03-15T09:15:00Z', 'DJI Matrice 350 RTK', 'Zenmuse P1 45MP RGB',
         120.00, 2.42, 'EPSG:4326', 'WGS84 Ellipsoid',
         'completed', '{"reprojectionErrorPx": 0.38, "alignedPhotos": 510, "tiePoints": 204500}', $2
       ) RETURNING id;`,
      [mtpAreaId, userIds['analyst']]
    );
    const survey2Id = survey2Res.rows[0].id;

    // 6. Survey Assets (Orthomosaic, DSM, 3D Tiles)
    const assets = [
      {
        surveyId: survey1Id,
        type: 'orthomosaic',
        name: 'MTP_20260115_Orthomosaic.tif',
        key: 'surveys/mtp-20260115/orthomosaic.tif',
        size: 342000000,
        mime: 'image/tiff',
      },
      {
        surveyId: survey1Id,
        type: 'dsm_raster',
        name: 'MTP_20260115_DSM.tif',
        key: 'surveys/mtp-20260115/dsm.tif',
        size: 198000000,
        mime: 'image/tiff',
      },
      {
        surveyId: survey2Id,
        type: 'orthomosaic',
        name: 'MTP_20260315_Orthomosaic.tif',
        key: 'surveys/mtp-20260315/orthomosaic.tif',
        size: 358000000,
        mime: 'image/tiff',
      },
      {
        surveyId: survey2Id,
        type: 'dsm_raster',
        name: 'MTP_20260315_DSM.tif',
        key: 'surveys/mtp-20260315/dsm.tif',
        size: 204000000,
        mime: 'image/tiff',
      },
      {
        surveyId: survey2Id,
        type: 'tiles_3d',
        name: 'tileset.json',
        key: 'surveys/mtp-20260315/3dtiles/tileset.json',
        size: 45000000,
        mime: 'application/json',
      },
    ];

    for (const ass of assets) {
      await client.query(
        `INSERT INTO survey_assets (
           survey_id, asset_type, storage_bucket, storage_key,
           file_name, file_size_bytes, mime_type, checksum_sha256, is_primary
         ) VALUES ($1, $2, 'geomonitor-assets', $3, $4, $5, $6, 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0', true);`,
        [ass.surveyId, ass.type, ass.key, ass.name, ass.size, ass.mime]
      );
    }

    // 7. Change Analysis between Survey 1 & Survey 2
    const analysisRes = await client.query(
      `INSERT INTO change_analyses (
         area_id, baseline_survey_id, comparison_survey_id, analysis_type,
         total_change_area_sqm, cut_volume_m3, fill_volume_m3, net_volume_m3,
         confidence_score, status, limitations_notes, created_by
       ) VALUES (
         $1, $2, $3, 'combined',
         62400.0, 120500.0, 85400.0, -35100.0,
         0.92, 'pending_review',
         'ตรวจพบการขุดลอกแอ่งเทียบเรือ (Cut) และงานถมคันดินกั้นคลื่น (Fill) ข้อมูลไม่รวมพื้นที่ติดชายฝั่งที่มีเงาคลื่นสะท้อน',
         $4
       ) RETURNING id;`,
      [mtpAreaId, survey1Id, survey2Id, userIds['analyst']]
    );
    const analysisId = analysisRes.rows[0].id;

    // 8. Change Features (Polygons with cut/fill attributes)
    const changeFeaturesData = [
      {
        type: 'earthwork_fill',
        coords: [[[101.1420, 12.6710], [101.1470, 12.6710], [101.1470, 12.6760], [101.1420, 12.6760], [101.1420, 12.6710]]],
        meanElev: 3.45,
        maxElev: 5.20,
        volume: 85400.0,
        confirmed: true,
      },
      {
        type: 'earthwork_cut',
        coords: [[[101.1490, 12.6730], [101.1530, 12.6730], [101.1530, 12.6790], [101.1490, 12.6790], [101.1490, 12.6730]]],
        meanElev: -4.10,
        maxElev: -6.80,
        volume: 120500.0,
        confirmed: true,
      },
      {
        type: 'construction_new',
        coords: [[[101.1370, 12.6750], [101.1400, 12.6750], [101.1400, 12.6780], [101.1370, 12.6780], [101.1370, 12.6750]]],
        meanElev: 12.50,
        maxElev: 18.20,
        volume: 15200.0,
        confirmed: false,
      },
    ];

    for (const cf of changeFeaturesData) {
      const geojsonStr = JSON.stringify({ type: 'Polygon', coordinates: cf.coords });
      const cfRes = await client.query(
        `INSERT INTO change_features (
           change_analysis_id, feature_type, geometry, area_sqm,
           mean_elevation_change_m, max_elevation_change_m, estimated_volume_m3,
           is_confirmed, confidence
         ) VALUES (
           $1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326),
           ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), 32647)),
           $4, $5, $6, $7, 0.92
         ) RETURNING id;`,
        [analysisId, cf.type, geojsonStr, cf.meanElev, cf.maxElev, cf.volume, cf.confirmed]
      );

      // Add Analyst Annotation
      await client.query(
        `INSERT INTO analyst_annotations (change_feature_id, author_id, status, notes)
         VALUES ($1, $2, $3, $4);`,
        [
          cfRes.rows[0].id,
          userIds['analyst'],
          cf.confirmed ? 'confirmed_change' : 'candidate',
          cf.confirmed
            ? 'ตรวจสอบและเทียบพิกัดจุดควบคุมภาคพื้นดิน (GCP) เรียบร้อย ยืนยันปริมาตรถูกต้อง'
            : 'ตรวจพบโครงสร้างอาคารสำนักงานและถังพักวัตถุดิบชั่วคราวใหม่',
        ]
      );
    }

    // 9. Initial Audit Log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, payload_diff)
       VALUES ($1, 'system.seed', 'managed_areas', $2, '127.0.0.1', 'Node/SeedScript', '{"message": "Initial seed completed"}');`,
      [userIds['admin'], mtpAreaId]
    );

    await client.query('COMMIT;');
    console.log('[Seed] Database seeding completed successfully!');
    console.log('--- Default User Accounts ---');
    console.log('Admin:   admin@geomonitor.local   / Password123!');
    console.log('PM:      pm@geomonitor.local      / Password123!');
    console.log('Analyst: analyst@geomonitor.local / Password123!');
    console.log('Viewer:  viewer@geomonitor.local  / Password123!');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('[Seed] Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
