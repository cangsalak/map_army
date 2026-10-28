import { Router, Request, Response } from 'express';
import { pool } from '../../db/index.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

/**
 * GET /api/v1/dashboard/metrics
 * Comprehensive real-time metrics for Thai GIS Command Center
 */
dashboardRouter.get('/dashboard/metrics', async (req: Request, res: Response, next) => {
  try {
    // 1. Core Counts
    const countsSql = `
      SELECT 
        (SELECT COUNT(*) FROM managed_areas) as "totalAreas",
        (SELECT COUNT(*) FROM drone_surveys WHERE processing_status = 'completed') as "completedSurveys",
        (SELECT COUNT(*) FROM drone_surveys WHERE processing_status = 'pending' OR processing_status = 'processing') as "pendingSurveys",
        (SELECT COUNT(DISTINCT area_id) FROM change_analyses) as "areasWithChanges",
        (SELECT COALESCE(SUM(cut_volume_m3), 0) FROM change_analyses) as "totalCutVolumeM3",
        (SELECT COALESCE(SUM(fill_volume_m3), 0) FROM change_analyses) as "totalFillVolumeM3",
        (SELECT COUNT(*) FROM change_features WHERE is_confirmed = false) as "unreviewedCandidates";
    `;
    const countsRes = await pool.query(countsSql);
    const counts = countsRes.rows[0];

    // 2. Recent Survey Activities
    const surveysSql = `
      SELECT 
        s.id,
        s.survey_code as "surveyCode",
        s.survey_date as "surveyDate",
        m.name as "areaName",
        s.drone_model as "droneModel",
        s.processing_status as "processingStatus",
        s.created_at as "createdAt"
      FROM drone_surveys s
      JOIN managed_areas m ON s.area_id = m.id
      ORDER BY s.survey_date DESC
      LIMIT 5;
    `;
    const surveysRes = await pool.query(surveysSql);

    // 3. Recent Change Analyses
    const changesSql = `
      SELECT 
        ca.id,
        m.name as "areaName",
        ca.analysis_type as "analysisType",
        ca.total_change_area_sqm as "totalChangeAreaSqm",
        ca.cut_volume_m3 as "cutVolumeM3",
        ca.fill_volume_m3 as "fillVolumeM3",
        ca.status,
        ca.created_at as "createdAt"
      FROM change_analyses ca
      JOIN managed_areas m ON ca.area_id = m.id
      ORDER BY ca.created_at DESC
      LIMIT 5;
    `;
    const changesRes = await pool.query(changesSql);

    // 4. Processing Jobs status
    const jobsSql = `
      SELECT 
        j.id,
        j.job_type as "jobType",
        j.status,
        j.progress_percent as "progressPercent",
        s.survey_code as "surveyCode",
        j.created_at as "createdAt"
      FROM processing_jobs j
      LEFT JOIN drone_surveys s ON j.survey_id = s.id
      ORDER BY j.created_at DESC
      LIMIT 5;
    `;
    const jobsRes = await pool.query(jobsSql);

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalAreas: parseInt(counts.totalAreas, 10),
          completedSurveys: parseInt(counts.completedSurveys, 10),
          pendingSurveys: parseInt(counts.pendingSurveys, 10),
          areasWithChanges: parseInt(counts.areasWithChanges, 10),
          totalCutVolumeM3: parseFloat(counts.totalCutVolumeM3),
          totalFillVolumeM3: parseFloat(counts.totalFillVolumeM3),
          unreviewedCandidates: parseInt(counts.unreviewedCandidates, 10),
        },
        recentSurveys: surveysRes.rows,
        recentChangeAnalyses: changesRes.rows,
        processingJobs: jobsRes.rows,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/system/reset-data
 * Completely clear all managed areas, surveys, assets, change analyses, reports, and logs
 */
dashboardRouter.post('/system/reset-data', async (req: Request, res: Response, next) => {
  try {
    await pool.query(`
      TRUNCATE TABLE 
        reports, 
        analyst_annotations, 
        change_features, 
        change_analyses, 
        survey_assets, 
        processing_jobs, 
        drone_surveys, 
        area_members, 
        managed_areas 
      CASCADE;
    `);

    return res.status(200).json({
      success: true,
      message: 'ลบข้อมูลพื้นที่ รอบบิน และผลการวิเคราะห์ออกทั้งหมดเรียบร้อยแล้ว (All operational data cleared)',
    });
  } catch (err) {
    return next(err);
  }
});

