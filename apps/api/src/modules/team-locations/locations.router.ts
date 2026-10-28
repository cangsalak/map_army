import { Router, Request, Response } from 'express';
import { CreateTeamLocationSchema, UpdateTeamLocationSchema } from '@geomonitor/shared';
import { pool } from '../../db/index.js';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { logAuditEvent } from '../../middlewares/audit.middleware.js';

export const locationsRouter = Router();
locationsRouter.use(authenticate);

/**
 * GET /api/v1/locations
 * Query team locations with optional project, team, type, and bbox filtering
 */
locationsRouter.get('/locations', async (req: Request, res: Response, next) => {
  try {
    const { projectId, teamId, locationType, status, bbox } = req.query;

    let sql = `
      SELECT 
        l.id,
        l.organization_id as "organizationId",
        l.project_id as "projectId",
        p.name as "projectName",
        l.team_id as "teamId",
        t.name as "teamName",
        l.name,
        l.location_type as "locationType",
        ST_AsGeoJSON(l.geometry)::json as geometry,
        l.description,
        l.status,
        l.valid_from as "validFrom",
        l.valid_to as "validTo",
        l.created_at as "createdAt",
        l.updated_at as "updatedAt"
      FROM team_locations l
      JOIN projects p ON l.project_id = p.id
      LEFT JOIN teams t ON l.team_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (projectId) {
      params.push(projectId);
      sql += ` AND l.project_id = $${params.length}`;
    }

    if (teamId) {
      params.push(teamId);
      sql += ` AND l.team_id = $${params.length}`;
    }

    if (locationType) {
      params.push(locationType);
      sql += ` AND l.location_type = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND l.status = $${params.length}`;
    }

    // Optional BBox: minLng,minLat,maxLng,maxLat
    if (typeof bbox === 'string') {
      const parts = bbox.split(',').map(Number);
      if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
        params.push(parts[0], parts[1], parts[2], parts[3]);
        sql += ` AND l.geometry && ST_MakeEnvelope($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length}, 4326)`;
      }
    }

    sql += ` ORDER BY l.created_at DESC;`;

    const result = await pool.query(sql, params);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/locations
 * Create a new team location / base / checkpoint
 */
locationsRouter.post(
  '/locations',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const input = CreateTeamLocationSchema.parse(req.body);

      // Verify Project
      const projRes = await pool.query(`SELECT id, organization_id FROM projects WHERE id = $1;`, [input.projectId]);
      if (projRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบโครงการที่ระบุ' } });
      }

      const organizationId = projRes.rows[0].organization_id;

      const insertSql = `
        INSERT INTO team_locations (
          organization_id, project_id, team_id, name, location_type,
          geometry, description, status, valid_from, valid_to, created_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          ST_SetSRID(ST_GeomFromGeoJSON($6), 4326),
          $7, $8, $9, $10, $11
        )
        RETURNING 
          id, organization_id as "organizationId", project_id as "projectId",
          team_id as "teamId", name, location_type as "locationType",
          ST_AsGeoJSON(geometry)::json as geometry, description, status,
          valid_from as "validFrom", valid_to as "validTo",
          created_at as "createdAt", updated_at as "updatedAt";
      `;

      const result = await pool.query(insertSql, [
        organizationId,
        input.projectId,
        input.teamId || null,
        input.name,
        input.locationType,
        JSON.stringify(input.geometry),
        input.description || null,
        input.status,
        input.validFrom || null,
        input.validTo || null,
        req.user!.id,
      ]);

      const loc = result.rows[0];

      await logAuditEvent({
        userId: req.user!.id,
        action: 'location.create',
        resourceType: 'team_locations',
        resourceId: loc.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: { name: loc.name, locationType: loc.locationType },
      });

      return res.status(201).json({
        success: true,
        data: loc,
        message: 'บันทึกสถานที่ปฏิบัติการเรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/locations/:id
 * Retrieve location details
 */
locationsRouter.get('/locations/:id', async (req: Request, res: Response, next) => {
  try {
    const locId = req.params.id;

    const sql = `
      SELECT 
        l.id,
        l.organization_id as "organizationId",
        l.project_id as "projectId",
        p.name as "projectName",
        l.team_id as "teamId",
        t.name as "teamName",
        l.name,
        l.location_type as "locationType",
        ST_AsGeoJSON(l.geometry)::json as geometry,
        l.description,
        l.status,
        l.valid_from as "validFrom",
        l.valid_to as "validTo",
        l.created_at as "createdAt",
        l.updated_at as "updatedAt"
      FROM team_locations l
      JOIN projects p ON l.project_id = p.id
      LEFT JOIN teams t ON l.team_id = t.id
      WHERE l.id = $1;
    `;

    const result = await pool.query(sql, [locId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบสถานที่' } });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /api/v1/locations/:id
 * Update location
 */
locationsRouter.patch(
  '/locations/:id',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const locId = req.params.id;
      const input = UpdateTeamLocationSchema.parse(req.body);

      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (input.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(input.name);
      }
      if (input.teamId !== undefined) {
        fields.push(`team_id = $${idx++}`);
        values.push(input.teamId);
      }
      if (input.locationType !== undefined) {
        fields.push(`location_type = $${idx++}`);
        values.push(input.locationType);
      }
      if (input.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(input.description);
      }
      if (input.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(input.status);
      }
      if (input.validFrom !== undefined) {
        fields.push(`valid_from = $${idx++}`);
        values.push(input.validFrom);
      }
      if (input.validTo !== undefined) {
        fields.push(`valid_to = $${idx++}`);
        values.push(input.validTo);
      }
      if (input.geometry !== undefined) {
        fields.push(`geometry = ST_SetSRID(ST_GeomFromGeoJSON($${idx++}), 4326)`);
        values.push(JSON.stringify(input.geometry));
      }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'NO_FIELDS', message: 'ไม่มีข้อมูลที่ต้องอัปเดต' } });
      }

      fields.push(`updated_at = NOW()`);
      values.push(locId);

      const updateSql = `
        UPDATE team_locations
        SET ${fields.join(', ')}
        WHERE id = $${idx}
        RETURNING 
          id, organization_id as "organizationId", project_id as "projectId",
          team_id as "teamId", name, location_type as "locationType",
          ST_AsGeoJSON(geometry)::json as geometry, description, status,
          updated_at as "updatedAt";
      `;

      const result = await pool.query(updateSql, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบสถานที่' } });
      }

      return res.status(200).json({
        success: true,
        data: result.rows[0],
        message: 'อัปเดตข้อมูลสถานที่เรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /api/v1/locations/:id
 * Delete location
 */
locationsRouter.delete(
  '/locations/:id',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const locId = req.params.id;
      const result = await pool.query(`DELETE FROM team_locations WHERE id = $1 RETURNING id;`, [locId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบสถานที่' } });
      }

      return res.status(200).json({ success: true, message: 'ลบสถานที่เรียบร้อยแล้ว' });
    } catch (err) {
      return next(err);
    }
  }
);
