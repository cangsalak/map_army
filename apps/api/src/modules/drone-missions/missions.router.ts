import { Router, Request, Response } from 'express';
import { pool } from '../../db/index.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { logAuditEvent } from '../../middlewares/audit.middleware.js';

export const missionsRouter = Router();
missionsRouter.use(authenticate);

/**
 * GET /api/v1/missions
 * List all drone missions for the user's organization
 */
missionsRouter.get('/missions', async (req: Request, res: Response, next) => {
  try {
    const { projectId } = req.query;
    let sql = `
      SELECT 
        m.id,
        m.organization_id as "organizationId",
        m.project_id as "projectId",
        p.name as "projectName",
        m.area_id as "areaId",
        m.name,
        m.description,
        m.drone_model as "droneModel",
        m.camera_model as "cameraModel",
        m.mission_type as "missionType",
        m.flight_speed_ms as "flightSpeedMs",
        m.target_altitude_m as "targetAltitudeM",
        m.altitude_reference as "altitudeReference",
        m.rth_altitude_m as "rthAltitudeM",
        m.survey_boundary as "surveyBoundary",
        m.home_point as "homePoint",
        m.takeoff_point as "takeoffPoint",
        m.landing_point as "landingPoint",
        m.finish_action as "finishAction",
        m.photogrammetry_config as "photogrammetryConfig",
        m.grid_config as "gridConfig",
        m.statistics,
        m.validation_result as "validationResult",
        m.version,
        m.created_by as "createdBy",
        u.full_name as "createdByName",
        m.created_at as "createdAt",
        m.updated_at as "updatedAt",
        (SELECT COUNT(*)::int FROM drone_mission_waypoints w WHERE w.mission_id = m.id) as "waypointCount"
      FROM drone_missions m
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (projectId) {
      params.push(projectId);
      sql += ` AND m.project_id = $${params.length}`;
    }

    sql += ` ORDER BY m.updated_at DESC;`;

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/missions/:id
 * Get single mission with full waypoints and export history
 */
missionsRouter.get('/missions/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const missionRes = await pool.query(
      `SELECT 
        m.id,
        m.organization_id as "organizationId",
        m.project_id as "projectId",
        p.name as "projectName",
        m.area_id as "areaId",
        m.name,
        m.description,
        m.drone_model as "droneModel",
        m.camera_model as "cameraModel",
        m.mission_type as "missionType",
        m.flight_speed_ms as "flightSpeedMs",
        m.target_altitude_m as "targetAltitudeM",
        m.altitude_reference as "altitudeReference",
        m.rth_altitude_m as "rthAltitudeM",
        m.survey_boundary as "surveyBoundary",
        m.home_point as "homePoint",
        m.takeoff_point as "takeoffPoint",
        m.landing_point as "landingPoint",
        m.finish_action as "finishAction",
        m.photogrammetry_config as "photogrammetryConfig",
        m.grid_config as "gridConfig",
        m.statistics,
        m.validation_result as "validationResult",
        m.version,
        m.created_by as "createdBy",
        u.full_name as "createdByName",
        m.created_at as "createdAt",
        m.updated_at as "updatedAt"
      FROM drone_missions m
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = $1`,
      [id]
    );

    if (missionRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'ไม่พบภารกิจการบินที่ระบุ' },
      });
    }

    const waypointsRes = await pool.query(
      `SELECT 
        id,
        sequence_number as "sequenceNumber",
        latitude,
        longitude,
        altitude_m as "altitudeM",
        speed_ms as "speedMs",
        heading_deg as "headingDeg",
        gimbal_pitch_deg as "gimbalPitchDeg",
        turn_mode as "turnMode",
        actions
      FROM drone_mission_waypoints
      WHERE mission_id = $1
      ORDER BY sequence_number ASC`,
      [id]
    );

    const exportsRes = await pool.query(
      `SELECT 
        id,
        mission_version as "missionVersion",
        export_target as "exportTarget",
        file_format as "fileFormat",
        file_name as "fileName",
        file_size_bytes as "fileSizeBytes",
        validation_snapshot as "validationSnapshot",
        created_at as "createdAt"
      FROM drone_mission_exports
      WHERE mission_id = $1
      ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...missionRes.rows[0],
        waypoints: waypointsRes.rows,
        exports: exportsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/missions
 * Create new drone mission with optional waypoints
 */
missionsRouter.post('/missions', async (req: Request, res: Response, next) => {
  const client = await pool.connect();
  try {
    const user = (req as any).user;
    const body = req.body;

    await client.query('BEGIN;');

    // Resolve project/org
    let projectId = body.projectId;
    let organizationId = user?.organizationId;

    if (!projectId) {
      const projRes = await client.query('SELECT id, organization_id FROM projects LIMIT 1');
      if (projRes.rows.length > 0) {
        projectId = projRes.rows[0].id;
        organizationId = organizationId || projRes.rows[0].organization_id;
      }
    }

    const insertMissionSql = `
      INSERT INTO drone_missions (
        organization_id, project_id, area_id, name, description,
        drone_model, camera_model, mission_type, flight_speed_ms,
        target_altitude_m, altitude_reference, rth_altitude_m,
        survey_boundary, home_point, takeoff_point, landing_point,
        finish_action, photogrammetry_config, grid_config, statistics,
        validation_result, version, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, 1, $22
      ) RETURNING id, version, created_at, updated_at;
    `;

    const missionRes = await client.query(insertMissionSql, [
      organizationId,
      projectId,
      body.areaId || null,
      body.name || 'ภารกิจสำรวจบินใหม่',
      body.description || '',
      body.droneModel || 'DJI Matrice 350 RTK',
      body.cameraModel || 'DJI Zenmuse P1 (35mm)',
      body.missionType || 'grid_survey',
      body.flightSpeedMs || 10.0,
      body.targetAltitudeM || 80.0,
      body.altitudeReference || 'relative_to_home',
      body.rthAltitudeM || 100.0,
      JSON.stringify(body.surveyBoundary || null),
      JSON.stringify(body.homePoint || null),
      JSON.stringify(body.takeoffPoint || null),
      JSON.stringify(body.landingPoint || null),
      body.finishAction || 'go_home',
      JSON.stringify(body.photogrammetryConfig || {}),
      JSON.stringify(body.gridConfig || {}),
      JSON.stringify(body.statistics || {}),
      JSON.stringify(body.validationResult || {}),
      user?.userId || null,
    ]);

    const newMissionId = missionRes.rows[0].id;

    // Insert waypoints if present
    if (Array.isArray(body.waypoints) && body.waypoints.length > 0) {
      for (let i = 0; i < body.waypoints.length; i++) {
        const wp = body.waypoints[i];
        await client.query(
          `INSERT INTO drone_mission_waypoints (
            mission_id, sequence_number, latitude, longitude,
            altitude_m, speed_ms, heading_deg, gimbal_pitch_deg,
            turn_mode, actions
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            newMissionId,
            i + 1,
            wp.latitude,
            wp.longitude,
            wp.altitudeM ?? body.targetAltitudeM ?? 80.0,
            wp.speedMs ?? body.flightSpeedMs ?? 10.0,
            wp.headingDeg ?? 0,
            wp.gimbalPitchDeg ?? -90,
            wp.turnMode ?? 'to_point_and_stop',
            JSON.stringify(wp.actions || []),
          ]
        );
      }
    }

    await client.query('COMMIT;');

    await logAuditEvent({
      userId: user?.userId,
      action: 'DRONE_MISSION_CREATED',
      resourceType: 'drone_mission',
      resourceId: String(newMissionId),
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      payloadDiff: { name: body.name, missionType: body.missionType, waypointsCount: body.waypoints?.length || 0 },
    });

    res.status(201).json({
      success: true,
      data: {
        id: newMissionId,
        message: 'สร้างภารกิจการบินเรียบร้อยแล้ว',
      },
    });
  } catch (err) {
    await client.query('ROLLBACK;');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/v1/missions/:id
 * Update mission & increment version
 */
missionsRouter.patch('/missions/:id', async (req: Request, res: Response, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const body = req.body;

    await client.query('BEGIN;');

    const currentRes = await client.query('SELECT version FROM drone_missions WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      await client.query('ROLLBACK;');
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'ไม่พบภารกิจที่ต้องการแก้ไข' },
      });
    }

    const nextVersion = (currentRes.rows[0].version || 1) + 1;

    const updateSql = `
      UPDATE drone_missions SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        drone_model = COALESCE($3, drone_model),
        camera_model = COALESCE($4, camera_model),
        mission_type = COALESCE($5, mission_type),
        flight_speed_ms = COALESCE($6, flight_speed_ms),
        target_altitude_m = COALESCE($7, target_altitude_m),
        altitude_reference = COALESCE($8, altitude_reference),
        rth_altitude_m = COALESCE($9, rth_altitude_m),
        survey_boundary = CASE WHEN $10::jsonb IS NOT NULL THEN $10::jsonb ELSE survey_boundary END,
        home_point = CASE WHEN $11::jsonb IS NOT NULL THEN $11::jsonb ELSE home_point END,
        takeoff_point = CASE WHEN $12::jsonb IS NOT NULL THEN $12::jsonb ELSE takeoff_point END,
        landing_point = CASE WHEN $13::jsonb IS NOT NULL THEN $13::jsonb ELSE landing_point END,
        finish_action = COALESCE($14, finish_action),
        photogrammetry_config = CASE WHEN $15::jsonb IS NOT NULL THEN $15::jsonb ELSE photogrammetry_config END,
        grid_config = CASE WHEN $16::jsonb IS NOT NULL THEN $16::jsonb ELSE grid_config END,
        statistics = CASE WHEN $17::jsonb IS NOT NULL THEN $17::jsonb ELSE statistics END,
        validation_result = CASE WHEN $18::jsonb IS NOT NULL THEN $18::jsonb ELSE validation_result END,
        version = $19,
        updated_at = NOW()
      WHERE id = $20
      RETURNING id, version, updated_at;
    `;

    await client.query(updateSql, [
      body.name,
      body.description,
      body.droneModel,
      body.cameraModel,
      body.missionType,
      body.flightSpeedMs,
      body.targetAltitudeM,
      body.altitudeReference,
      body.rthAltitudeM,
      body.surveyBoundary ? JSON.stringify(body.surveyBoundary) : null,
      body.homePoint ? JSON.stringify(body.homePoint) : null,
      body.takeoffPoint ? JSON.stringify(body.takeoffPoint) : null,
      body.landingPoint ? JSON.stringify(body.landingPoint) : null,
      body.finishAction,
      body.photogrammetryConfig ? JSON.stringify(body.photogrammetryConfig) : null,
      body.gridConfig ? JSON.stringify(body.gridConfig) : null,
      body.statistics ? JSON.stringify(body.statistics) : null,
      body.validationResult ? JSON.stringify(body.validationResult) : null,
      nextVersion,
      id,
    ]);

    // If new waypoints are supplied, overwrite waypoints table
    if (Array.isArray(body.waypoints)) {
      await client.query('DELETE FROM drone_mission_waypoints WHERE mission_id = $1', [id]);
      for (let i = 0; i < body.waypoints.length; i++) {
        const wp = body.waypoints[i];
        await client.query(
          `INSERT INTO drone_mission_waypoints (
            mission_id, sequence_number, latitude, longitude,
            altitude_m, speed_ms, heading_deg, gimbal_pitch_deg,
            turn_mode, actions
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            id,
            i + 1,
            wp.latitude,
            wp.longitude,
            wp.altitudeM ?? body.targetAltitudeM ?? 80.0,
            wp.speedMs ?? body.flightSpeedMs ?? 10.0,
            wp.headingDeg ?? 0,
            wp.gimbalPitchDeg ?? -90,
            wp.turnMode ?? 'to_point_and_stop',
            JSON.stringify(wp.actions || []),
          ]
        );
      }
    }

    await client.query('COMMIT;');

    await logAuditEvent({
      userId: user?.userId,
      action: 'DRONE_MISSION_UPDATED',
      resourceType: 'drone_mission',
      resourceId: String(id),
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      payloadDiff: { version: nextVersion, waypointsUpdated: Array.isArray(body.waypoints) },
    });

    res.json({
      success: true,
      data: {
        id,
        version: nextVersion,
        message: 'อัปเดตภารกิจเรียบร้อยแล้ว',
      },
    });
  } catch (err) {
    await client.query('ROLLBACK;');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/v1/missions/:id
 * Delete a drone mission
 */
missionsRouter.delete('/missions/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const delRes = await pool.query('DELETE FROM drone_missions WHERE id = $1 RETURNING id, name', [id]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'ไม่พบภารกิจที่ต้องการลบ' },
      });
    }

    await logAuditEvent({
      userId: user?.userId,
      action: 'DRONE_MISSION_DELETED',
      resourceType: 'drone_mission',
      resourceId: String(id),
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      payloadDiff: { name: delRes.rows[0].name },
    });

    res.json({
      success: true,
      data: { id, message: 'ลบภารกิจเรียบร้อยแล้ว' },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/missions/:id/export
 * Record an export record
 */
missionsRouter.post('/missions/:id/export', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { exportTarget, fileFormat, fileName, fileSizeBytes, validationSnapshot } = req.body;

    const missionRes = await pool.query('SELECT version FROM drone_missions WHERE id = $1', [id]);
    if (missionRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'ไม่พบภารกิจที่ต้องการส่งออก' },
      });
    }

    const version = missionRes.rows[0].version || 1;

    const exportInsert = await pool.query(
      `INSERT INTO drone_mission_exports (
        mission_id, mission_version, export_target, file_format,
        file_name, file_size_bytes, validation_snapshot, exported_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, created_at;`,
      [
        id,
        version,
        exportTarget || 'dji_wpml',
        fileFormat || 'kmz',
        fileName || 'mission.kmz',
        fileSizeBytes || 0,
        JSON.stringify(validationSnapshot || {}),
        user?.userId || null,
      ]
    );

    await logAuditEvent({
      userId: user?.userId,
      action: 'DRONE_MISSION_EXPORTED',
      resourceType: 'drone_mission',
      resourceId: String(id),
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      payloadDiff: { exportTarget, fileFormat, fileName, version },
    });

    res.status(201).json({
      success: true,
      data: exportInsert.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

import { PLATFORM_REGISTRY, validatePlatformCompatibility } from './drone-platform-registry.js';
import { PlatformId } from '@geomonitor/shared';

/**
 * GET /api/v1/drone/platforms
 * List all verified drone platforms & capability profiles
 */
missionsRouter.get('/drone/platforms', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(PLATFORM_REGISTRY),
  });
});

/**
 * GET /api/v1/drone/platforms/:id/capabilities
 * Get specific platform capability profile
 */
missionsRouter.get('/drone/platforms/:id/capabilities', async (req: Request, res: Response) => {
  const platformId = req.params.id as PlatformId;
  const caps = PLATFORM_REGISTRY[platformId];
  if (!caps) {
    return res.status(404).json({
      success: false,
      error: { code: 'PLATFORM_NOT_FOUND', message: `ไม่พบแพลตฟอร์ม ${platformId}` },
    });
  }
  res.json({
    success: true,
    data: caps,
  });
});

/**
 * POST /api/v1/missions/:id/validate
 * Run multi-axis safety and platform capability validation
 */
missionsRouter.post('/missions/:id/validate', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const { targetPlatform } = req.body;

    const missionRes = await pool.query('SELECT * FROM drone_missions WHERE id = $1', [id]);
    if (missionRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'ไม่พบภารกิจที่ต้องการตรวจสอบ' },
      });
    }

    const mission = missionRes.rows[0];
    const waypointsRes = await pool.query(
      'SELECT COUNT(*)::int as count FROM drone_mission_waypoints WHERE mission_id = $1',
      [id]
    );
    const count = waypointsRes.rows[0]?.count || 0;

    const platform = (targetPlatform || 'dji_mini_4_pro') as PlatformId;
    const issues = validatePlatformCompatibility(
      platform,
      {
        missionType: mission.mission_type,
        altitudeReference: mission.altitude_reference,
        flightAltitudeMeters: Number(mission.target_altitude_m),
      },
      count,
      Number(mission.statistics?.totalDistanceMeters || 0)
    );

    const hasError = issues.some((i) => i.level === 'error');
    const hasWarning = issues.some((i) => i.level === 'warning');
    const status = hasError ? 'BLOCKED' : hasWarning ? 'WARNING' : 'PASS';

    await pool.query(
      'UPDATE drone_missions SET validation_result = $1 WHERE id = $2',
      [JSON.stringify({ status, issues }), id]
    );

    res.json({
      success: true,
      data: { status, issues },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/missions/:id/upload
 * Queue mission for upload to aircraft via companion bridge
 */
missionsRouter.post('/missions/:id/upload', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { targetPlatform } = req.body;

    const missionRes = await pool.query('SELECT * FROM drone_missions WHERE id = $1', [id]);
    if (missionRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'ไม่พบภารกิจที่ต้องการอัปโหลด' },
      });
    }

    const platform = (targetPlatform || 'dji_mini_4_pro') as PlatformId;
    const caps = PLATFORM_REGISTRY[platform];

    if (!caps || !caps.supportsLiveUpload) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UPLOAD_NOT_SUPPORTED',
          message: `แพลตฟอร์ม ${platform} ไม่รองรับการอัปโหลดอัตโนมัติผ่านระบบนี้`,
        },
      });
    }

    const uploadId = `upload-${id.slice(0, 8)}-${Date.now()}`;

    await logAuditEvent({
      userId: user?.userId,
      action: 'DRONE_MISSION_UPLOAD_INITIATED',
      resourceType: 'drone_mission',
      resourceId: String(id),
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
      payloadDiff: { uploadId, targetPlatform: platform },
    });

    res.status(202).json({
      success: true,
      data: {
        uploadId,
        missionId: id,
        targetPlatform: platform,
        state: 'QUEUED_FOR_BRIDGE',
        message: 'ส่งข้อมูลภารกิจเข้าคิวของ GeoMonitor Drone Bridge สำเร็จ รอยืนยันคำสั่งจากผู้ปฏิบัติงาน',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

