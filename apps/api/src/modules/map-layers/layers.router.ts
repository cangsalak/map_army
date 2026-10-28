import { Router, Request, Response } from 'express';
import { 
  CreateMapLayerSchema, 
  UpdateMapLayerSchema, 
  CreateMapFeatureSchema,
  CreatePlacedFeatureSchema,
  UpdatePlacedFeatureSchema,
  ReorderLayersSchema,
  parseKml,
  parseKmz,
  exportFeaturesToKml,
  exportFeaturesToKmz,
  KmlFeature,
} from '@geomonitor/shared';
import { pool } from '../../db/index.js';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { logAuditEvent } from '../../middlewares/audit.middleware.js';

export const layersRouter = Router();
layersRouter.use(authenticate);

/**
 * GET /api/v1/layers
 * Query map layers by project, ordered by order_index
 */
layersRouter.get('/layers', async (req: Request, res: Response, next) => {
  try {
    const { projectId } = req.query;

    let sql = `
      SELECT 
        l.id,
        l.project_id as "projectId",
        l.name,
        l.layer_type as "layerType",
        l.visibility,
        l.opacity,
        l.is_editable as "isEditable",
        l.color_hex as "colorHex",
        l.order_index as "orderIndex",
        l.permissions,
        l.original_filename as "originalFilename",
        l.file_format as "fileFormat",
        l.source_metadata as "sourceMetadata",
        l.coordinate_reference_system as "coordinateReferenceSystem",
        l.altitude_reference as "altitudeReference",
        l.import_status as "importStatus",
        l.validation_warnings as "validationWarnings",
        COUNT(f.id)::int as "featureCount",
        l.created_at as "createdAt",
        l.updated_at as "updatedAt"
      FROM map_layers l
      LEFT JOIN map_features f ON l.id = f.layer_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (projectId) {
      params.push(projectId);
      sql += ` AND l.project_id = $${params.length}`;
    }

    sql += ` GROUP BY l.id ORDER BY COALESCE(l.order_index, 0) ASC, l.created_at ASC;`;

    const result = await pool.query(sql, params);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/layers/reorder
 * Reorder layer indices
 */
layersRouter.post(
  '/layers/reorder',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const input = ReorderLayersSchema.parse(req.body);
      const items = input.items || input.orders || [];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const item of items) {
          await client.query(
            `UPDATE map_layers SET order_index = $1, updated_at = NOW() WHERE id = $2;`,
            [item.orderIndex, item.id]
          );
        }
        await client.query('COMMIT');
        return res.status(200).json({ success: true, message: 'จัดลำดับชั้นข้อมูลเรียบร้อยแล้ว' });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/layers
 * Create a new map layer
 */
layersRouter.post(
  '/layers',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const input = CreateMapLayerSchema.parse(req.body);

      // determine max order_index
      const maxOrderResult = await pool.query(
        `SELECT COALESCE(MAX(order_index), -1) + 1 as "nextOrder" FROM map_layers WHERE project_id = $1;`,
        [input.projectId]
      );
      const nextOrder = maxOrderResult.rows[0].nextOrder;

      const insertSql = `
        INSERT INTO map_layers (
          project_id, name, layer_type, visibility, opacity, is_editable, color_hex, order_index, permissions, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING 
          id, project_id as "projectId", name, layer_type as "layerType",
          visibility, opacity, is_editable as "isEditable", color_hex as "colorHex",
          order_index as "orderIndex", permissions, created_at as "createdAt", updated_at as "updatedAt";
      `;

      const result = await pool.query(insertSql, [
        input.projectId,
        input.name,
        input.layerType,
        input.visibility,
        input.opacity,
        input.isEditable,
        input.colorHex,
        nextOrder,
        JSON.stringify(input.permissions),
        req.user!.id,
      ]);

      const layer = result.rows[0];

      await logAuditEvent({
        userId: req.user!.id,
        action: 'layer.create',
        resourceType: 'map_layers',
        resourceId: layer.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: { name: layer.name, layerType: layer.layerType },
      });

      return res.status(201).json({
        success: true,
        data: layer,
        message: 'สร้างเลเยอร์แผนที่เรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/layers/:id
 * Update layer visibility, opacity, name, or styles
 */
layersRouter.patch(
  '/layers/:id',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const layerId = req.params.id;
      const input = UpdateMapLayerSchema.parse(req.body);

      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (input.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(input.name);
      }
      if (input.layerType !== undefined) {
        fields.push(`layer_type = $${idx++}`);
        values.push(input.layerType);
      }
      if (input.visibility !== undefined) {
        fields.push(`visibility = $${idx++}`);
        values.push(input.visibility);
      }
      if (input.opacity !== undefined) {
        fields.push(`opacity = $${idx++}`);
        values.push(input.opacity);
      }
      if (input.isEditable !== undefined) {
        fields.push(`is_editable = $${idx++}`);
        values.push(input.isEditable);
      }
      if (input.colorHex !== undefined) {
        fields.push(`color_hex = $${idx++}`);
        values.push(input.colorHex);
      }
      if (input.permissions !== undefined) {
        fields.push(`permissions = $${idx++}`);
        values.push(JSON.stringify(input.permissions));
      }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'NO_FIELDS', message: 'ไม่มีข้อมูลที่ต้องอัปเดต' } });
      }

      fields.push(`updated_at = NOW()`);
      values.push(layerId);

      const updateSql = `
        UPDATE map_layers
        SET ${fields.join(', ')}
        WHERE id = $${idx}
        RETURNING 
          id, project_id as "projectId", name, layer_type as "layerType",
          visibility, opacity, is_editable as "isEditable", color_hex as "colorHex",
          order_index as "orderIndex", permissions, updated_at as "updatedAt";
      `;

      const result = await pool.query(updateSql, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบเลเยอร์' } });
      }

      return res.status(200).json({
        success: true,
        data: result.rows[0],
        message: 'อัปเดตเลเยอร์เรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /api/v1/layers/:id
 * Delete layer and its features
 */
layersRouter.delete(
  '/layers/:id',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const layerId = req.params.id;
      const result = await pool.query(`DELETE FROM map_layers WHERE id = $1 RETURNING id;`, [layerId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบเลเยอร์' } });
      }
      return res.status(200).json({ success: true, message: 'ลบเลเยอร์เรียบร้อยแล้ว' });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/layers/:id/features
 * Return layer features with styles and symbol data
 */
layersRouter.get('/layers/:id/features', async (req: Request, res: Response, next) => {
  try {
    const layerId = req.params.id;

    const sql = `
      SELECT 
        f.id,
        f.project_id as "projectId",
        f.layer_id as "layerId",
        f.symbol_id as "symbolId",
        f.name,
        f.description,
        f.feature_type as "featureType",
        ST_AsGeoJSON(f.geometry)::json as geometry,
        f.style,
        f.properties,
        s.name as "symbolName",
        s.category as "symbolCategory",
        s.icon_key as "symbolIconKey",
        s.svg_content as "symbolSvgContent",
        f.created_at as "createdAt",
        f.updated_at as "updatedAt"
      FROM map_features f
      LEFT JOIN symbol_catalog s ON f.symbol_id = s.id
      WHERE f.layer_id = $1
      ORDER BY f.created_at ASC;
    `;

    const result = await pool.query(sql, [layerId]);

    const featureCollection = {
      type: 'FeatureCollection',
      features: result.rows.map((row) => ({
        type: 'Feature',
        id: row.id,
        geometry: row.geometry,
        properties: {
          ...row.properties,
          id: row.id,
          layerId: row.layerId,
          projectId: row.projectId,
          symbolId: row.symbolId,
          name: row.name,
          description: row.description,
          featureType: row.featureType,
          style: row.style,
          symbol: row.symbolId ? {
            id: row.symbolId,
            name: row.symbolName,
            category: row.symbolCategory,
            iconKey: row.symbolIconKey,
            svgContent: row.symbolSvgContent,
          } : undefined,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      })),
    };

    return res.status(200).json({ success: true, data: featureCollection });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/layers/:id/features
 * Add a placed symbol or vector feature to the layer
 */
layersRouter.post(
  '/layers/:id/features',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const layerId = req.params.id;

      // Check layer editable
      const layerCheck = await pool.query(
        `SELECT id, project_id as "projectId", is_editable as "isEditable" FROM map_layers WHERE id = $1;`,
        [layerId]
      );
      if (layerCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบเลเยอร์' } });
      }

      if (!layerCheck.rows[0].isEditable) {
        return res.status(403).json({ success: false, error: { code: 'READ_ONLY', message: 'เลเยอร์นี้เป็นแบบอ่านอย่างเดียว ไม่อนุญาตให้แก้ไข' } });
      }

      const layer = layerCheck.rows[0];

      // Parse as CreatePlacedFeatureSchema if style or symbolId is present, else fall back to CreateMapFeatureSchema
      let featureType: string;
      let geometry: any;
      let properties: any = {};
      let name: string | null = null;
      let description: string | null = null;
      let symbolId: string | null = null;
      let style: any = null;

      if (req.body.style || req.body.symbolId || req.body.name) {
        const input = CreatePlacedFeatureSchema.parse({
          ...req.body,
          layerId,
          projectId: req.body.projectId || layer.projectId,
        });
        featureType = input.featureType;
        geometry = input.geometry;
        name = input.name || null;
        description = input.description || null;
        symbolId = input.symbolId || null;
        style = input.style || null;
        properties = input.properties || {};
      } else {
        const input = CreateMapFeatureSchema.parse(req.body);
        featureType = input.featureType;
        geometry = input.geometry;
        properties = input.properties || {};
      }

      const insertSql = `
        INSERT INTO map_features (
          layer_id, project_id, symbol_id, feature_type, name, description,
          geometry, style, properties, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          ST_SetSRID(ST_GeomFromGeoJSON($7), 4326), $8, $9, $10
        ) RETURNING 
          id, layer_id as "layerId", project_id as "projectId", symbol_id as "symbolId",
          name, description, feature_type as "featureType",
          ST_AsGeoJSON(geometry)::json as geometry, style, properties,
          created_at as "createdAt", updated_at as "updatedAt";
      `;

      const result = await pool.query(insertSql, [
        layerId,
        layer.projectId,
        symbolId,
        featureType,
        name,
        description,
        JSON.stringify(geometry),
        style ? JSON.stringify(style) : null,
        JSON.stringify(properties),
        req.user!.id,
      ]);

      const inserted = result.rows[0];

      // If symbolId was provided, also record recent usage for user
      if (symbolId) {
        await pool.query(
          `INSERT INTO user_recent_symbols (user_id, symbol_id, used_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id, symbol_id) DO UPDATE SET used_at = NOW();`,
          [req.user!.id, symbolId]
        ).catch(() => {});
      }

      return res.status(201).json({
        success: true,
        data: inserted,
        message: 'เพิ่มวัตถุ/สัญลักษณ์ลงบนแผนที่เรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/features/:id
 * Retrieve a single feature details
 */
layersRouter.get('/features/:id', async (req: Request, res: Response, next) => {
  try {
    const featureId = req.params.id;
    const sql = `
      SELECT 
        f.id,
        f.project_id as "projectId",
        f.layer_id as "layerId",
        f.symbol_id as "symbolId",
        f.name,
        f.description,
        f.feature_type as "featureType",
        ST_AsGeoJSON(f.geometry)::json as geometry,
        f.style,
        f.properties,
        s.name as "symbolName",
        s.category as "symbolCategory",
        s.icon_key as "symbolIconKey",
        s.svg_content as "symbolSvgContent",
        l.name as "layerName",
        l.is_editable as "layerIsEditable",
        f.created_at as "createdAt",
        f.updated_at as "updatedAt"
      FROM map_features f
      JOIN map_layers l ON f.layer_id = l.id
      LEFT JOIN symbol_catalog s ON f.symbol_id = s.id
      WHERE f.id = $1;
    `;
    const result = await pool.query(sql, [featureId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบวัตถุบนแผนที่' } });
    }

    const row = result.rows[0];
    const data = {
      id: row.id,
      projectId: row.projectId,
      layerId: row.layerId,
      layerName: row.layerName,
      layerIsEditable: row.layerIsEditable,
      symbolId: row.symbolId,
      name: row.name,
      description: row.description,
      featureType: row.featureType,
      geometry: row.geometry,
      style: row.style,
      properties: row.properties,
      symbol: row.symbolId ? {
        id: row.symbolId,
        name: row.symbolName,
        category: row.symbolCategory,
        iconKey: row.symbolIconKey,
        svgContent: row.symbolSvgContent,
      } : undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /api/v1/features/:id
 * Update feature properties, name, style, geometry, or symbol
 */
layersRouter.patch(
  '/features/:id',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const featureId = req.params.id;
      const input = UpdatePlacedFeatureSchema.parse(req.body);

      // Verify feature exists and its layer is editable
      const featureCheck = await pool.query(
        `SELECT f.id, f.layer_id, l.is_editable 
         FROM map_features f 
         JOIN map_layers l ON f.layer_id = l.id 
         WHERE f.id = $1;`,
        [featureId]
      );
      if (featureCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบวัตถุบนแผนที่' } });
      }

      if (!featureCheck.rows[0].is_editable) {
        return res.status(403).json({ success: false, error: { code: 'READ_ONLY', message: 'เลเยอร์นี้ถูกตั้งค่าเป็นอ่านอย่างเดียว' } });
      }

      // If moving layer, check target layer
      if (input.layerId && input.layerId !== featureCheck.rows[0].layer_id) {
        const targetCheck = await pool.query(`SELECT id, is_editable FROM map_layers WHERE id = $1;`, [input.layerId]);
        if (targetCheck.rows.length === 0) {
          return res.status(404).json({ success: false, error: { code: 'TARGET_LAYER_NOT_FOUND', message: 'ไม่พบเลเยอร์ปลายทาง' } });
        }
        if (!targetCheck.rows[0].is_editable) {
          return res.status(403).json({ success: false, error: { code: 'TARGET_READ_ONLY', message: 'เลเยอร์ปลายทางเป็นแบบอ่านอย่างเดียว' } });
        }
      }

      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (input.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(input.name);
      }
      if (input.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(input.description);
      }
      if (input.layerId !== undefined) {
        fields.push(`layer_id = $${idx++}`);
        values.push(input.layerId);
      }
      if (input.symbolId !== undefined) {
        fields.push(`symbol_id = $${idx++}`);
        values.push(input.symbolId);
      }
      if (input.style !== undefined) {
        fields.push(`style = $${idx++}`);
        values.push(JSON.stringify(input.style));
      }
      if (input.properties !== undefined) {
        fields.push(`properties = $${idx++}`);
        values.push(JSON.stringify(input.properties));
      }
      if (input.geometry !== undefined) {
        fields.push(`geometry = ST_SetSRID(ST_GeomFromGeoJSON($${idx++}), 4326)`);
        values.push(JSON.stringify(input.geometry));
      }

      if (fields.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'NO_FIELDS', message: 'ไม่มีข้อมูลที่ต้องอัปเดต' } });
      }

      fields.push(`updated_by = $${idx++}`);
      values.push(req.user!.id);

      fields.push(`updated_at = NOW()`);
      values.push(featureId);

      const updateSql = `
        UPDATE map_features
        SET ${fields.join(', ')}
        WHERE id = $${idx}
        RETURNING 
          id, layer_id as "layerId", project_id as "projectId", symbol_id as "symbolId",
          name, description, feature_type as "featureType",
          ST_AsGeoJSON(geometry)::json as geometry, style, properties,
          created_at as "createdAt", updated_at as "updatedAt";
      `;

      const result = await pool.query(updateSql, values);
      return res.status(200).json({
        success: true,
        data: result.rows[0],
        message: 'อัปเดตคุณสมบัติวัตถุเรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/features/:id/duplicate
 * Duplicate a feature
 */
layersRouter.post(
  '/features/:id/duplicate',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const featureId = req.params.id;

      const sourceResult = await pool.query(
        `SELECT f.*, l.is_editable 
         FROM map_features f 
         JOIN map_layers l ON f.layer_id = l.id 
         WHERE f.id = $1;`,
        [featureId]
      );

      if (sourceResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบวัตถุต้นฉบับ' } });
      }

      const src = sourceResult.rows[0];
      if (!src.is_editable) {
        return res.status(403).json({ success: false, error: { code: 'READ_ONLY', message: 'เลเยอร์นี้เป็นแบบอ่านอย่างเดียว' } });
      }

      const dupName = src.name ? `${src.name} (สำเนา)` : 'วัตถุคัดลอก';

      // For Point geometry, shift slightly (+0.0003 deg) so duplicate is visible
      const insertSql = `
        INSERT INTO map_features (
          layer_id, project_id, symbol_id, feature_type, name, description,
          geometry, style, properties, created_by
        )
        SELECT 
          f.layer_id, f.project_id, f.symbol_id, f.feature_type, $1, f.description,
          CASE 
            WHEN ST_GeometryType(f.geometry) = 'ST_Point' 
            THEN ST_Translate(f.geometry, 0.0003, 0.0003)
            ELSE f.geometry
          END,
          f.style, f.properties, $2
        FROM map_features f
        WHERE f.id = $3
        RETURNING 
          id, layer_id as "layerId", project_id as "projectId", symbol_id as "symbolId",
          name, description, feature_type as "featureType",
          ST_AsGeoJSON(geometry)::json as geometry, style, properties,
          created_at as "createdAt", updated_at as "updatedAt";
      `;

      const result = await pool.query(insertSql, [
        dupName,
        req.user!.id,
        featureId,
      ]);

      return res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'คัดลอกวัตถุสำเร็จ',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * PATCH /api/v1/features/:id/move-layer
 * Move feature to another layer
 */
layersRouter.patch(
  '/features/:id/move-layer',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const featureId = req.params.id;
      const { targetLayerId } = req.body;

      if (!targetLayerId) {
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'กรุณาระบุ targetLayerId' } });
      }

      // Check target layer
      const targetCheck = await pool.query(`SELECT id, is_editable FROM map_layers WHERE id = $1;`, [targetLayerId]);
      if (targetCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบเลเยอร์ปลายทาง' } });
      }
      if (!targetCheck.rows[0].is_editable) {
        return res.status(403).json({ success: false, error: { code: 'READ_ONLY', message: 'เลเยอร์ปลายทางเป็นแบบอ่านอย่างเดียว' } });
      }

      const result = await pool.query(
        `UPDATE map_features 
         SET layer_id = $1, updated_at = NOW(), updated_by = $2 
         WHERE id = $3 
         RETURNING id, layer_id as "layerId", name;`,
        [targetLayerId, req.user!.id, featureId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบวัตถุบนแผนที่' } });
      }

      return res.status(200).json({
        success: true,
        data: result.rows[0],
        message: 'ย้ายวัตถุไปยังเลเยอร์ใหม่เรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /api/v1/features/:id
 * Delete a feature from a layer
 */
layersRouter.delete(
  '/features/:id',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const featureId = req.params.id;
      const result = await pool.query(`DELETE FROM map_features WHERE id = $1 RETURNING id;`, [featureId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบรูปแปลง' } });
      }
      return res.status(200).json({ success: true, message: 'ลบรูปแปลงเรียบร้อยแล้ว' });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/layers/:id/import
 * Import authorized GeoJSON FeatureCollection into a layer, preserving custom style extensions
 */
layersRouter.post(
  '/layers/:id/import',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const layerId = req.params.id;
      const geojson = req.body;

      const layerCheck = await pool.query(`SELECT id, project_id as "projectId", is_editable FROM map_layers WHERE id = $1;`, [layerId]);
      if (layerCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบเลเยอร์' } });
      }
      if (!layerCheck.rows[0].is_editable) {
        return res.status(403).json({ success: false, error: { code: 'READ_ONLY', message: 'เลเยอร์นี้เป็นแบบอ่านอย่างเดียว' } });
      }
      const projectId = layerCheck.rows[0].projectId;

      if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_GEOJSON', message: 'รูปแบบไฟล์ต้องเป็น GeoJSON FeatureCollection' },
        });
      }

      let insertedCount = 0;
      for (const feature of geojson.features) {
        if (!feature.geometry || !feature.geometry.type) continue;
        
        const props = feature.properties || {};
        const name = props.name || props.title || null;
        const description = props.description || null;
        const symbolId = props.symbolId || null;
        const style = props.style || null;

        await pool.query(
          `INSERT INTO map_features (
            layer_id, project_id, symbol_id, feature_type, name, description,
            geometry, style, properties, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_GeomFromGeoJSON($7), 4326), $8, $9, $10);`,
          [
            layerId,
            projectId,
            symbolId,
            feature.geometry.type,
            name,
            description,
            JSON.stringify(feature.geometry),
            style ? JSON.stringify(style) : null,
            JSON.stringify(props),
            req.user!.id,
          ]
        );
        insertedCount++;
      }

      return res.status(200).json({
        success: true,
        data: { insertedCount },
        message: `นำเข้าข้อมูล GeoJSON สำเร็จ ${insertedCount} รายการ`,
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/layers/import-kml
 * Import parsed KML / KMZ into a project layer with full data integrity,
 * transaction rollback on error, and optional conversion to Responsibility Area or Mission Area.
 */
layersRouter.post(
  '/layers/import-kml',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    const client = await pool.connect();
    try {
      const {
        projectId,
        layerName,
        originalFilename,
        fileFormat,
        intent = 'view_only',
        featureCollection,
        rawContent,
        selectedPolygonIndex,
        colorHex = '#00ffff',
        allowDuplicate = false,
      } = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_PROJECT_ID', message: 'กรุณาระบุรหัสโครงการ (Project ID)' },
        });
      }

      // Check project existence & permissions
      const projectCheck = await client.query('SELECT id, name FROM projects WHERE id = $1', [projectId]);
      if (projectCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'PROJECT_NOT_FOUND', message: 'ไม่พบโครงการที่ระบุ' },
        });
      }

      // 1. Process FeatureCollection: from body or parse from rawContent
      let fc = featureCollection;
      const warnings: string[] = [];

      if (!fc && rawContent) {
        if (fileFormat === 'kmz') {
          const buffer = Buffer.from(rawContent, 'base64');
          const parseResult = await parseKmz(buffer, originalFilename || 'imported.kmz');
          if (!parseResult.success || !parseResult.featureCollection) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'KMZ_PARSE_FAILED',
                message: parseResult.errors?.join(', ') || 'การแปลงไฟล์ KMZ ล้มเหลว',
              },
            });
          }
          fc = parseResult.featureCollection;
          if (parseResult.warnings) warnings.push(...parseResult.warnings);
        } else {
          // KML text
          const parseResult = parseKml(rawContent, originalFilename || 'imported.kml');
          if (!parseResult.success || !parseResult.featureCollection) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'KML_PARSE_FAILED',
                message: parseResult.errors?.join(', ') || 'การแปลงไฟล์ KML ล้มเหลว',
              },
            });
          }
          fc = parseResult.featureCollection;
          if (parseResult.warnings) warnings.push(...parseResult.warnings);
        }
      }

      if (!fc || !Array.isArray(fc.features) || fc.features.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'EMPTY_FEATURES', message: 'ไฟล์ไม่มีองค์ประกอบเชิงพื้นที่ (Geometry) ที่นำเข้าได้' },
        });
      }

      const finalLayerName = (layerName || fc.name || originalFilename || 'ชั้นข้อมูลนำเข้า').trim();
      const finalFilename = originalFilename || `${finalLayerName}.${fileFormat || 'kml'}`;

      // 2. Prevent accidental duplicate imports
      if (!allowDuplicate) {
        const dupCheck = await client.query(
          `SELECT id, name, original_filename FROM map_layers 
           WHERE project_id = $1 AND (name = $2 OR original_filename = $3)
           LIMIT 1;`,
          [projectId, finalLayerName, finalFilename]
        );
        if (dupCheck.rows.length > 0) {
          return res.status(409).json({
            success: false,
            isDuplicate: true,
            error: {
              code: 'DUPLICATE_IMPORT_WARNING',
              message: `ตรวจพบชั้นข้อมูลชื่อ "${finalLayerName}" หรือไฟล์ "${finalFilename}" ในโครงการนี้แล้ว คุณต้องการนำเข้าซ้ำหรือไม่?`,
              existingLayerId: dupCheck.rows[0].id,
            },
          });
        }
      }

      // 3. Begin Transaction
      await client.query('BEGIN');

      // Determine next order_index
      const maxOrderRes = await client.query(
        `SELECT COALESCE(MAX(order_index), -1) + 1 as "nextOrder" FROM map_layers WHERE project_id = $1;`,
        [projectId]
      );
      const nextOrder = maxOrderRes.rows[0].nextOrder;

      // Extract metadata
      const sourceMetadata = fc.metadata || {
        originalFilename: finalFilename,
        fileFormat: fileFormat || 'kml',
        featureCount: fc.features.length,
      };

      // Insert map_layers record
      const layerInsertSql = `
        INSERT INTO map_layers (
          project_id, name, layer_type, visibility, opacity, is_editable, color_hex,
          order_index, permissions, original_filename, file_format, source_metadata,
          coordinate_reference_system, altitude_reference, import_status, validation_warnings,
          created_by
        ) VALUES (
          $1, $2, 'imported_kml', true, 1.0, true, $3,
          $4, '{"canEditRoles": ["admin", "project_manager"], "canViewRoles": ["admin", "project_manager", "analyst", "viewer"]}',
          $5, $6, $7,
          'EPSG:4326', $8, 'completed', $9,
          $10
        ) RETURNING id, project_id as "projectId", name, layer_type as "layerType", visibility, opacity, color_hex as "colorHex", original_filename as "originalFilename", file_format as "fileFormat", source_metadata as "sourceMetadata", created_at as "createdAt";
      `;

      const primaryAltMode = fc.features[0]?.properties?.altitudeMode || 'clampToGround';

      const layerRes = await client.query(layerInsertSql, [
        projectId,
        finalLayerName,
        colorHex,
        nextOrder,
        finalFilename,
        fileFormat || 'kml',
        JSON.stringify(sourceMetadata),
        primaryAltMode,
        JSON.stringify(warnings),
        req.user!.id,
      ]);

      const layer = layerRes.rows[0];
      const layerId = layer.id;

      // Insert features
      let insertedCount = 0;
      let createdManagedAreaId: string | null = null;
      let candidatePolygons: any[] = [];

      for (let i = 0; i < fc.features.length; i++) {
        const feature = fc.features[i];
        if (!feature.geometry || !feature.geometry.type) continue;

        const geomType = feature.geometry.type;
        const props = feature.properties || {};
        const featName = props.name || `Feature ${i + 1}`;
        const featDesc = props.description || null;
        const style = props.style || null;

        // Collect polygons for responsibility area / mission area linking
        if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
          candidatePolygons.push({ index: i, feature });
        }

        await client.query(
          `INSERT INTO map_features (
            layer_id, project_id, feature_type, name, description,
            geometry, style, properties, created_by
          ) VALUES ($1, $2, $3, $4, $5, ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)), $7, $8, $9);`,
          [
            layerId,
            projectId,
            geomType,
            featName,
            featDesc,
            JSON.stringify(feature.geometry),
            style ? JSON.stringify(style) : null,
            JSON.stringify(props),
            req.user!.id,
          ]
        );
        insertedCount++;
      }

      // If intent is 'responsibility_area', convert designated Polygon to managed_areas
      if (intent === 'responsibility_area' && candidatePolygons.length > 0) {
        let chosen = candidatePolygons[0];
        if (typeof selectedPolygonIndex === 'number' && candidatePolygons[selectedPolygonIndex]) {
          chosen = candidatePolygons[selectedPolygonIndex];
        }

        const polyGeom = chosen.feature.geometry;
        // Compute area using PostGIS ST_Area geography
        const areaRes = await client.query(
          `SELECT ST_Area(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))::geography) as "areaSqm";`,
          [JSON.stringify(polyGeom)]
        );
        const areaSqm = parseFloat(areaRes.rows[0]?.areaSqm || '10000');

        const areaInsertSql = `
          INSERT INTO managed_areas (
            project_id, name, description, boundary, area_sqm, status, created_by
          ) VALUES (
            $1, $2, $3, ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)), $5, 'active', $6
          ) RETURNING id;
        `;
        const areaResInsert = await client.query(areaInsertSql, [
          projectId,
          chosen.feature.properties?.name || `${finalLayerName} (พื้นที่รับผิดชอบ)`,
          `สร้างจากการนำเข้าไฟล์ KML/KMZ: ${finalFilename}`,
          JSON.stringify(polyGeom),
          areaSqm,
          req.user!.id,
        ]);
        createdManagedAreaId = areaResInsert.rows[0].id;
      }

      await client.query('COMMIT');

      // Audit Log
      await logAuditEvent({
        userId: req.user!.id,
        action: 'layer.import_kml',
        resourceType: 'map_layers',
        resourceId: layerId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: {
          layerName: finalLayerName,
          filename: finalFilename,
          format: fileFormat,
          insertedCount,
          intent,
          managedAreaId: createdManagedAreaId,
        },
      });

      return res.status(201).json({
        success: true,
        data: {
          layer: {
            ...layer,
            featureCount: insertedCount,
          },
          insertedCount,
          managedAreaId: createdManagedAreaId,
          candidatePolygonsCount: candidatePolygons.length,
          warnings,
        },
        message: `นำเข้าไฟล์ ${finalFilename} สำเร็จเรียบร้อย (${insertedCount} รูปแปลง)`,
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      return next(err);
    } finally {
      client.release();
    }
  }
);

/**
 * GET /api/v1/layers/:id/export-kml
 * Re-export layer and its vector features back to standard OGC KML 2.2
 */
layersRouter.get('/layers/:id/export-kml', async (req: Request, res: Response, next) => {
  try {
    const layerId = req.params.id;

    // Fetch layer
    const layerRes = await pool.query('SELECT * FROM map_layers WHERE id = $1', [layerId]);
    if (layerRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบเลเยอร์ที่ต้องการส่งออก' } });
    }
    const layer = layerRes.rows[0];

    // Fetch features
    const featRes = await pool.query(
      `SELECT id, name, description, feature_type, ST_AsGeoJSON(geometry)::json as geometry, style, properties
       FROM map_features WHERE layer_id = $1 ORDER BY created_at ASC;`,
      [layerId]
    );

    const kmlFeatures: KmlFeature[] = featRes.rows.map((row) => ({
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: {
        name: row.name || 'Feature',
        description: row.description,
        altitudeMode: row.properties?.altitudeMode || 'clampToGround',
        altitude: row.properties?.altitude,
        style: row.style,
        extendedData: row.properties?.extendedData,
      },
    }));

    const kmlText = exportFeaturesToKml(kmlFeatures, layer.name, `ชั้นข้อมูล ${layer.name} จาก GeoMonitor 3D`);

    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(layer.name)}.kml"`);
    return res.status(200).send(kmlText);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/layers/:id/export-kmz
 * Re-export layer and its vector features into a standard compressed KMZ archive
 */
