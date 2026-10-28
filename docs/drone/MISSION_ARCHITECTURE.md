# GeoMonitor 3D — สถาปัตยกรรมระบบวางแผนการบินโดรนหลายแพลตฟอร์ม (Multi-Platform Drone Mission Architecture)
**เอกสารทางการ:** `docs/drone/MISSION_ARCHITECTURE.md`  
**สถานะ:** RELEASED & IMPLEMENTED  
**วันที่ประกาศ:** 26 ตุลาคม 2026  

---

## 1. วัตถุประสงค์และการออกแบบที่เป็นกลาง (Agnostic Core Principles)

ระบบ **GeoMonitor 3D Multi-Platform Drone Mission Planner** ได้รับการออกแบบภายใต้หลักการ **Agnostic Core, Specialized Adapters** โดยโมเดลภารกิจหลักจะไม่ผูกติดกับผู้ผลิตหรือซอฟต์แวร์ควบคุมการบินรายใดรายหนึ่ง (Vendor-Neutral Core)

```
                    ┌──────────────────────────────────────────────┐
                    │               GeoMonitor 3D UI               │
                    │   (Unified CesiumMap 3D + Planning HUD)      │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │                 Mission Core                 │
                    │   - Route Generator (Boustrophedon / Grid)   │
                    │   - Photogrammetry & GSD Calculator          │
                    │   - Neutral Mission Data Model (v2.0)        │
                    │   - Coordinate Transformation (WGS84 / AGL)  │
                    └───────┬──────────────────────────────┬───────┘
                            │                              │
                            ▼                              ▼
      ┌───────────────────────────────┐  ┌──────────────────────────────────┐
      │   Platform Capability Matrix  │  │    Multi-Axis Mission Validator  │
      │   (Registry & Hardware Rules) │  │    (Safety / Terrain / Battery)  │
      └──────────────┬────────────────┘  └─────────────────┬────────────────┘
                     │                                     │
                     └──────────────────┬──────────────────┘
                                        │ (Validated DroneMissionDTO)
                                        ▼
                     ┌────────────────────────────────────┐
                     │     Platform Adapter Registry      │
                     │  (Interface Contract Enforcement)  │
                     └──────────────────┬─────────────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────────┐
         ▼                              ▼                              ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│ DJI Mini 4 Pro   │           │ DJI Enterprise   │           │ PX4 Autopilot    │
│ Adapter (MSDK V5)│           │ Adapter (WPML)   │           │ Adapter (MAVLink)│
└────────┬─────────┘           └────────┬─────────┘           └────────┬─────────┘
         │ (WebSocket / mTLS)           │ (Native KMZ ZIP)             │ (QGC .plan JSON)
         ▼                              ▼                              ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│ Android Bridge   │           │ DJI Pilot 2      │           │ QGroundControl   │
│ (RC-N2 Device)   │           │ (M350 / M3E)     │           │ / DroneLink      │
└──────────────────┘           └──────────────────┘           └──────────────────┘
```

---

## 2. นิยาม Platform Adapter Interface (TypeScript Contract)

ทุก Adapter ที่จะเชื่อมต่อเข้ากับระบบ GeoMonitor 3D ต้องปฏิบัติตาม Interface Contract ต่อไปนี้อย่างเคร่งครัด:

```typescript
export interface PlatformCapabilities {
  platformId: string;
  platformName: string;
  manufacturer: string;
  supportedMissionTypes: DroneMissionType[];
  supportedAltitudeReferences: AltitudeReference[];
  maxWaypoints: number;
  maxFlightDistanceMeters: number;
  maxAltitudeMeters: number;
  supportsLiveUpload: boolean;
  supportsPauseResume: boolean;
  supportsNativeFileExport: boolean;
  supportedExportFormats: ExportFormat[];
  requiredSdkOrTool: string;
  knownLimitations: string[];
  verificationStatus: 'VERIFIED' | 'VERIFIED_WITH_LIMITATIONS' | 'NEEDS_DEVICE_TEST' | 'NOT_SUPPORTED';
}

export interface AdapterExecutionResult<T = any> {
  status: 'SUCCESS' | 'NOT_SUPPORTED' | 'FAILED' | 'BLOCKED';
  code: string;
  message: string;
  data?: T;
  timestamp: string;
}

export interface IPlatformMissionAdapter {
  readonly platformId: string;
  getCapabilities(): PlatformCapabilities;
  validateMission(mission: DroneMissionDTO): ValidationResult;
  prepareMission(mission: DroneMissionDTO): Promise<AdapterExecutionResult<any>>;
  uploadMission(mission: DroneMissionDTO): Promise<AdapterExecutionResult<{ uploadId: string }>>;
  getUploadStatus(uploadId: string): Promise<AdapterExecutionResult<{ progressPercent: number; state: string }>>;
  startMission(missionId: string): Promise<AdapterExecutionResult>;
  pauseMission(missionId: string): Promise<AdapterExecutionResult>;
  resumeMission(missionId: string): Promise<AdapterExecutionResult>;
  stopMission(missionId: string): Promise<AdapterExecutionResult>;
  getMissionStatus(missionId: string): Promise<AdapterExecutionResult<{ executionState: string; currentWaypoint: number }>>;
  getTelemetry(missionId: string): Promise<AdapterExecutionResult<TelemetryDTO>>;
  exportMission(mission: DroneMissionDTO, format: ExportFormat): Promise<AdapterExecutionResult<{ fileName: string; content: string | Blob }>>;
}
```

---

## 3. กฎเหล็กของระบบ (Invariable Architectural Rules)

1. **ห้ามคืนผลลัพธ์ Success ปลอม (No Mocked Success)**:
   - หากฮาร์ดแวร์หรือเฟิร์มแวร์ยังไม่รองรับเมธอดใด (เช่น การอัปโหลดไฟล์ตรงเข้า DJI Fly) Adapter ต้องคืนค่าสถานะ `NOT_SUPPORTED` พร้อมรหัสข้อผิดพลาดที่ชัดเจน
2. **Capability-Gated Execution**:
   - การเรียกใช้ทุกฟังก์ชัน (Validate, Prepare, Export, Upload, Start) ต้องผ่านการตรวจเช็กใน Capability Matrix ก่อนเสมอ หากระบบปลายทางไม่รองรับ ระบบต้องบล็อกการทำงานทันที
3. **การแยกหน้าที่ระหว่าง Web และ Companion Bridge**:
   - Web Application ทำหน้าที่สร้างแผนที่, ตรวจสอบ GIS และคำนวณ Photogrammetry
   - Android Bridge Application ทำหน้าที่ถือครองสิทธิ์การสื่อสารกับรีโมท RC-N2 ผ่าน USB และส่งข้อมูล Telemetry กลับมาที่ Web ผ่าน Secure WebSocket
