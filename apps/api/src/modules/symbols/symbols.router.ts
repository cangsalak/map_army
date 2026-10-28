import { Router, Request, Response } from 'express';
import { CreateSymbolSchema } from '@geomonitor/shared';
import { pool } from '../../db/index.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

export const symbolsRouter = Router();
symbolsRouter.use(authenticate);

/**
 * GET /api/v1/symbols
 * Query symbol catalog with category, search query, and favorites
 */
symbolsRouter.get('/symbols', async (req: Request, res: Response, next) => {
  try {
    const { category, search, isCustom, limit = 100 } = req.query;
    const userId = req.user!.id;

    let sql = `
      SELECT 
        s.id,
        s.name,
        s.description,
        s.category,
        s.icon_key as "iconKey",
        s.default_color as "defaultColor",
        s.default_size as "defaultSize",
        s.default_rotation as "defaultRotation",
        s.tags,
        s.asset_path as "assetPath",
        s.svg_content as "svgContent",
        s.is_custom as "isCustom",
        s.created_at as "createdAt",
        CASE WHEN f.id IS NOT NULL THEN TRUE ELSE FALSE END as "isFavorite"
      FROM symbol_catalog s
      LEFT JOIN user_symbol_favorites f ON s.id = f.symbol_id AND f.user_id = $1
      WHERE 1=1
    `;
    const params: any[] = [userId];

    if (category && category !== 'all') {
      params.push(category);
      sql += ` AND s.category = $${params.length}`;
    }

    if (isCustom !== undefined) {
      params.push(isCustom === 'true');
      sql += ` AND s.is_custom = $${params.length}`;
    }

    if (typeof search === 'string' && search.trim().length > 0) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(s.name) LIKE $${params.length} OR LOWER(s.description) LIKE $${params.length} OR array_to_string(s.tags, ' ') ILIKE $${params.length})`;
    }

    params.push(Number(limit));
    sql += ` ORDER BY s.is_custom DESC, s.name ASC LIMIT $${params.length};`;

    const result = await pool.query(sql, params);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/symbols/favorites
 * List user's favorite symbols
 */
symbolsRouter.get('/symbols/favorites', async (req: Request, res: Response, next) => {
  try {
    const userId = req.user!.id;

    const sql = `
      SELECT 
        s.id,
        s.name,
        s.description,
        s.category,
        s.icon_key as "iconKey",
        s.default_color as "defaultColor",
        s.default_size as "defaultSize",
        s.default_rotation as "defaultRotation",
        s.tags,
        s.asset_path as "assetPath",
        s.svg_content as "svgContent",
        s.is_custom as "isCustom",
        s.created_at as "createdAt",
        TRUE as "isFavorite"
      FROM symbol_catalog s
      JOIN user_symbol_favorites f ON s.id = f.symbol_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC;
    `;

    const result = await pool.query(sql, [userId]);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/symbols/:id/favorite
 * Add symbol to user favorites
 */
symbolsRouter.post('/symbols/:id/favorite', async (req: Request, res: Response, next) => {
  try {
    const symbolId = req.params.id;
    const userId = req.user!.id;

    await pool.query(
      `INSERT INTO user_symbol_favorites (user_id, symbol_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, symbol_id) DO NOTHING;`,
      [userId, symbolId]
    );

    return res.status(200).json({ success: true, message: 'เพิ่มสัญลักษณ์ในรายการโปรดเรียบร้อยแล้ว' });
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/v1/symbols/:id/favorite
 * Remove symbol from user favorites
 */
symbolsRouter.delete('/symbols/:id/favorite', async (req: Request, res: Response, next) => {
  try {
    const symbolId = req.params.id;
    const userId = req.user!.id;

    await pool.query(
      `DELETE FROM user_symbol_favorites WHERE user_id = $1 AND symbol_id = $2;`,
      [userId, symbolId]
    );

    return res.status(200).json({ success: true, message: 'นำออกจากรายการโปรดเรียบร้อยแล้ว' });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/symbols/recent
 * List user's recently used symbols
 */
symbolsRouter.get('/symbols/recent', async (req: Request, res: Response, next) => {
  try {
    const userId = req.user!.id;

    const sql = `
      SELECT 
        s.id,
        s.name,
        s.description,
        s.category,
        s.icon_key as "iconKey",
        s.default_color as "defaultColor",
        s.default_size as "defaultSize",
        s.default_rotation as "defaultRotation",
        s.tags,
        s.asset_path as "assetPath",
        s.svg_content as "svgContent",
        s.is_custom as "isCustom",
        r.used_at as "usedAt"
      FROM symbol_catalog s
      JOIN user_recent_symbols r ON s.id = r.symbol_id
      WHERE r.user_id = $1
      ORDER BY r.used_at DESC
      LIMIT 12;
    `;

    const result = await pool.query(sql, [userId]);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/symbols/:id/use
 * Record recent usage of a symbol
 */
symbolsRouter.post('/symbols/:id/use', async (req: Request, res: Response, next) => {
  try {
    const symbolId = req.params.id;
    const userId = req.user!.id;

    await pool.query(
      `INSERT INTO user_recent_symbols (user_id, symbol_id, used_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, symbol_id) 
       DO UPDATE SET used_at = NOW();`,
      [userId, symbolId]
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/symbols
 * Create a custom symbol definition (with safe SVG sanitization)
 */
symbolsRouter.post('/symbols', async (req: Request, res: Response, next) => {
  try {
    const input = CreateSymbolSchema.parse(req.body);

    const insertSql = `
      INSERT INTO symbol_catalog (
        name, description, category, icon_key, default_color,
        default_size, default_rotation, tags, svg_content, is_custom, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10
      ) RETURNING 
        id, name, description, category, icon_key as "iconKey",
        default_color as "defaultColor", default_size as "defaultSize",
        default_rotation as "defaultRotation", tags, svg_content as "svgContent",
        is_custom as "isCustom", created_at as "createdAt";
    `;

    const result = await pool.query(insertSql, [
      input.name,
      input.description || null,
      input.category,
      input.iconKey,
      input.defaultColor,
      input.defaultSize,
      input.defaultRotation,
      input.tags,
      input.svgContent || null,
      req.user!.id,
    ]);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'สร้างสัญลักษณ์กำหนดเองเรียบร้อยแล้ว',
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/symbols/:id
 * Retrieve single symbol details
 */
symbolsRouter.get('/symbols/:id', async (req: Request, res: Response, next) => {
  try {
    const symbolId = req.params.id;
    const sql = `
      SELECT 
        id, name, description, category, icon_key as "iconKey",
        default_color as "defaultColor", default_size as "defaultSize",
        default_rotation as "defaultRotation", tags, asset_path as "assetPath",
        svg_content as "svgContent", is_custom as "isCustom", created_at as "createdAt"
      FROM symbol_catalog
      WHERE id = $1;
    `;
    const result = await pool.query(sql, [symbolId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบสัญลักษณ์' } });
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});
