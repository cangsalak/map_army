import { z } from 'zod';

// ==========================================
// Teams & Members
// ==========================================

export const CreateTeamSchema = z.object({
  projectId: z.string().uuid('รูปแบบรหัสโครงการไม่ถูกต้อง'),
  name: z.string().min(2, 'ชื่อทีมต้องมีความยาวอย่างน้อย 2 ตัวอักษร').max(100),
  identifier: z
    .string()
    .min(2, 'รหัสประจำทีมต้องมีอย่างน้อย 2 ตัวอักษร')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'รหัสประจำทีมต้องเป็นตัวพิมพ์ใหญ่ ตัวเลข หรือขีดกลาง เช่น SAR-01'),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'standby', 'deployed', 'inactive']).default('standby'),
  teamLeaderId: z.string().uuid().optional().nullable(),
});

export const UpdateTeamSchema = CreateTeamSchema.partial().omit({ projectId: true });

export const AddTeamMemberSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  callsign: z.string().min(2, 'สัญญาณเรียกขาน (Callsign) ต้องมีความยาวอย่างน้อย 2 ตัวอักษร').max(50),
  roleInTeam: z.enum(['leader', 'operator', 'medic', 'scout', 'analyst']).default('operator'),
  isActive: z.boolean().default(true),
});

// ==========================================
// Team Locations & Bases
// ==========================================

export const PointGeometrySchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // Longitude
    z.number().min(-90).max(90),   // Latitude
  ]),
});

export const PolygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))).min(1),
});

export const CreateTeamLocationSchema = z.object({
  projectId: z.string().uuid('รูปแบบรหัสโครงการไม่ถูกต้อง'),
  teamId: z.string().uuid().optional().nullable(),
  name: z.string().min(2, 'ชื่อสถานที่ต้องมีความยาวอย่างน้อย 2 ตัวอักษร').max(150),
  locationType: z.enum([
    'base_camp',
    'staging_area',
    'observation_post',
    'checkpoint',
    'incident_site',
    'work_zone',
  ]),
  geometry: z.union([PointGeometrySchema, PolygonGeometrySchema]),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'temporary', 'inactive']).default('active'),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
});

export const UpdateTeamLocationSchema = CreateTeamLocationSchema.partial().omit({ projectId: true });

// ==========================================
// Map Layers & Features
// ==========================================

export const CreateMapLayerSchema = z.object({
  projectId: z.string().uuid('รูปแบบรหัสโครงการไม่ถูกต้อง'),
  name: z.string().min(2, 'ชื่อเลเยอร์ต้องมีอย่างน้อย 2 ตัวอักษร').max(100),
  layerType: z.enum([
    'personnel',
    'team_locations',
    'simulation_trail',
    'hazard_zone',
    'boundary',
    'custom_vector',
    'imported_kml',
  ]),
  visibility: z.boolean().default(true),
  opacity: z.number().min(0).max(1).default(1.0),
  isEditable: z.boolean().default(true),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'รหัสสีต้องเป็น HEX 6 หลัก เช่น #00ffff').default('#00ffff'),
  permissions: z
    .object({
      canEditRoles: z.array(z.string()).default(['admin', 'project_manager']),
      canViewRoles: z.array(z.string()).default(['admin', 'project_manager', 'analyst', 'viewer']),
    })
    .default({
      canEditRoles: ['admin', 'project_manager'],
      canViewRoles: ['admin', 'project_manager', 'analyst', 'viewer'],
    }),
});

export const UpdateMapLayerSchema = CreateMapLayerSchema.partial().omit({ projectId: true });

export const CreateMapFeatureSchema = z.object({
  featureType: z.enum(['Point', 'LineString', 'Polygon']),
  geometry: z.any(), // GeoJSON Geometry
  properties: z.record(z.any()).default({}),
});

// ==========================================
// Movement Simulation
// ==========================================

export const CreateSimulationSessionSchema = z.object({
  projectId: z.string().uuid('รูปแบบรหัสโครงการไม่ถูกต้อง'),
  name: z.string().min(3, 'ชื่อการจำลองต้องมีความยาวอย่างน้อย 3 ตัวอักษร').max(150),
  description: z.string().max(500).optional().nullable(),
  startTime: z.string().datetime({ message: 'รูปแบบเวลาเริ่มต้นต้องเป็น ISO 8601' }),
  endTime: z.string().datetime({ message: 'รูปแบบเวลาสิ้นสุดต้องเป็น ISO 8601' }),
  speedMultiplier: z.number().min(0.1).max(50).default(1.0),
});

export const AddSimulationParticipantSchema = z.object({
  teamId: z.string().uuid().optional().nullable(),
  name: z.string().min(2).max(100),
  callsign: z.string().min(2).max(50),
  iconSymbol: z.string().default('person'),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#38bdf8'),
});

export const IngestSimulatedPositionsSchema = z.object({
  positions: z.array(
    z.object({
      participantId: z.string().uuid(),
      timestamp: z.string().datetime(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      altitudeM: z.number().default(0),
      headingDeg: z.number().min(0).max(360).default(0),
      speedMps: z.number().min(0).default(0),
      metadata: z.record(z.any()).optional(),
    })
  ).min(1, 'ต้องส่งพิกัดจำลองอย่างน้อย 1 รายการ'),
});

// ==========================================
// Authorized Field Location Updates
// ==========================================

export const IngestLocationUpdateSchema = z.object({
  projectId: z.string().uuid(),
  teamId: z.string().uuid().optional().nullable(),
  deviceIdentifier: z.string().min(3).max(100),
  timestamp: z.string().datetime(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitudeM: z.number().optional().nullable(),
  accuracyM: z.number().min(0).optional().nullable(),
  source: z.enum(['field_app', 'manual_entry', 'vehicle_tracker']).default('field_app'),
  consentConfirmed: z.literal(true, {
    errorMap: () => ({ message: 'ต้องได้รับการยินยอมการแชร์พิกัด (Consent Confirmed) จากผู้ปฏิบัติงาน' }),
  }),
});
