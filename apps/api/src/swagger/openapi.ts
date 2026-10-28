export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'GeoMonitor 3D REST API',
    version: '1.0.0',
    description: 'API เอกสารระบบติดตามและวิเคราะห์การเปลี่ยนแปลงพื้นที่ 3 มิติจากภาพถ่ายโดรน (GeoMonitor 3D)',
    contact: {
      name: 'GeoMonitor 3D Engineering Team',
      email: 'support@geomonitor.local',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Gateway',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'ข้อมูลไม่ถูกต้อง' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'ตรวจเช็คสถานะการทำงานของระบบ (Health Check)',
        tags: ['System'],
        responses: {
          '200': { description: 'ระบบพร้อมทำงานปกติ' },
          '503': { description: 'ระบบฐานข้อมูลหรือเซอร์วิสขัดข้อง' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'เข้าสู่ระบบ (User Login)',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'analyst@geomonitor.local' },
                  password: { type: 'string', example: 'Password123!' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'เข้าสู่ระบบสำเร็จ คืนค่า JWT Token' },
          '401': { description: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
        },
      },
    },
    '/areas': {
      get: {
        summary: 'ดึงรายการพื้นที่ที่อยู่ในการดูแล (Get Managed Areas)',
        tags: ['Areas'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'รายการพื้นที่พร้อมขอบเขต GeoJSON Polygon' },
        },
      },
      post: {
        summary: 'สร้างพื้นที่ดูแลใหม่ (Create Managed Area with PostGIS)',
        tags: ['Areas'],
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'บันทึกพื้นที่สำเร็จ' },
        },
      },
    },
    '/surveys/{id}': {
      get: {
        summary: 'ดึงข้อมูลรอบการบินสำรวจและไฟล์ผลลัพธ์ (Get Drone Survey)',
        tags: ['Drone Surveys'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'รายละเอียดรอบบินสำรวจและ Deliverables' },
        },
      },
    },
    '/areas/{areaId}/change-analyses': {
      get: {
        summary: 'ดึงประวัติการวิเคราะห์การเปลี่ยนแปลงและปริมาตรขุดถมของพื้นที่ (List Change Analyses)',
        tags: ['Change Detection'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'areaId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'รายการผลการวิเคราะห์การเปลี่ยนแปลงทั้งหมดในพื้นที่' },
          '400': { description: 'รหัสพื้นที่ไม่ถูกต้องตามรูปแบบ UUID' },
          '404': { description: 'ไม่พบพื้นที่ที่ระบุ' },
        },
      },
    },
    '/change-analyses/{id}': {
      get: {
        summary: 'ดึงผลการวิเคราะห์การเปลี่ยนแปลงและปริมาตรขุดถม (Get Change Analysis)',
        tags: ['Change Detection'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'ผลการวิเคราะห์ Cut/Fill Volume และ GeoJSON Change Polygons' },
        },
      },
    },
    '/teams': {
      get: {
        summary: 'ดึงรายการทีมปฏิบัติการภาคสนาม (Get Field Teams)',
        tags: ['Operations - Teams'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'standby', 'deployed', 'inactive'] } },
        ],
        responses: {
          '200': { description: 'รายการทีมปฏิบัติการภาคสนามพร้อมพิกัดล่าสุด' },
        },
      },
      post: {
        summary: 'สร้างทีมปฏิบัติการภาคสนามใหม่ (Create Team)',
        tags: ['Operations - Teams'],
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'สร้างทีมสำเร็จ' },
        },
      },
    },
    '/locations': {
      get: {
        summary: 'ดึงพิกัดสถานที่และฐานปฏิบัติการ (Get Team Locations & Base Camps)',
        tags: ['Operations - Locations'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'bbox', in: 'query', description: 'minLng,minLat,maxLng,maxLat', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'รายการสถานที่พร้อม PostGIS GeoJSON' },
        },
      },
      post: {
        summary: 'บันทึกสถานที่หรือฐานปฏิบัติการใหม่ (Register Location)',
        tags: ['Operations - Locations'],
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'บันทึกสถานที่สำเร็จ' },
        },
      },
    },
    '/layers': {
      get: {
        summary: 'ดึงรายการเลเยอร์แผนที่ (Get Map Layers)',
        tags: ['Operations - Map Layers'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'รายการเลเยอร์แผนที่' },
        },
      },
      post: {
        summary: 'สร้างเลเยอร์แผนที่ใหม่ (Create Map Layer)',
        tags: ['Operations - Map Layers'],
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'สร้างเลเยอร์สำเร็จ' },
        },
      },
    },
    '/simulations': {
      get: {
        summary: 'ดึงรายการรอบการจำลองการเคลื่อนที่ (Get Simulation Sessions)',
        tags: ['Operations - Simulation'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'รายการรอบการจำลองการฝึกซ้อม' },
        },
      },
      post: {
        summary: 'สร้างรอบการจำลองการเคลื่อนที่ใหม่ (Create Simulation Session)',
        tags: ['Operations - Simulation'],
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'สร้างรอบการจำลองสำเร็จ' },
        },
      },
    },
    '/simulations/{id}/timeline': {
      get: {
        summary: 'ดึงชุดพิกัดตามลำดับเวลาสำหรับการเล่นย้อนหลัง (Get Deterministic Timeline Trackpoints)',
        tags: ['Operations - Simulation'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'ชุดพิกัดและเส้นทางจำลอง' },
        },
      },
    },
    '/location-updates': {
      post: {
        summary: 'รับข้อมูลพิกัดจากทีมภาคสนามที่ได้รับอนุญาต (Ingest Authorized Location Update)',
        tags: ['Operations - Location Updates'],
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'บันทึกพิกัดสำเร็จ' },
          '400': { description: 'พิกัดหรือข้อมูลไม่ถูกต้อง หรือไม่ได้รับความยินยอม' },
        },
      },
    },
    '/location-updates/latest': {
      get: {
        summary: 'ดึงพิกัดล่าสุดของทีมภาคสนาม (Get Latest Team Positions)',
        tags: ['Operations - Location Updates'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'พิกัดล่าสุดพร้อมสถานะความสดใหม่ Live/Stale/Unavailable' },
        },
      },
    },
  },
};

