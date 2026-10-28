import { Router, Request, Response } from 'express';
import { GenerateReportSchema } from '@geomonitor/shared';
import { pool } from '../../db/index.js';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { logAuditEvent } from '../../middlewares/audit.middleware.js';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

/**
 * POST /api/v1/reports
 * Generate Survey Comparison & Volume Report
 */
reportsRouter.post(
  '/reports',
  authorizeRoles('admin', 'project_manager', 'analyst'),
  async (req: Request, res: Response, next) => {
    try {
      const input = GenerateReportSchema.parse(req.body);

      // Verify Area
      const areaRes = await pool.query(`SELECT name, area_sqm FROM managed_areas WHERE id = $1;`, [input.areaId]);
      if (areaRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลพื้นที่' } });
      }

      const storageKey = `reports/${input.areaId}/Report_${Date.now()}.${input.format}`;

      const insertSql = `
        INSERT INTO reports (
          area_id, change_analysis_id, title, report_type, format, file_storage_key,
          metadata, generated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING id, area_id as "areaId", title, report_type as "reportType",
                    format, file_storage_key as "fileStorageKey", created_at as "createdAt";
      `;

      const result = await pool.query(insertSql, [
        input.areaId,
        input.changeAnalysisId || null,
        input.title,
        input.reportType,
        input.format,
        storageKey,
        JSON.stringify({ notes: input.analystNotes || null }),
        req.user!.id,
      ]);

      const report = result.rows[0];

      await logAuditEvent({
        userId: req.user!.id,
        action: 'report.generate',
        resourceType: 'reports',
        resourceId: report.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        payloadDiff: { title: report.title, format: report.format },
      });

      return res.status(201).json({
        success: true,
        data: report,
        message: 'สร้างรายงานสรุปผลการสำรวจเรียบร้อยแล้ว',
      });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /api/v1/reports/:id
 * Retrieve report details
 */
reportsRouter.get('/reports/:id', async (req: Request, res: Response, next) => {
  try {
    const reportId = req.params.id;

    const sql = `
      SELECT 
        r.id,
        r.area_id as "areaId",
        m.name as "areaName",
        r.change_analysis_id as "changeAnalysisId",
        r.title,
        r.report_type as "reportType",
        r.format,
        r.file_storage_key as "fileStorageKey",
        r.metadata,
        r.generated_by as "generatedBy",
        u.full_name as "generatedByName",
        r.created_at as "createdAt"
      FROM reports r
      JOIN managed_areas m ON r.area_id = m.id
      LEFT JOIN users u ON r.generated_by = u.id
      WHERE r.id = $1;
    `;

    const result = await pool.query(sql, [reportId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบรายงาน' } });
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
 * GET /api/v1/reports/:id/download
 * Export CSV or PDF report with real calculated metrics
 */
reportsRouter.get('/reports/:id/download', async (req: Request, res: Response, next) => {
  try {
    const reportId = req.params.id;

    const reportRes = await pool.query(
      `SELECT r.*, m.name as area_name, m.area_sqm
       FROM reports r
       JOIN managed_areas m ON r.area_id = m.id
       WHERE r.id = $1;`,
      [reportId]
    );

    if (reportRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบรายงาน' } });
    }

    const report = reportRes.rows[0];

    // Fetch change analysis details if linked
    let analysisData: any = null;
    let features: any[] = [];
    if (report.change_analysis_id) {
      const aRes = await pool.query(
        `SELECT * FROM change_analyses WHERE id = $1;`,
        [report.change_analysis_id]
      );
      analysisData = aRes.rows[0];

      const fRes = await pool.query(
        `SELECT feature_type, area_sqm, mean_elevation_change_m, estimated_volume_m3, is_confirmed
         FROM change_features
         WHERE change_analysis_id = $1;`,
        [report.change_analysis_id]
      );
      features = fRes.rows;
    }

    if (report.format === 'csv') {
      let csv = '\uFEFF'; // UTF-8 BOM for Excel in Thai
      csv += `รายงานสรุปการวิเคราะห์การเปลี่ยนแปลงและปริมาตรขุดถม (GeoMonitor 3D Report)\n`;
      csv += `หัวข้อรายงาน,${report.title}\n`;
      csv += `พื้นที่ดูแล,${report.area_name}\n`;
      csv += `วันที่ออกรายงาน,${new Date(report.created_at).toLocaleString('th-TH')}\n`;
      csv += `พื้นที่สำรวจรวม (ตร.ม.),${report.area_sqm}\n\n`;

      if (analysisData) {
        csv += `สรุปปริมาตรงานดิน (Earthwork Volume Summary)\n`;
        csv += `พื้นที่ที่มีการเปลี่ยนแปลง (ตร.ม.),${analysisData.total_change_area_sqm}\n`;
        csv += `ปริมาตรขุดดิน / Cut (ลบ.ม.),${analysisData.cut_volume_m3}\n`;
        csv += `ปริมาตรถมดิน / Fill (ลบ.ม.),${analysisData.fill_volume_m3}\n`;
        csv += `ปริมาตรสุทธิ / Net (ลบ.ม.),${analysisData.net_volume_m3}\n`;
        csv += `ความเชื่อมั่น (Confidence),${(Number(analysisData.confidence_score) * 100).toFixed(1)}%\n\n`;

        csv += `รายละเอียดรูปแปลงการเปลี่ยนแปลง (Detected Change Features)\n`;
        csv += `ลำดับ,ประเภทการเปลี่ยนแปลง,พื้นที่ (ตร.ม.),การเปลี่ยนระดับความสูงเฉลี่ย (ม.),ปริมาตรโดยประมาณ (ลบ.ม.),สถานะการยืนยัน\n`;
        features.forEach((f, idx) => {
          csv += `${idx + 1},${f.feature_type},${f.area_sqm},${f.mean_elevation_change_m || 0},${f.estimated_volume_m3 || 0},${f.is_confirmed ? 'ยืนยันแล้ว (Confirmed)' : 'ผู้สมัคร (Candidate)'}\n`;
        });
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="GeoMonitor_Report_${report.id}.csv"`);
      return res.status(200).send(csv);
    }

    // Default: Printable HTML / PDF view
    const html = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8">
        <title>${report.title} — GeoMonitor 3D</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Sarabun", "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
          .container { max-width: 900px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 36px; border: 1px solid #334155; }
          h1 { color: #38bdf8; font-size: 26px; border-bottom: 2px solid #0284c7; padding-bottom: 12px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; background: #0f172a; padding: 18px; border-radius: 8px; }
          .stat-card { background: #0284c715; border: 1px solid #0284c750; padding: 16px; border-radius: 8px; margin: 10px 0; }
          .stat-val { font-size: 24px; font-weight: bold; color: #38bdf8; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #334155; padding: 12px; text-align: left; }
          th { background: #0f172a; color: #38bdf8; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; }
          .badge-green { background: #10b98125; color: #34d399; border: 1px solid #10b981; }
          .badge-yellow { background: #f59e0b25; color: #fbbf24; border: 1px solid #f59e0b; }
          .btn-print { background: #0284c7; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <button class="btn-print" onclick="window.print()">🖨️ พิมพ์รายงาน / บันทึกเป็น PDF (Print / Save PDF)</button>
          <h1>📑 GeoMonitor 3D — รายงานการติดตามและวิเคราะห์การเปลี่ยนแปลง</h1>
          <div class="meta-grid">
            <div><strong>หัวข้อรายงาน:</strong> ${report.title}</div>
            <div><strong>พื้นที่เป้าหมาย:</strong> ${report.area_name}</div>
            <div><strong>วันที่สร้างรายงาน:</strong> ${new Date(report.created_at).toLocaleString('th-TH')}</div>
            <div><strong>ระบบพิกัด:</strong> WGS84 (EPSG:4326) / UTM Zone 47N</div>
          </div>

          ${
            analysisData
              ? `
            <h3>📊 สรุปผลการวิเคราะห์ปริมาตรงานดิน (Cut / Fill Volume Summary)</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
              <div class="stat-card">
                <div>ขุดดิน (Excavation / Cut)</div>
                <div class="stat-val" style="color: #f87171;">-${Number(analysisData.cut_volume_m3).toLocaleString('th-TH')} ลบ.ม.</div>
              </div>
              <div class="stat-card">
                <div>ถมดิน (Accretion / Fill)</div>
                <div class="stat-val" style="color: #34d399;">+${Number(analysisData.fill_volume_m3).toLocaleString('th-TH')} ลบ.ม.</div>
              </div>
              <div class="stat-card">
                <div>ปริมาตรสุทธิ (Net Volume)</div>
                <div class="stat-val">${Number(analysisData.net_volume_m3).toLocaleString('th-TH')} ลบ.ม.</div>
              </div>
            </div>

            <p><strong>หมายเหตุทางเทคนิคและข้อจำกัด:</strong> ${analysisData.limitations_notes || 'ไม่มี'}</p>

            <h3>📍 รายการตรวจพบการเปลี่ยนแปลงทางกายภาพ (Detected Physical Features)</h3>
            <table>
              <thead>
                <tr>
                  <th>ประเภท</th>
                  <th>พื้นที่ (ตร.ม.)</th>
                  <th>ความสูงเฉลี่ย (ม.)</th>
                  <th>ปริมาตร (ลบ.ม.)</th>
                  <th>สถานะการตรวจสอบ</th>
                </tr>
              </thead>
              <tbody>
                ${features
                  .map(
                    (f) => `
                  <tr>
                    <td>${f.feature_type}</td>
                    <td>${Number(f.area_sqm).toLocaleString('th-TH')}</td>
                    <td>${f.mean_elevation_change_m || '-'}</td>
                    <td>${Number(f.estimated_volume_m3 || 0).toLocaleString('th-TH')}</td>
                    <td>
                      <span class="badge ${f.is_confirmed ? 'badge-green' : 'badge-yellow'}">
                        ${f.is_confirmed ? 'ยืนยันแล้ว (Confirmed)' : 'ผู้สมัคร (Candidate)'}
                      </span>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          `
              : '<p>ไม่มีข้อมูลการวิเคราะห์เปรียบเทียบแนบในรายงานนี้</p>'
          }
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    return next(err);
  }
});
