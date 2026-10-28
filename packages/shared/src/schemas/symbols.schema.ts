import { z } from 'zod';

export const SymbolCategoryEnum = z.enum([
  'general_locations',
  'offices_facilities',
  'people_teams',
  'vehicles_equipment',
  'medical_emergency',
  'infrastructure',
  'environmental_monitoring',
  'drone_survey',
  'general_graphics',
  'custom_symbols',
]);

export const CreateSymbolSchema = z.object({
  name: z.string().min(2, 'ชื่อสัญลักษณ์ต้องมีความยาวอย่างน้อย 2 ตัวอักษร').max(100),
  description: z.string().max(500).optional().nullable(),
  category: SymbolCategoryEnum.default('custom_symbols'),
  iconKey: z.string().min(1).max(100).default('custom_svg'),
  defaultColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'รหัสสีต้องเป็น HEX 6 หลัก').default('#38bdf8'),
  defaultSize: z.number().min(10).max(128).default(24),
  defaultRotation: z.number().min(0).max(360).default(0),
  tags: z.array(z.string()).default([]),
  svgContent: z
    .string()
    .min(10, 'เนื้อหา SVG สั้นเกินไป')
    .max(50000, 'ขนาด SVG ต้องไม่เกิน 50KB')
    .refine((val) => !/<script/i.test(val) && !/javascript:/i.test(val) && !/on\w+=/i.test(val), {
      message: 'ไฟล์ SVG มีโค้ดสคริปต์ที่ไม่ปลอดภัยและถูกปฏิเสธ (Malicious SVG Content)',
    })
    .optional()
    .nullable(),
});

export const FeatureStyleSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fillColor: z.string().optional(),
  strokeWidth: z.number().min(1).max(20).optional(),
  opacity: z.number().min(0).max(1).optional(),
  size: z.number().min(8).max(128).optional(),
  rotation: z.number().min(0).max(360).optional(),
  iconKey: z.string().optional(),
  svgContent: z.string().optional().nullable(),
  labelText: z.string().max(100).optional(),
  showLabel: z.boolean().optional(),
  labelSize: z.number().min(8).max(32).optional(),
  labelColor: z.string().optional(),
  dashPattern: z.array(z.number()).optional(),
});

export const CreatePlacedFeatureSchema = z.object({
  projectId: z.string().uuid('รูปแบบรหัสโครงการไม่ถูกต้อง'),
  layerId: z.string().uuid('รูปแบบรหัสเลเยอร์ไม่ถูกต้อง'),
  symbolId: z.string().uuid().optional().nullable(),
  featureType: z.enum(['Point', 'LineString', 'Polygon', 'Circle', 'Rectangle', 'Text']),
  name: z.string().min(1).max(200).default('รูปแปลงไม่มีชื่อ'),
  description: z.string().max(1000).optional().nullable(),
  geometry: z.any(), // GeoJSON Geometry (Point, LineString, Polygon)
  style: FeatureStyleSchema.default({}),
  properties: z.record(z.any()).default({}),
});

export const UpdatePlacedFeatureSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  layerId: z.string().uuid().optional(),
  symbolId: z.string().uuid().optional().nullable(),
  geometry: z.any().optional(),
  style: FeatureStyleSchema.optional(),
  properties: z.record(z.any()).optional(),
});

export const ReorderLayersSchema = z.object({
  projectId: z.string().uuid().optional(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      orderIndex: z.number().int().min(0),
    })
  ).optional(),
  orders: z.array(
    z.object({
      id: z.string().uuid(),
      orderIndex: z.number().int().min(0),
    })
  ).optional(),
}).refine((data) => (data.items && data.items.length > 0) || (data.orders && data.orders.length > 0), {
  message: 'ต้องมีรายการ items หรือ orders อย่างน้อย 1 รายการ',
});
