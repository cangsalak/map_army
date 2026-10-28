import { Router, Request, Response } from 'express';
import { IngestLocationUpdateSchema } from '@geomonitor/shared';
import { pool } from '../../db/index.js';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { logAuditEvent } from '../../middlewares/audit.middleware.js';

export const locationUpdatesRouter = Router();
locationUpdatesRouter.use(authenticate);

/**
 * POST /api/v1/location-updates
 * Ingest authorized location update from field client
 */
locationUpdatesRouter.post(
  '/location-updates',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const input = IngestLocationUpdateSchema.parse(req.body);

      // Verify Project and Organization
      const projRes = await pool.query(`SELECT id, organization_id FROM projects WHERE id = $1;`, [input.projectId]);
      if (projRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบโครงการ' } });
      }

      const organizationId = projRes.rows[0].organization_id;

      // Determine freshness status based on timestamp age
      const now = Date.now();
      const updateTime = new Date(input.timestamp).getTime();
      const ageMinutes = (now - updateTime) / (1000 * 60);

      let freshness: 'live' | 'stale' | 'unavailable' = 'live';
      if (ageMinutes > 60) {
        freshness = 'unavailable';
      } else if (ageMinutes > 5) {
        freshness = 'stale';
      }

      const insertSql = `
        INSERT INTO authorized_location_updates (
          organization_id, project_id, team_id, device_identifier,
          timestamp, geometry, altitude_m, accuracy_m, source,
          freshness_status, consent_confirmed
        ) VALUES (
          $1, $2, $3, $4,
          $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9, $10,
          $11, $12
        ) RETURNING 
          id, organization_id as "organizationId", project_id as "projectId",
          team_id as "teamId", device_identifier as "deviceIdentifier",
          timestamp, ST_Y(geometry) as latitude, ST_X(geometry) as longitude,
          altitude_m as "altitudeM", accuracy_m as "accuracyM", source,
          freshness_status as "freshnessStatus", consent_confirmed as "consentConfirmed",
          created_at as "createdAt";
      `;

      const result = await pool.query(insertSql, [
        organizationId,
        input.projectId,
        input.teamId || null,
        input.deviceIdentifier,
        input.timestamp,
        input.longitude,
        input.latitude,
        input.altitudeM || null,
        input.accuracyM || null,
        input.source,
        freshness,
        input.consentConfirmed,
      ]);

      return res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'บันทึกพิกัดตำแหน่งภาคสนามที่ได้รับอนุญาตเรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/location-updates/latest
 * Retrieve the latest location of all active teams in a project
 */
locationUpdatesRouter.get('/location-updates/latest', async (req: Request, res: Response, next) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_PROJECT', message: 'ต้องระบุ projectId' } });
    }

    const sql = `
      SELECT DISTINCT ON (u.team_id)
        u.id,
        u.project_id as "projectId",
        u.team_id as "teamId",
        t.name as "teamName",
        t.identifier as "teamIdentifier",
        t.status as "teamStatus",
        u.device_identifier as "deviceIdentifier",
        u.timestamp,
        ST_Y(u.geometry) as latitude,
        ST_X(u.geometry) as longitude,
        u.altitude_m as "altitudeM",
        u.accuracy_m as "accuracyM",
        u.source,
        CASE 
          WHEN (NOW() - u.timestamp) > INTERVAL '60 minutes' THEN 'unavailable'
          WHEN (NOW() - u.timestamp) > INTERVAL '5 minutes' THEN 'stale'
          ELSE 'live'
        END as "freshnessStatus"
      FROM authorized_location_updates u
      JOIN teams t ON u.team_id = t.id
      WHERE u.project_id = $1
      ORDER BY u.team_id, u.timestamp DESC;
    `;

    const result = await pool.query(sql, [projectId]);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/location-updates/history
 * Query historical location records for a team (Audited Access)
 */
locationUpdatesRouter.get(
  '/location-updates/history',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const { teamId, fromTime, toTime, limit = 200 } = req.query;

      if (!teamId) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_TEAM', message: 'ต้องระบุ teamId' } });
      }

      let sql = `
        SELECT 
          u.id,
          u.team_id as "teamId",
          u.device_identifier as "deviceIdentifier",
          u.timestamp,
          ST_Y(u.geometry) as latitude,
          ST_X(u.geometry) as longitude,
          u.altitude_m as "altitudeM",
          u.accuracy_m as "accuracyM",
          u.source,
          u.created_at as "createdAt"
        FROM authorized_location_updates u
        WHERE u.team_id = $1
      `;
      const params: any[] = [teamId];

      if (fromTime) {
        params.push(fromTime);
        sql += ` AND u.timestamp >= $${params.length}`;
      }

      if (toTime) {
        params.push(toTime);
        sql += ` AND u.timestamp <= $${params.length}`;
      }

      params.push(Number(limit));
      sql += ` ORDER BY u.timestamp ASC LIMIT $${params.length};`;

      const result = await pool.query(sql, params);

      // Audit Log for sensitive location history access
      await pool.query(
        `INSERT INTO location_access_logs (user_id, action, resource_type, resource_id, query_filters, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [
          req.user!.id,
          'location_history.query',
          'teams',
          teamId,
          JSON.stringify({ fromTime, toTime, count: result.rows.length }),
          req.ip,
          req.headers['user-agent'] || null,
        ]
      );

      return res.status(200).json({
        success: true,
        data: {
          teamId,
          records: result.rows,
        },
      });
    } catch (err) {
      return next(err);
    }
  }
);
