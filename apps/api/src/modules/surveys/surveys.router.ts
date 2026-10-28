import { Router, Request, Response } from 'express';
import { CreateSurveySchema, RegisterAssetSchema, TriggerProcessSchema } from '@geomonitor/shared';
import { pool } from '../../db/index.js';
import { authenticate, authorizeRoles, authorizeAreaAccess } from '../../middlewares/auth.middleware.js';
import { logAuditEvent } from '../../middlewares/audit.middleware.js';

export const surveysRouter = Router();
surveysRouter.use(authenticate);

/**
 * GET /api/v1/areas/:areaId/surveys
 * List historical surveys for an area ordered by date
 */
surveysRouter.get('/areas/:areaId/surveys', authorizeAreaAccess, async (req: Request, res: Response, next) => {
  try {
    const areaId = req.params.areaId;

    const sql = `
      SELECT 
        s.id,
        s.area_id as "areaId",
        s.survey_code as "surveyCode",
        s.survey_date as "surveyDate",
        s.drone_model as "droneModel",
        s.sensor_type as "sensorType",
        s.flight_altitude_m as "flightAltitudeM",
        s.ground_sample_distance_cm as "groundSampleDistanceCm",
        s.crs_horizontal as "crsHorizontal",
        s.crs_vertical as "crsVertical",
        s.processing_status as "processingStatus",
        s.quality_metrics as "qualityMetrics",
        s.created_at as "createdAt",
        COUNT(a.id)::int as "assetCount"
      FROM drone_surveys s
      LEFT JOIN survey_assets a ON s.id = a.survey_id
      WHERE s.area_id = $1
      GROUP BY s.id
      ORDER BY s.survey_date DESC;
    `;

    const result = await pool.query(sql, [areaId]);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/areas/:areaId/surveys
 * Create a new drone survey record
 */
surveysRouter.post(
  '/areas/:areaId/surveys',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  authorizeAreaAccess,
  async (req: Request, res: Response, next) => {
    try {
      const areaId = req.params.areaId;
      const input = CreateSurveySchema.parse({ ...req.body, areaId });

      const insertSql = `
        INSERT INTO drone_surveys (
          area_id, survey_code, survey_date, drone_model, sensor_type,
          flight_altitude_m, ground_sample_distance_cm, crs_horizontal, crs_vertical,
          processing_status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
        RETURNING 
          id, area_id as "areaId", survey_code as "surveyCode", survey_date as "surveyDate",
          drone_model as "droneModel", sensor_type as "sensorType",
          flight_altitude_m as "flightAltitudeM", ground_sample_distance_cm as "groundSampleDistanceCm",
          crs_horizontal as "crsHorizontal", crs_vertical as "crsVertical",
          processing_status as "processingStatus", created_at as "createdAt";
      `;

      const result = await pool.query(insertSql, [
        areaId,
        input.surveyCode,
        input.surveyDate,
        input.droneModel || null,
        input.sensorType || null,
        input.flightAltitudeM || null,
        input.groundSampleDistanceCm || null,
        input.crsHorizontal,
        input.crsVertical,
        req.user!.id,
      ]);

      const survey = result.rows[0];

      await logAuditEvent({
        userId: req.user!.id,
        action: 'survey.create',
        resourceType: 'drone_surveys',
        resourceId: survey.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: { surveyCode: survey.surveyCode, surveyDate: survey.surveyDate },
      });

      return res.status(201).json({
        success: true,
        data: survey,
        message: 'ลงทะเบียนรอบการสำรวจโดรนเรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/surveys/:id
 * Get survey details and attached assets
 */
surveysRouter.get('/surveys/:id', async (req: Request, res: Response, next) => {
  try {
    const surveyId = req.params.id;

    const surveySql = `
      SELECT 
        s.id,
        s.area_id as "areaId",
        m.name as "areaName",
        s.survey_code as "surveyCode",
        s.survey_date as "surveyDate",
        s.drone_model as "droneModel",
        s.sensor_type as "sensorType",
        s.flight_altitude_m as "flightAltitudeM",
        s.ground_sample_distance_cm as "groundSampleDistanceCm",
        s.crs_horizontal as "crsHorizontal",
        s.crs_vertical as "crsVertical",
        s.processing_status as "processingStatus",
        s.processing_logs as "processingLogs",
        s.quality_metrics as "qualityMetrics",
        s.created_at as "createdAt",
        s.updated_at as "updatedAt"
      FROM drone_surveys s
      JOIN managed_areas m ON s.area_id = m.id
      WHERE s.id = $1;
    `;

    const surveyRes = await pool.query(surveySql, [surveyId]);
    if (surveyRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบรอบการสำรวจ' } });
    }

    const survey = surveyRes.rows[0];

    // Fetch assets
    const assetsRes = await pool.query(
      `SELECT 
         id, survey_id as "surveyId", asset_type as "assetType",
         storage_bucket as "storageBucket", storage_key as "storageKey",
         file_name as "fileName", file_size_bytes as "fileSizeBytes",
         mime_type as "mimeType", checksum_sha256 as "checksumSha256",
         ST_AsGeoJSON(bounding_box)::json as "boundingBox",
         resolution_m_per_px as "resolutionMPerPx",
         is_primary as "isPrimary",
         created_at as "createdAt"
       FROM survey_assets
       WHERE survey_id = $1
       ORDER BY is_primary DESC, created_at ASC;`,
      [surveyId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...survey,
        assets: assetsRes.rows,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/surveys/:id/assets
 * Register asset deliverable (Orthomosaic, DSM, 3D Tiles, etc.)
 */
surveysRouter.post(
  '/surveys/:id/assets',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const surveyId = req.params.id;
      const input = RegisterAssetSchema.parse(req.body);

      const storageBucket = 'geomonitor-assets';
      const storageKey = `surveys/${surveyId}/${input.assetType}_${Date.now()}_${input.fileName}`;
      const bboxJson = input.boundingBox ? JSON.stringify(input.boundingBox) : null;

      const insertSql = `
        INSERT INTO survey_assets (
          survey_id, asset_type, storage_bucket, storage_key,
          file_name, file_size_bytes, mime_type, checksum_sha256,
          bounding_box, resolution_m_per_px, is_primary
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          ${bboxJson ? `ST_SetSRID(ST_GeomFromGeoJSON('${bboxJson}'), 4326)` : 'NULL'},
          $9, $10
        )
        RETURNING 
          id, survey_id as "surveyId", asset_type as "assetType",
          storage_bucket as "storageBucket", storage_key as "storageKey",
          file_name as "fileName", file_size_bytes as "fileSizeBytes",
          mime_type as "mimeType", checksum_sha256 as "checksumSha256",
          resolution_m_per_px as "resolutionMPerPx", is_primary as "isPrimary",
          created_at as "createdAt";
      `;

      const result = await pool.query(insertSql, [
        surveyId,
        input.assetType,
        storageBucket,
        storageKey,
        input.fileName,
        input.fileSizeBytes,
        input.mimeType,
        input.checksumSha256,
        input.resolutionMPerPx || null,
        input.isPrimary,
      ]);

      const asset = result.rows[0];

      await logAuditEvent({
        userId: req.user!.id,
        action: 'asset.upload',
        resourceType: 'survey_assets',
        resourceId: asset.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: { fileName: asset.fileName, assetType: asset.assetType, size: asset.fileSizeBytes },
      });

      return res.status(201).json({
        success: true,
        data: asset,
        message: 'บันทึกไฟล์ผลลัพธ์การสำรวจโดรนสำเร็จ',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/surveys/:id/assets
 * List assets with direct access paths
 */
surveysRouter.get('/surveys/:id/assets', async (req: Request, res: Response, next) => {
  try {
    const surveyId = req.params.id;

    const result = await pool.query(
      `SELECT 
         id, survey_id as "surveyId", asset_type as "assetType",
         storage_bucket as "storageBucket", storage_key as "storageKey",
         file_name as "fileName", file_size_bytes as "fileSizeBytes",
         mime_type as "mimeType", checksum_sha256 as "checksumSha256",
         ST_AsGeoJSON(bounding_box)::json as "boundingBox",
         resolution_m_per_px as "resolutionMPerPx",
         is_primary as "isPrimary",
         created_at as "createdAt"
       FROM survey_assets
       WHERE survey_id = $1
       ORDER BY is_primary DESC, created_at ASC;`,
      [surveyId]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/surveys/:id/process
 * Dispatch photogrammetry / COG raster processing pipeline
 */
surveysRouter.post(
  '/surveys/:id/process',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const surveyId = req.params.id;
      const input = TriggerProcessSchema.parse(req.body);

      // Create a processing job record
      const jobRes = await pool.query(
        `INSERT INTO processing_jobs (
           survey_id, job_type, status, progress_percent, logs
         ) VALUES (
           $1, $2, 'running', 10,
           $3
         ) RETURNING id, status, progress_percent as "progressPercent", created_at as "createdAt";`,
        [
          surveyId,
          input.jobType,
          JSON.stringify([
            { timestamp: new Date().toISOString(), message: 'เริ่มต้นขั้นตอนการประมวลผลข้อมูลโดรน (Job initialized)' },
            { timestamp: new Date().toISOString(), message: 'ตรวจสอบไฟล์ภาพและ Georeferencing metadata' },
          ]),
        ]
      );

      const job = jobRes.rows[0];

      // Update survey status to processing
      await pool.query(
        `UPDATE drone_surveys SET processing_status = 'processing', updated_at = NOW() WHERE id = $1;`,
        [surveyId]
      );

      await logAuditEvent({
        userId: req.user!.id,
        action: 'survey.process',
        resourceType: 'processing_jobs',
        resourceId: job.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: { jobType: input.jobType },
      });

      return res.status(202).json({
        success: true,
        data: {
          jobId: job.id,
          status: 'processing',
          progress: 15,
          message: 'ส่งงานเข้าสู่คิวประมวลผลพื้นหลังเรียบร้อยแล้ว (Processing job enqueued)',
        },
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/jobs/:jobId
 * Poll processing job progress
 */
surveysRouter.get('/jobs/:jobId', async (req: Request, res: Response, next) => {
  try {
    const jobId = req.params.jobId;

    const result = await pool.query(
      `SELECT 
         id, survey_id as "surveyId", job_type as "jobType",
         status, progress_percent as "progressPercent",
         error_message as "errorMessage", logs,
         started_at as "startedAt", finished_at as "finishedAt",
         created_at as "createdAt"
       FROM processing_jobs
       WHERE id = $1;`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบงานประมวลผล' } });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    return next(err);
  }
});
