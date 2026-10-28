import { Router, Request, Response } from 'express';
import { pool } from '../../db/index.js';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { logAuditEvent } from '../../middlewares/audit.middleware.js';

export const projectsRouter = Router();
projectsRouter.use(authenticate);

/**
 * GET /api/v1/projects
 * List all projects with area count and survey count
 */
projectsRouter.get('/projects', async (req: Request, res: Response, next) => {
  try {
    const sql = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        COUNT(DISTINCT a.id)::int as "areasCount",
        COUNT(DISTINCT s.id)::int as "surveysCount"
      FROM projects p
      LEFT JOIN managed_areas a ON p.id = a.project_id
      LEFT JOIN drone_surveys s ON a.id = s.area_id
      GROUP BY p.id
      ORDER BY p.created_at DESC;
    `;
    const result = await pool.query(sql);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/projects/:id
 * Get single project with its details
 */
projectsRouter.get('/projects/:id', async (req: Request, res: Response, next) => {
  try {
    const projectId = req.params.id;
    const sql = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        COUNT(DISTINCT a.id)::int as "areasCount",
        COUNT(DISTINCT s.id)::int as "surveysCount"
      FROM projects p
      LEFT JOIN managed_areas a ON p.id = a.project_id
      LEFT JOIN drone_surveys s ON a.id = s.area_id
      WHERE p.id = $1
      GROUP BY p.id;
    `;
    const result = await pool.query(sql, [projectId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบโครงการที่ระบุ' } });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/projects/:id/areas
 * Get responsibility areas belonging to a specific project
 */
projectsRouter.get('/projects/:id/areas', async (req: Request, res: Response, next) => {
  try {
    const projectId = req.params.id;
    const sql = `
      SELECT 
        m.id,
        m.project_id as "projectId",
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
      LEFT JOIN drone_surveys s ON m.id = s.area_id
      WHERE m.project_id = $1
      GROUP BY m.id
      ORDER BY m.updated_at DESC;
    `;
    const result = await pool.query(sql, [projectId]);

    return res.status(200).json({
      success: true,
      data: {
        items: result.rows,
        total: result.rows.length,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/projects
 * Create a new project
 */
projectsRouter.post(
  '/projects',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const { name, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'กรุณากรอกชื่อโครงการ (Project name is required)' },
        });
      }

      // Get or assign organization
      const orgRes = await pool.query(`SELECT id FROM organizations LIMIT 1;`);
      const orgId = req.user?.organizationId || orgRes.rows[0]?.id;

      const insertSql = `
        INSERT INTO projects (organization_id, name, description)
        VALUES ($1, $2, $3)
        RETURNING id, name, description, created_at as "createdAt", updated_at as "updatedAt";
      `;
      const result = await pool.query(insertSql, [orgId, name.trim(), description || null]);
      const project = result.rows[0];

      await logAuditEvent({
        userId: req.user!.id,
        action: 'project.create',
        resourceType: 'projects',
        resourceId: project.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: { name: project.name },
      });

      return res.status(201).json({
        success: true,
        data: {
          ...project,
          areasCount: 0,
          surveysCount: 0,
        },
        message: 'สร้างโครงการใหม่เรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /api/v1/projects/:id
 */
projectsRouter.delete(
  '/projects/:id',
  authorizeRoles('admin'),
  async (req: Request, res: Response, next) => {
    try {
      const projectId = req.params.id;
      await pool.query(`DELETE FROM projects WHERE id = $1;`, [projectId]);

      await logAuditEvent({
        userId: req.user!.id,
        action: 'project.delete',
        resourceType: 'projects',
        resourceId: String(projectId),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(200).json({
        success: true,
        message: 'ลบโครงการเรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);
