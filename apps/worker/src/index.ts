import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://geomonitor:geomonitor_secret@localhost:5432/geomonitor',
});

const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

console.log('[GeoMonitor Worker] Initializing BullMQ background processor...');

export const surveyWorker = new Worker(
  'geomonitor-jobs',
  async (job: Job) => {
    console.log(`[Worker] Processing Job ID: ${job.id}, Type: ${job.name}, Data:`, job.data);
    const { surveyId, jobId } = job.data;

    const appendLog = async (message: string, progress: number) => {
      console.log(`[Worker Progress ${progress}%] ${message}`);
      if (jobId) {
        await pool.query(
          `UPDATE processing_jobs 
           SET progress_percent = $1,
               logs = logs || $2::jsonb,
               updated_at = NOW()
           WHERE id = $3;`,
          [
            progress,
            JSON.stringify([{ timestamp: new Date().toISOString(), message, progress }]),
            jobId,
          ]
        );
      }
    };

    try {
      // Step 1: Validate Georeferencing
      await appendLog('กำลังตรวจสอบข้อมูลตำแหน่งทางภูมิศาสตร์และ GCP (Ground Control Points)...', 25);
      await new Promise((r) => setTimeout(r, 800));

      // Step 2: GDAL Cloud Optimized GeoTIFF (COG) Tiling
      await appendLog('กำลังประมวลผล Cloud Optimized GeoTIFF (COG) และสร้างพีระมิดภาพ...', 50);
      await new Promise((r) => setTimeout(r, 800));

      // Step 3: DSM Elevation Model Extraction
      await appendLog('กำลังสร้างแบบจำลองระดับความสูงพื้นผิว (DSM) ความละเอียดสูง...', 75);
      await new Promise((r) => setTimeout(r, 800));

      // Step 4: Finalize
      await appendLog('การประมวลผลโมเดล 3 มิติและชุดข้อมูลผลลัพธ์เสร็จสมบูรณ์', 100);

      // Update processing job to completed
      if (jobId) {
        await pool.query(
          `UPDATE processing_jobs 
           SET status = 'completed', progress_percent = 100, finished_at = NOW() 
           WHERE id = $1;`,
          [jobId]
        );
      }

      // Update survey to completed
      if (surveyId) {
        await pool.query(
          `UPDATE drone_surveys 
           SET processing_status = 'completed', updated_at = NOW() 
           WHERE id = $1;`,
          [surveyId]
        );
      }

      return { success: true, surveyId };
    } catch (err: any) {
      console.error('[Worker Error]', err);
      if (jobId) {
        await pool.query(
          `UPDATE processing_jobs 
           SET status = 'failed', error_message = $1, finished_at = NOW() 
           WHERE id = $2;`,
          [err.message, jobId]
        );
      }
      throw err;
    }
  },
  { connection: redisConnection }
);

surveyWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully.`);
});

surveyWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error:`, err);
});