layersRouter.get('/layers/:id/export-kmz', async (req: Request, res: Response, next) => {
  try {
    const layerId = req.params.id;

    // Fetch layer
    const layerRes = await pool.query('SELECT * FROM map_layers WHERE id = $1', [layerId]);
    if (layerRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบเลเยอร์ที่ต้องการส่งออก' } });
    }
    const layer = layerRes.rows[0];

    // Fetch features
    const featRes = await pool.query(
      `SELECT id, name, description, feature_type, ST_AsGeoJSON(geometry)::json as geometry, style, properties
       FROM map_features WHERE layer_id = $1 ORDER BY created_at ASC;`,
      [layerId]
    );

    const kmlFeatures: KmlFeature[] = featRes.rows.map((row) => ({
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: {
        name: row.name || 'Feature',
        description: row.description,
        altitudeMode: row.properties?.altitudeMode || 'clampToGround',
        altitude: row.properties?.altitude,
        style: row.style,
        extendedData: row.properties?.extendedData,
      },
    }));

    const kmzBuffer = await exportFeaturesToKmz(kmlFeatures, layer.name);

    res.setHeader('Content-Type', 'application/vnd.google-earth.kmz');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(layer.name)}.kmz"`);
    return res.status(200).send(Buffer.from(kmzBuffer));
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/layers/:id/convert-to-managed-area
 * Convert a polygon feature from an imported layer into a Managed Area
 */
layersRouter.post(
  '/layers/:id/convert-to-managed-area',
  authorizeRoles('admin', 'project_manager'),
  async (req: Request, res: Response, next) => {
    try {
      const layerId = req.params.id;
      const { featureId, name, description } = req.body;

      const layerRes = await pool.query('SELECT id, project_id as "projectId", name FROM map_layers WHERE id = $1', [layerId]);
      if (layerRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบเลเยอร์' } });
      }
      const layer = layerRes.rows[0];

      // Query polygon feature
      let featQuery = `SELECT id, name, description, ST_AsGeoJSON(geometry)::json as geometry 
                       FROM map_features 
                       WHERE layer_id = $1 AND feature_type IN ('Polygon', 'MultiPolygon')`;
      const params: any[] = [layerId];
      if (featureId) {
        params.push(featureId);
        featQuery += ` AND id = $2`;
      }
      featQuery += ` LIMIT 1`;

      const featRes = await pool.query(featQuery, params);
      if (featRes.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_POLYGON_FOUND', message: 'ไม่พบรูปแปลงประเภทพื้นที่ (Polygon) ในชั้นข้อมูลนี้' },
        });
      }

      const feature = featRes.rows[0];
      const areaName = name || feature.name || `${layer.name} (พื้นที่รับผิดชอบ)`;

      // Compute area in sqm
      const areaCalc = await pool.query(
        `SELECT ST_Area(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))::geography) as "areaSqm";`,
        [JSON.stringify(feature.geometry)]
      );
      const areaSqm = parseFloat(areaCalc.rows[0]?.areaSqm || '10000');

      const insertAreaSql = `
        INSERT INTO managed_areas (
          project_id, name, description, boundary, area_sqm, status, created_by
        ) VALUES (
          $1, $2, $3, ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)), $5, 'active', $6
        ) RETURNING id, project_id as "projectId", name, description, area_sqm as "areaSqm", status, created_at as "createdAt";
      `;

      const insertRes = await pool.query(insertAreaSql, [
        layer.projectId,
        areaName,
        description || `สร้างจากรูปแปลง ${feature.name} ในชั้นข้อมูล ${layer.name}`,
        JSON.stringify(feature.geometry),
        areaSqm,
        req.user!.id,
      ]);

      await logAuditEvent({
        userId: req.user!.id,
        action: 'managed_area.create_from_layer',
        resourceType: 'managed_areas',
        resourceId: insertRes.rows[0].id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: { layerId, featureId: feature.id, areaName },
      });

      return res.status(201).json({
        success: true,
        data: insertRes.rows[0],
        message: `แปลงเป็นพื้นที่รับผิดชอบ "${areaName}" สำเร็จเรียบร้อย`,
      });
    } catch (err) {
      return next(err);
    }
  }
);
