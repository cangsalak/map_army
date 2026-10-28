import { z } from 'zod';
import { GeoJSONPolygonSchema } from './area.schema.js';

export const CreateSurveySchema = z.object({
  areaId: z.string().uuid('รหัสพื้นที่ไม่ถูกต้อง (Invalid area ID)'),
  surveyCode: z.string().min(3, 'รหัสการสำรวจต้องมีอย่างน้อย 3 ตัวอักษร'),
  surveyDate: z.string().datetime({ message: 'วันที่และเวลาสำรวจต้องอยู่ในรูปแบบ ISO 8601 UTC' }),
  droneModel: z.string().max(100).optional().nullable(),
  sensorType: z.string().max(100).optional().nullable(),
  flightAltitudeM: z.number().positive().max(2000).optional().nullable(),
  groundSampleDistanceCm: z.number().positive().max(100).optional().nullable(),
  crsHorizontal: z.string().default('EPSG:4326'),
  crsVertical: z.string().default('EGM96 / WGS84 Ellipsoid'),
});

export const RegisterAssetSchema = z.object({
  assetType: z.enum([
    'orthomosaic',
    'cog_raster',
    'dsm_raster',
    'dtm_raster',
    'point_cloud_las',
    'tiles_3d',
    'geojson_vector',
    'report_pdf',
  ]),
  fileName: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
  mimeType: z.string().min(1),
  checksumSha256: z.string().length(64, 'SHA256 Checksum ต้องมีความยาว 64 ตัวอักษร'),
  boundingBox: GeoJSONPolygonSchema.optional().nullable(),
  resolutionMPerPx: z.number().positive().optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export const TriggerProcessSchema = z.object({
  jobType: z.enum(['photogrammetry_ingest', 'cog_tiling', 'elevation_diff']).default('photogrammetry_ingest'),
  options: z.record(z.any()).optional(),
});

export type CreateSurveyInput = z.infer<typeof CreateSurveySchema>;
export type RegisterAssetInput = z.infer<typeof RegisterAssetSchema>;
export type TriggerProcessInput = z.infer<typeof TriggerProcessSchema>;
