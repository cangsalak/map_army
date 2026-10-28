import { z } from 'zod';

export const GenerateReportSchema = z.object({
  areaId: z.string().uuid(),
  changeAnalysisId: z.string().uuid().optional(),
  title: z.string().min(3, 'หัวข้อรายงานต้องมีอย่างน้อย 3 ตัวอักษร'),
  reportType: z.enum(['executive_summary', 'technical_detailed', 'earthwork_volume']).default('executive_summary'),
  format: z.enum(['pdf', 'csv', 'geojson']).default('pdf'),
  analystNotes: z.string().max(2000).optional(),
});

export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;
