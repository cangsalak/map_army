import { Router, Request, Response } from 'express';
import { pool } from '../../db/index.js';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';

export const auditRouter = Router();
auditRouter.use(authenticate);

/**
 * GET /api/v1/audit/logs
 * Query immutable audit trail (Admin & PM only)
 */
auditRouter.get(
  '/audit/logs',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const offset = (page - 1) * limit;

      const action = req.query.action as string;
      const resourceType = req.query.resourceType as string;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (action) {
        params.push(action);
        whereClause += ` AND a.action = $${params.length}`;
      }

      if (resourceType) {
        params.push(resourceType);
        whereClause += ` AND a.resource_type = $${params.length}`;
      }

      const countRes = await pool.query(
        `SELECT COUNT(*) as total FROM audit_logs a ${whereClause};`,
        params
      );
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      params.push(limit);
      const limitIndex = params.length;
      params.push(offset);
      const offsetIndex = params.length;

      const dataSql = `
        SELECT 
          a.id,
          a.user_id as "userId",
          u.full_name as "userName",
          u.email as "userEmail",
          u.role as "userRole",
          a.action,
          a.resource_type as "resourceType",
          a.resource_id as "resourceId",
          a.ip_address as "ipAddress",
          a.user_agent as "userAgent",
          a.payload_diff as "payloadDiff",
          a.created_at as "createdAt"
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex};
      `;

      const result = await pool.query(dataSql, params);

      return res.status(200).json({
        success: true,
        data: {
          items: result.rows,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      return next(err);
    }
  }
);
