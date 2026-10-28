import { Router, Request, Response } from 'express';
import {
  CreateSimulationSessionSchema,
  AddSimulationParticipantSchema,
  IngestSimulatedPositionsSchema,
} from '@geomonitor/shared';
import { pool } from '../../db/index.js';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { logAuditEvent } from '../../middlewares/audit.middleware.js';

export const simulationsRouter = Router();
simulationsRouter.use(authenticate);

/**
 * GET /api/v1/simulations
 * Query simulation sessions by project
 */
simulationsRouter.get('/simulations', async (req: Request, res: Response, next) => {
  try {
    const { projectId } = req.query;

    let sql = `
      SELECT 
        s.id,
        s.project_id as "projectId",
        p.name as "projectName",
        s.name,
        s.description,
        s.start_time as "startTime",
        s.end_time as "endTime",
        s.status,
        s.speed_multiplier as "speedMultiplier",
        COUNT(part.id)::int as "participantCount",
        s.created_at as "createdAt",
        s.updated_at as "updatedAt"
      FROM simulation_sessions s
      JOIN projects p ON s.project_id = p.id
      LEFT JOIN simulation_participants part ON s.id = part.session_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (projectId) {
      params.push(projectId);
      sql += ` AND s.project_id = $${params.length}`;
    }

    sql += ` GROUP BY s.id, p.name ORDER BY s.created_at DESC;`;

    const result = await pool.query(sql, params);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/simulations
 * Create a new simulation session
 */
simulationsRouter.post(
  '/simulations',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const input = CreateSimulationSessionSchema.parse(req.body);

      const insertSql = `
        INSERT INTO simulation_sessions (
          project_id, name, description, start_time, end_time, status, speed_multiplier, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, 'ready', $6, $7
        ) RETURNING 
          id, project_id as "projectId", name, description,
          start_time as "startTime", end_time as "endTime", status,
          speed_multiplier as "speedMultiplier", created_at as "createdAt";
      `;

      const result = await pool.query(insertSql, [
        input.projectId,
        input.name,
        input.description || null,
        input.startTime,
        input.endTime,
        input.speedMultiplier,
        req.user!.id,
      ]);

      const session = result.rows[0];

      await logAuditEvent({
        userId: req.user!.id,
        action: 'simulation.create',
        resourceType: 'simulation_sessions',
        resourceId: session.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: { name: session.name, startTime: session.startTime, endTime: session.endTime },
      });

      return res.status(201).json({
        success: true,
        data: session,
        message: 'สร้างรอบการจำลองการเคลื่อนที่เรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/simulations/:id
 * Retrieve simulation session details with participants
 */
simulationsRouter.get('/simulations/:id', async (req: Request, res: Response, next) => {
  try {
    const sessionId = req.params.id;

    const sessionRes = await pool.query(
      `SELECT 
         s.id, s.project_id as "projectId", p.name as "projectName",
         s.name, s.description, s.start_time as "startTime", s.end_time as "endTime",
         s.status, s.speed_multiplier as "speedMultiplier",
         s.created_at as "createdAt", s.updated_at as "updatedAt"
       FROM simulation_sessions s
       JOIN projects p ON s.project_id = p.id
       WHERE s.id = $1;`,
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบรอบการจำลอง' } });
    }

    const participantsRes = await pool.query(
      `SELECT 
         p.id, p.session_id as "sessionId", p.team_id as "teamId", t.name as "teamName",
         p.name, p.callsign, p.icon_symbol as "iconSymbol", p.color_hex as "colorHex"
       FROM simulation_participants p
       LEFT JOIN teams t ON p.team_id = t.id
       WHERE p.session_id = $1
       ORDER BY p.callsign ASC;`,
      [sessionId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...sessionRes.rows[0],
        participants: participantsRes.rows,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/simulations/:id/participants
 * Add a synthetic participant to a simulation
 */
simulationsRouter.post(
  '/simulations/:id/participants',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const sessionId = req.params.id;
      const input = AddSimulationParticipantSchema.parse(req.body);

      const sessionCheck = await pool.query(`SELECT id FROM simulation_sessions WHERE id = $1;`, [sessionId]);
      if (sessionCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบรอบการจำลอง' } });
      }

      const insertSql = `
        INSERT INTO simulation_participants (session_id, team_id, name, callsign, icon_symbol, color_hex)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, session_id as "sessionId", team_id as "teamId", name, callsign, icon_symbol as "iconSymbol", color_hex as "colorHex";
      `;

      const result = await pool.query(insertSql, [
        sessionId,
        input.teamId || null,
        input.name,
        input.callsign,
        input.iconSymbol,
        input.colorHex,
      ]);

      return res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'เพิ่มผู้เข้าร่วมการจำลองเรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/simulations/:id/positions
 * Ingest synthetic timestamped trackpoints
 */
simulationsRouter.post(
  '/simulations/:id/positions',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const input = IngestSimulatedPositionsSchema.parse(req.body);

      const client = await pool.connect();
      try {
        await client.query('BEGIN;');

        for (const pos of input.positions) {
          await client.query(
            `INSERT INTO simulated_positions (
               participant_id, timestamp, geometry, altitude_m, heading_deg, speed_mps, metadata
             ) VALUES (
               $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8
             );`,
            [
              pos.participantId,
              pos.timestamp,
              pos.longitude,
              pos.latitude,
              pos.altitudeM,
              pos.headingDeg,
              pos.speedMps,
              JSON.stringify(pos.metadata || {}),
            ]
          );
        }

        await client.query('COMMIT;');

        return res.status(201).json({
          success: true,
          data: { insertedCount: input.positions.length },
          message: `บันทึกพิกัดจำลองสำเร็จ ${input.positions.length} รายการ`,
        });
      } catch (err) {
        await client.query('ROLLBACK;');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/simulations/:id/timeline
 * Retrieve ordered timestamped positions for deterministic playback
 */
simulationsRouter.get('/simulations/:id/timeline', async (req: Request, res: Response, next) => {
  try {
    const sessionId = req.params.id;

    const sql = `
      SELECT 
        pos.id,
        pos.participant_id as "participantId",
        part.callsign as "participantCallsign",
        part.name as "participantName",
        part.color_hex as "colorHex",
        part.icon_symbol as "iconSymbol",
        pos.timestamp,
        ST_Y(pos.geometry) as latitude,
        ST_X(pos.geometry) as longitude,
        pos.altitude_m as "altitudeM",
        pos.heading_deg as "headingDeg",
        pos.speed_mps as "speedMps",
        pos.metadata
      FROM simulated_positions pos
      JOIN simulation_participants part ON pos.participant_id = part.id
      WHERE part.session_id = $1
      ORDER BY pos.timestamp ASC;
    `;

    const result = await pool.query(sql, [sessionId]);

    return res.status(200).json({
      success: true,
      data: {
        sessionId,
        trackpoints: result.rows,
      },
    });
  } catch (err) {
    return next(err);
  }
});
