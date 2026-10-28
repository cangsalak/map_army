import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { LoginSchema } from '@geomonitor/shared';
import { pool } from '../../db/index.js';
import { env } from '../../config/env.js';
import { authenticate, generateTokens, AuthenticatedUser } from '../../middlewares/auth.middleware.js';
import { logAuditEvent } from '../../middlewares/audit.middleware.js';

export const authRouter = Router();

authRouter.post('/auth/login', async (req: Request, res: Response, next) => {
  try {
    const input = LoginSchema.parse(req.body);

    const userRes = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.is_active, u.organization_id, o.name as org_name
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1;`,
      [input.email.toLowerCase().trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
      });
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' },
      });
    }

    const isMatch = await bcrypt.compare(input.password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
      });
    }

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      organizationId: user.organization_id,
    };

    const { accessToken, refreshToken } = generateTokens(authUser);

    // Set secure HTTP-only refresh token cookie
    res.cookie('geomonitor_refresh_token', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie('geomonitor_access_token', accessToken, {
      httpOnly: false, // Accessible to client if needed
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    await logAuditEvent({
      userId: user.id,
      action: 'auth.login',
      resourceType: 'users',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          organizationId: user.organization_id,
          organizationName: user.org_name,
        },
      },
      message: 'เข้าสู่ระบบสำเร็จ ยินดีต้อนรับสู่ GeoMonitor 3D',
    });
  } catch (err) {
    return next(err);
  }
});

authRouter.post('/auth/refresh', async (req: Request, res: Response, next) => {
  try {
    const refreshToken = req.cookies?.geomonitor_refresh_token;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'ไม่พบ Refresh Token กรุณาเข้าสู่ระบบใหม่' },
      });
    }

    const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as { id: string };

    const userRes = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.organization_id, o.name as org_name
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1;`,
      [decoded.id]
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'ไม่พบข้อมูลผู้ใช้หรือบัญชีถูกระงับ' },
      });
    }

    const user = userRes.rows[0];
    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      organizationId: user.organization_id,
    };

    const tokens = generateTokens(authUser);

    res.cookie('geomonitor_refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          organizationId: user.organization_id,
          organizationName: user.org_name,
        },
      },
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh Token หมดอายุหรือไม่ถูกต้อง' },
    });
  }
});

authRouter.post('/auth/logout', async (req: Request, res: Response) => {
  res.clearCookie('geomonitor_refresh_token');
  res.clearCookie('geomonitor_access_token');

  // Try optional authentication for audit log
  try {
    let token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.substring(7)
      : req.cookies?.geomonitor_access_token;
    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      if (decoded?.id) {
        await logAuditEvent({
          userId: decoded.id,
          action: 'auth.logout',
          resourceType: 'users',
          resourceId: decoded.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }
    }
  } catch {
    // Ignore token verification error on logout
  }

  return res.status(200).json({
    success: true,
    message: 'ออกจากระบบเรียบร้อยแล้ว',
  });
});

authRouter.get('/auth/me', authenticate, async (req: Request, res: Response, next) => {
  try {
    const userRes = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, u.organization_id, o.name as org_name
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1;`,
      [req.user!.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });
    }

    const u = userRes.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        isActive: u.is_active,
        organizationId: u.organization_id,
        organizationName: u.org_name,
        createdAt: u.created_at,
      },
    });
  } catch (err) {
    return next(err);
  }
});

authRouter.get('/users', authenticate, async (req: Request, res: Response, next) => {
  try {
    const usersRes = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, o.name as org_name
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       ORDER BY u.created_at ASC;`
    );

    return res.status(200).json({
      success: true,
      items: usersRes.rows.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        isActive: u.is_active,
        organizationName: u.org_name || 'ศูนย์บัญชาการ GeoMonitor 3D',
        createdAt: u.created_at,
      })),
    });
  } catch (err) {
    return next(err);
  }
});
