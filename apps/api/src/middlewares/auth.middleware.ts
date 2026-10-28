import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserRole } from '@geomonitor/shared';
import { pool } from '../db/index.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function generateTokens(user: AuthenticatedUser) {
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      organizationId: user.organizationId,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.geomonitor_access_token) {
      token = req.cookies.geomonitor_access_token;
    } else if (typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ (Authentication token required)',
        },
      });
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    return next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'โทเค็นยืนยันตัวตนหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่',
      },
    });
  }
}

export function authorizeRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบ' },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `สิทธิ์ของคุณ (${req.user.role}) ไม่ได้รับอนุญาตให้เข้าถึงส่วนนี้`,
        },
      });
    }

    return next();
  };
}

export async function authorizeAreaAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบ' } });
  }

  // Admins have access to all areas
  if (req.user.role === 'admin') {
    return next();
  }

  const rawAreaId = req.params.id || req.params.areaId;
  if (!rawAreaId) return next();
  const areaId = Array.isArray(rawAreaId) ? rawAreaId[0] : rawAreaId;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof areaId !== 'string' || !uuidRegex.test(areaId)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_UUID',
        message: 'รหัสพื้นที่ไม่ถูกต้องตามรูปแบบ UUID',
      },
    });
  }

  try {
    const resMem = await pool.query(
      `SELECT 1 FROM area_members WHERE area_id = $1 AND user_id = $2;`,
      [areaId, req.user.id]
    );

    // Also allow if user is the creator of the area or project manager in same org
    const resArea = await pool.query(
      `SELECT m.created_by, p.organization_id 
       FROM managed_areas m 
       JOIN projects p ON m.project_id = p.id 
       WHERE m.id = $1;`,
      [areaId]
    );

    if (resArea.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบพื้นที่ที่ระบุ' } });
    }

    const area = resArea.rows[0];
    const isMember = resMem.rows.length > 0;
    const isCreator = area.created_by === req.user.id;
    const isOrgPM = req.user.role === 'project_manager' && area.organization_id === req.user.organizationId;

    if (!isMember && !isCreator && !isOrgPM) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'คุณไม่ได้รับมอบหมายให้เข้าถึงข้อมูลพื้นที่ที่ระบุนี้',
        },
      });
    }

    return next();
  } catch (err: any) {
    return next(err);
  }
}
