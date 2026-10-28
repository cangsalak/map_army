import { z } from 'zod';

export const GeoJSONPositionSchema = z
  .array(z.number())
  .min(2, 'พิกัดต้องประกอบด้วยลองจิจูดและละติจูด [Longitude, Latitude]')
  .max(3)
  .refine(
    ([lon, lat]) => lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90,
    { message: 'พิกัดทางภูมิศาสตร์อยู่นอกช่วงที่ถูกต้อง (-180..180, -90..90)' }
  );

export const GeoJSONPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z
    .array(z.array(GeoJSONPositionSchema).min(4, 'รูปหลายเหลี่ยม (Polygon) ต้องมีจุดพิกัดอย่างน้อย 4 จุดเพื่อปิดรูป'))
    .min(1, 'ต้องมี Linear Ring อย่างน้อย 1 วง')
    .refine(
      (rings) => {
        // Validate that first and last points match for every ring
        return rings.every((ring) => {
          const first = ring[0];
          const last = ring[ring.length - 1];
          return Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6;
        });
      },
      { message: 'จุดเริ่มต้นและจุดสิ้นสุดของขอบเขต Polygon ต้องเป็นจุดเดียวกัน (Closed Ring)' }
    ),
});

export const CreateAreaSchema = z.object({
  projectId: z.string().uuid('รหัสโครงการไม่ถูกต้อง (Must be valid UUID)').optional(),
  name: z.string().min(3, 'ชื่อพื้นที่ต้องมีความยาวอย่างน้อย 3 ตัวอักษร'),
  description: z.string().max(1000).optional().nullable(),
  boundary: GeoJSONPolygonSchema,
  status: z.enum(['active', 'monitoring', 'archived']).default('active'),
});

export const UpdateAreaSchema = CreateAreaSchema.partial().omit({ projectId: true });

export const AreaQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  search: z.string().optional(),
  status: z.enum(['active', 'monitoring', 'archived']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateAreaInput = z.infer<typeof CreateAreaSchema>;
export type UpdateAreaInput = z.infer<typeof UpdateAreaSchema>;
export type AreaQueryInput = z.infer<typeof AreaQuerySchema>;
