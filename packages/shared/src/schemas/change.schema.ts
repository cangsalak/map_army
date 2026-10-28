import { z } from 'zod';

export const CreateChangeAnalysisSchema = z.object({
  areaId: z.string().uuid(),
  baselineSurveyId: z.string().uuid('ต้องระบุรหัสการสำรวจอ้างอิง (Baseline Survey ID)'),
  comparisonSurveyId: z.string().uuid('ต้องระบุรหัสการสำรวจเปรียบเทียบ (Comparison Survey ID)'),
  analysisType: z.enum(['level1_image', 'level2_elevation', 'combined']).default('combined'),
  signConvention: z
    .string()
    .default('Positive=Fill/ElevationGain, Negative=Cut/Excavation'),
  limitationsNotes: z.string().optional(),
}).refine(
  (data) => data.baselineSurveyId !== data.comparisonSurveyId,
  { message: 'การสำรวจอ้างอิงและการสำรวจเปรียบเทียบต้องไม่ใช่รายการเดียวกัน' }
);

export const ReviewChangeFeatureSchema = z.object({
  status: z.enum([
    'candidate',
    'confirmed_change',
    'false_positive_shadow',
    'false_positive_vegetation',
    'false_positive_misalignment',
  ]),
  notes: z.string().max(1000).optional(),
});

export type CreateChangeAnalysisInput = z.infer<typeof CreateChangeAnalysisSchema>;
export type ReviewChangeFeatureInput = z.infer<typeof ReviewChangeFeatureSchema>;
