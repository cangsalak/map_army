import { Router, Request, Response } from 'express';
import { CreateTeamSchema, UpdateTeamSchema, AddTeamMemberSchema } from '@geomonitor/shared';
import { pool } from '../../db/index.js';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { logAuditEvent } from '../../middlewares/audit.middleware.js';

export const teamsRouter = Router();
teamsRouter.use(authenticate);

/**
 * GET /api/v1/teams
 * Query teams by project with optional status filter
 */
teamsRouter.get('/teams', async (req: Request, res: Response, next) => {
  try {
    const { projectId, status } = req.query;

    let sql = `
      SELECT 
        t.id,
        t.organization_id as "organizationId",
        t.project_id as "projectId",
        p.name as "projectName",
        t.name,
        t.identifier,
        t.description,
        t.status,
        t.team_leader_id as "teamLeaderId",
        u.full_name as "teamLeaderName",
        COUNT(m.id)::int as "memberCount",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt"
      FROM teams t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.team_leader_id = u.id
      LEFT JOIN team_members m ON t.id = m.team_id AND m.is_active = TRUE
      WHERE 1=1
    `;
    const params: any[] = [];

    if (projectId) {
      params.push(projectId);
      sql += ` AND t.project_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND t.status = $${params.length}`;
    }

    sql += ` GROUP BY t.id, p.name, u.full_name ORDER BY t.created_at DESC;`;

    const result = await pool.query(sql, params);

    // Also fetch latest location for each team if any
    const teamsWithLocation = await Promise.all(
      result.rows.map(async (team) => {
        const locRes = await pool.query(
          `SELECT 
             ST_Y(geometry::geometry) as latitude,
             ST_X(geometry::geometry) as longitude,
             altitude_m as "altitudeM",
             timestamp,
             freshness_status as "freshness"
           FROM authorized_location_updates
           WHERE team_id = $1
           ORDER BY timestamp DESC
           LIMIT 1;`,
          [team.id]
        );
        return {
          ...team,
          latestLocation: locRes.rows[0] || null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: teamsWithLocation,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/teams
 * Create a new team
 */
teamsRouter.post(
  '/teams',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const input = CreateTeamSchema.parse(req.body);

      // Verify Project
      const projRes = await pool.query(`SELECT id, organization_id FROM projects WHERE id = $1;`, [input.projectId]);
      if (projRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบโครงการที่ระบุ' } });
      }

      const organizationId = projRes.rows[0].organization_id;

      const insertSql = `
        INSERT INTO teams (
          organization_id, project_id, name, identifier, description, status, team_leader_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
        RETURNING 
          id, organization_id as "organizationId", project_id as "projectId",
          name, identifier, description, status, team_leader_id as "teamLeaderId",
          created_at as "createdAt", updated_at as "updatedAt";
      `;

      const result = await pool.query(insertSql, [
        organizationId,
        input.projectId,
        input.name,
        input.identifier,
        input.description || null,
        input.status,
        input.teamLeaderId || null,
        req.user!.id,
      ]);

      const team = result.rows[0];

      await logAuditEvent({
        userId: req.user!.id,
        action: 'team.create',
        resourceType: 'teams',
        resourceId: team.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: { name: team.name, identifier: team.identifier },
      });

      return res.status(201).json({
        success: true,
        data: team,
        message: 'สร้างทีมปฏิบัติการเรียบร้อยแล้ว',
      });
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_IDENTIFIER', message: 'รหัสประจำทีมนี้ถูกใช้งานแล้วในโครงการ' },
        });
      }
      return next(err);
    }
  }
);

/**
 * GET /api/v1/teams/:id
 * Retrieve team details with members and location history
 */
teamsRouter.get('/teams/:id', async (req: Request, res: Response, next) => {
  try {
    const teamId = req.params.id;

    const teamRes = await pool.query(
      `SELECT 
         t.id, t.organization_id as "organizationId", t.project_id as "projectId",
         p.name as "projectName", t.name, t.identifier, t.description, t.status,
         t.team_leader_id as "teamLeaderId", u.full_name as "teamLeaderName",
         t.created_at as "createdAt", t.updated_at as "updatedAt"
       FROM teams t
       JOIN projects p ON t.project_id = p.id
       LEFT JOIN users u ON t.team_leader_id = u.id
       WHERE t.id = $1;`,
      [teamId]
    );

    if (teamRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบทีมที่ระบุ' } });
    }

    const membersRes = await pool.query(
      `SELECT 
         m.id, m.team_id as "teamId", m.user_id as "userId",
         m.callsign, m.role_in_team as "roleInTeam", m.is_active as "isActive",
         m.joined_at as "joinedAt", u.full_name as "userName"
       FROM team_members m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.team_id = $1
       ORDER BY m.joined_at ASC;`,
      [teamId]
    );

    const locRes = await pool.query(
      `SELECT 
         ST_Y(geometry::geometry) as latitude,
         ST_X(geometry::geometry) as longitude,
         altitude_m as "altitudeM",
         timestamp,
         freshness_status as "freshness"
       FROM authorized_location_updates
       WHERE team_id = $1
       ORDER BY timestamp DESC
       LIMIT 1;`,
      [teamId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...teamRes.rows[0],
        members: membersRes.rows,
        latestLocation: locRes.rows[0] || null,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /api/v1/teams/:id
 * Update team information or status
 */
teamsRouter.patch(
  '/teams/:id',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const teamId = req.params.id;
      const input = UpdateTeamSchema.parse(req.body);

      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (input.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(input.name);
      }
      if (input.identifier !== undefined) {
        fields.push(`identifier = $${idx++}`);
        values.push(input.identifier);
      }
      if (input.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(input.description);
      }
      if (input.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(input.status);
      }
      if (input.teamLeaderId !== undefined) {
        fields.push(`team_leader_id = $${idx++}`);
        values.push(input.teamLeaderId);
      }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'NO_FIELDS', message: 'ไม่มีข้อมูลที่ต้องอัปเดต' } });
      }

      fields.push(`updated_at = NOW()`);
      values.push(teamId);

      const updateSql = `
        UPDATE teams 
        SET ${fields.join(', ')}
        WHERE id = $${idx}
        RETURNING 
          id, organization_id as "organizationId", project_id as "projectId",
          name, identifier, description, status, team_leader_id as "teamLeaderId",
          updated_at as "updatedAt";
      `;

      const result = await pool.query(updateSql, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบทีม' } });
      }

      await logAuditEvent({
        userId: req.user!.id,
        action: 'team.update',
        resourceType: 'teams',
        resourceId: String(teamId),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: input,
      });

      return res.status(200).json({
        success: true,
        data: result.rows[0],
        message: 'อัปเดตข้อมูลทีมเรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /api/v1/teams/:id
 * Delete team
 */
teamsRouter.delete(
  '/teams/:id',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const teamId = req.params.id;
      const result = await pool.query(`DELETE FROM teams WHERE id = $1 RETURNING id, name;`, [teamId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบทีม' } });
      }

      await logAuditEvent({
        userId: req.user!.id,
        action: 'team.delete',
        resourceType: 'teams',
        resourceId: String(teamId),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: { name: result.rows[0].name },
      });

      return res.status(200).json({ success: true, message: 'ลบทีมเรียบร้อยแล้ว' });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/teams/:id/members
 * Add member to team
 */
teamsRouter.post(
  '/teams/:id/members',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const teamId = req.params.id;
      const input = AddTeamMemberSchema.parse(req.body);

      const teamCheck = await pool.query(`SELECT id FROM teams WHERE id = $1;`, [teamId]);
      if (teamCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบทีม' } });
      }

      const insertSql = `
        INSERT INTO team_members (team_id, user_id, callsign, role_in_team, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, team_id as "teamId", user_id as "userId", callsign, role_in_team as "roleInTeam", is_active as "isActive", joined_at as "joinedAt";
      `;

      const result = await pool.query(insertSql, [
        teamId,
        input.userId || null,
        input.callsign,
        input.roleInTeam,
        input.isActive,
      ]);

      return res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'เพิ่มสมาชิกเข้าทีมเรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /api/v1/teams/:id/members/:memberId
 * Remove member from team
 */
teamsRouter.delete(
  '/teams/:id/members/:memberId',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const { id: teamId, memberId } = req.params;
      const result = await pool.query(
        `DELETE FROM team_members WHERE id = $1 AND team_id = $2 RETURNING id;`,
        [memberId, teamId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบสมาชิกในทีมนี้' } });
      }

      return res.status(200).json({ success: true, message: 'นำสมาชิกออกจากทีมเรียบร้อยแล้ว' });
    } catch (err) {
      return next(err);
    }
  }
);
