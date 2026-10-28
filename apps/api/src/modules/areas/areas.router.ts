import { Router, Request, Response } from 'express';
import { CreateAreaSchema, UpdateAreaSchema, AreaQuerySchema } from '@geomonitor/shared';
import { pool } from '../../db/index.js';
import {
  authenticate,
  authorizeRoles,
  authorizeAreaAccess,
} from '../../middlewares/auth.middleware.js';
import { logAuditEvent } from '../../middlewares/audit.middleware.js';

export const areasRouter = Router();

// All area routes require authentication
areasRouter.use(authenticate);

/**
 * GET /api/v1/areas
 * List managed areas with PostGIS GeoJSON, area size, survey count, and search
 */
areasRouter.get('/areas', async (req: Request, res: Response, next) => {
  try {
    const query = AreaQuerySchema.parse(req.query);
    const offset = (query.page - 1) * query.limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (query.projectId) {
      params.push(query.projectId);
      whereClause += ` AND m.project_id = $${params.length}`;
    }

    if (query.status) {
      params.push(query.status);
      whereClause += ` AND m.status = $${params.length}`;
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      whereClause += ` AND (m.name ILIKE $${params.length} OR m.description ILIKE $${params.length})`;
    }

    // Role-based filtering: non-admin users only see areas in projects of their org or assigned to them
    if (req.user?.role !== 'admin') {
      params.push(req.user!.id);
      whereClause += ` AND (
        m.created_by = $${params.length} 
        OR EXISTS (SELECT 1 FROM area_members am WHERE am.area_id = m.id AND am.user_id = $${params.length})
        OR p.organization_id = (SELECT organization_id FROM users WHERE id = $${params.length})
      )`;
    }

    // Count query
    const countSql = `
      SELECT COUNT(m.id) as total
      FROM managed_areas m
      JOIN projects p ON m.project_id = p.id
      ${whereClause};
    `;
    const countRes = await pool.query(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Data query with PostGIS ST_AsGeoJSON
    params.push(query.limit);
    const limitIndex = params.length;
    params.push(offset);
    const offsetIndex = params.length;

    const dataSql = `
      SELECT 
        m.id,
        m.project_id as "projectId",
        p.name as "projectName",
        m.name,
        m.description,
        ST_AsGeoJSON(m.boundary)::json as boundary,
        m.area_sqm as "areaSqm",
        m.status,
        m.created_by as "createdBy",
        m.created_at as "createdAt",
        m.updated_at as "updatedAt",
        COUNT(s.id)::int as "surveyCount",
        MAX(s.survey_date) as "latestSurveyDate"
      FROM managed_areas m
      JOIN projects p ON m.project_id = p.id
      LEFT JOIN drone_surveys s ON m.id = s.area_id
      ${whereClause}
      GROUP BY m.id, p.name
      ORDER BY m.updated_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;

    const dataRes = await pool.query(dataSql, params);

    return res.status(200).json({
      success: true,
      data: {
        items: dataRes.rows,
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/areas
 * Create managed area with PostGIS Polygon boundary (EPSG:4326)
 */
areasRouter.post(
  '/areas',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const input = CreateAreaSchema.parse(req.body);
      const geojsonStr = JSON.stringify(input.boundary);

      let targetProjectId = input.projectId;
      if (!targetProjectId) {
        const existingProj = await pool.query(`SELECT id FROM projects ORDER BY created_at ASC LIMIT 1;`);
        if (existingProj.rows.length > 0) {
          targetProjectId = existingProj.rows[0].id;
        } else {
          const orgRes = await pool.query(`SELECT id FROM organizations LIMIT 1;`);
          const newProj = await pool.query(
            `INSERT INTO projects (organization_id, name, description) 
             VALUES ($1, $2, $3) RETURNING id;`,
            [
              orgRes.rows[0]?.id,
              'โครงการติดตามสภาพพื้นที่และสำรวจโดรน (Primary Monitoring Project)',
              'โครงการเริ่มต้นสำหรับบริหารจัดการพื้นที่สำรวจโดรนและการเปลี่ยนแปลงทางกายภาพ'
            ]
          );
          targetProjectId = newProj.rows[0].id;
        }
      }

      const insertSql = `
        INSERT INTO managed_areas (
          project_id, name, description, boundary, area_sqm, status, created_by
        ) VALUES (
          $1, $2, $3,
          ST_SetSRID(ST_GeomFromGeoJSON($4), 4326),
          ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326), 32647)),
          $5, $6
        )
        RETURNING 
          id, project_id as "projectId", name, description,
          ST_AsGeoJSON(boundary)::json as boundary,
          area_sqm as "areaSqm", status, created_at as "createdAt";
      `;

      const result = await pool.query(insertSql, [
        targetProjectId,
        input.name,
        input.description || null,
        geojsonStr,
        input.status,
        req.user!.id,
      ]);

      const newArea = result.rows[0];

      // Automatically assign creator as admin member of the area
      await pool.query(
        `INSERT INTO area_members (area_id, user_id, role) VALUES ($1, $2, 'owner');`,
        [newArea.id, req.user!.id]
      );

      await logAuditEvent({
        userId: req.user!.id,
        action: 'area.create',
        resourceType: 'managed_areas',
        resourceId: newArea.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: { name: newArea.name, areaSqm: newArea.areaSqm },
      });

      return res.status(201).json({
        success: true,
        data: newArea,
        message: 'สร้างพื้นที่ดูแลใหม่เรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/areas/:id
 * Retrieve area details, PostGIS polygon, members, and historical survey list
 */
areasRouter.get('/areas/:id', authorizeAreaAccess, async (req: Request, res: Response, next) => {
  try {
    const areaId = req.params.id;

    const areaSql = `
      SELECT 
        m.id,
        m.project_id as "projectId",
        p.name as "projectName",
        m.name,
        m.description,
        ST_AsGeoJSON(m.boundary)::json as boundary,
        m.area_sqm as "areaSqm",
        m.status,
        m.created_by as "createdBy",
        u.full_name as "createdByName",
        m.created_at as "createdAt",
        m.updated_at as "updatedAt"
      FROM managed_areas m
      JOIN projects p ON m.project_id = p.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.id = $1;
    `;

    const areaRes = await pool.query(areaSql, [areaId]);
    if (areaRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลพื้นที่ที่ค้นหา' },
      });
    }

    const area = areaRes.rows[0];

    // Fetch surveys for this area
    const surveysRes = await pool.query(
      `SELECT 
         id, survey_code as "surveyCode", survey_date as "surveyDate",
         drone_model as "droneModel", sensor_type as "sensorType",
         flight_altitude_m as "flightAltitudeM", ground_sample_distance_cm as "groundSampleDistanceCm",
         processing_status as "processingStatus", quality_metrics as "qualityMetrics",
         created_at as "createdAt"
       FROM drone_surveys
       WHERE area_id = $1
       ORDER BY survey_date DESC;`,
      [areaId]
    );

    // Fetch assigned members
    const membersRes = await pool.query(
      `SELECT am.user_id as "userId", u.full_name as "fullName", u.email, am.role
       FROM area_members am
       JOIN users u ON am.user_id = u.id
       WHERE am.area_id = $1;`,
      [areaId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...area,
        surveys: surveysRes.rows,
        members: membersRes.rows,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /api/v1/areas/:id
 * Update area metadata or boundary
 */
areasRouter.patch(
  '/areas/:id',
  authorizeRoles('admin', 'project_manager'),
  authorizeAreaAccess,
  async (req: Request, res: Response, next) => {
    try {
      const areaId = req.params.id;
      const input = UpdateAreaSchema.parse(req.body);

      const updates: string[] = [];
      const params: any[] = [areaId];

      if (input.name !== undefined) {
        params.push(input.name);
        updates.push(`name = $${params.length}`);
      }

      if (input.description !== undefined) {
        params.push(input.description);
        updates.push(`description = $${params.length}`);
      }

      if (input.status !== undefined) {
        params.push(input.status);
        updates.push(`status = $${params.length}`);
      }

      if (input.boundary !== undefined) {
        params.push(JSON.stringify(input.boundary));
        const boundaryIndex = params.length;
        updates.push(`boundary = ST_SetSRID(ST_GeomFromGeoJSON($${boundaryIndex}), 4326)`);
        updates.push(
          `area_sqm = ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($${boundaryIndex}), 4326), 32647))`
        );
      }

      updates.push(`updated_at = NOW()`);

      const updateSql = `
        UPDATE managed_areas
        SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING 
          id, project_id as "projectId", name, description,
          ST_AsGeoJSON(boundary)::json as boundary,
          area_sqm as "areaSqm", status, updated_at as "updatedAt";
      `;

      const result = await pool.query(updateSql, params);
      const updatedArea = result.rows[0];

      await logAuditEvent({
        userId: req.user!.id,
        action: 'area.update',
        resourceType: 'managed_areas',
        resourceId: String(areaId),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: input,
      });

      return res.status(200).json({
        success: true,
        data: updatedArea,
        message: 'อัปเดตข้อมูลพื้นที่เรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /api/v1/areas/:id
 * Archive or delete managed area
 */
areasRouter.delete(
  '/areas/:id',
  authorizeRoles('admin'),
  async (req: Request, res: Response, next) => {
    try {
      const areaId = req.params.id;

      await pool.query(`DELETE FROM managed_areas WHERE id = $1;`, [areaId]);

      await logAuditEvent({
        userId: req.user!.id,
        action: 'area.delete',
        resourceType: 'managed_areas',
        resourceId: String(areaId),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(200).json({
        success: true,
        message: 'ลบข้อมูลพื้นที่เรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);
