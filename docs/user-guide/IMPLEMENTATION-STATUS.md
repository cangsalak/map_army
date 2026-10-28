# สรุปสถานะความพร้อมของระบบ (Implementation Status & Roadmap)

เอกสารนี้จัดทำขึ้นโดย Senior Software Engineer เพื่อรายงานผลการตรวจสอบ Source Code โครงสร้างระบบจริง และแจกแจงสถานะความพร้อมของแต่ละฟังก์ชันในระบบ **GeoMonitor 3D** ตามความเป็นจริงในโค้ดปัจจุบัน (As-Built Codebase Audit) โดยไม่มีการคาดเดาหรือสมมติฟังก์ชันขึ้นมาเอง

---

## 1. ตารางตรวจสอบสถานะฟังก์ชันใน Source Code ปัจจุบัน

| โมดูล / ฟังก์ชันการทำงาน | สถานะในโค้ด | ไฟล์ที่รองรับในโปรเจกต์ | รายละเอียดความสามารถปัจจุบัน | สิ่งที่ต้องตั้งค่าเพิ่มเติมสำหรับโปรดักชัน |
|---|:---:|---|---|---|
| **Authentication & RBAC** | ✅ พร้อมใช้งาน | `apps/api/src/modules/auth/` | รองรับ JWT Bearer Token, HttpOnly Cookie, Refresh Token, Hash รหัสผ่านด้วย Bcrypt, Role-Based Access Control 4 ระดับ (`admin`, `project_manager`, `analyst`, `viewer`) | เชื่อมต่อ LDAP / Active Directory หรือ Keycloak หากองค์กรต้องการ Single Sign-On (SSO) |
| **Project Management** | ✅ พร้อมใช้งาน | `apps/api/src/modules/projects/`<br>`apps/web/src/app/projects/` | สร้างโครงการ, แก้ไข, ดึงรายการพร้อมรหัส `PROJ-<UUID>`, เลือกโครงการจากแถบ Navbar ส่วนบน | กำหนดเงื่อนไขการแชร์โครงการข้ามฝ่าย (Project Collaboration Permissions) |
| **Managed Area & PostGIS** | ✅ พร้อมใช้งาน | `apps/api/src/modules/areas/`<br>`apps/web/src/app/areas/` | จัดเก็บโพลีกอนรูปแปลงลงใน PostgreSQL PostGIS (EPSG:4326), คำนวณพื้นที่จริงผ่าน `ST_Area(ST_Transform(boundary, 32647))`, แปลงหน่วยเป็น ไร่-งาน-ตร.ว. | ฟังก์ชัน Import/Export ไฟล์ Shapefile (.shp) และ KML โดยตรงผ่าน UI |
| **Drone Survey Management** | ✅ พร้อมใช้งาน | `apps/api/src/modules/surveys/`<br>`apps/web/src/app/surveys/` | บันทึก Metadata การบิน (พิกัด, รุ่นโดรน, ความสูง, GSD, วันที่บิน), จัดเก็บประวัติ Timeline | ฟังก์ชันดึง Metadata อัตโนมัติจากไฟล์ Log การบิน (Flight Log Parser) |
| **Object Storage (MinIO)** | ✅ พร้อมใช้งาน | `apps/api/src/storage/`<br>`docker-compose.yml` | เชื่อมต่อ MinIO S3 API, มี Bucket `geomonitor-assets` และ `geomonitor-reports`, รองรับ Multipart Upload และ Presigned URL | ตั้งค่า Lifecycle Policy สำหรับ Archive ข้อมูลภาพถ่ายดิบเก่าไปยัง Cold Storage |
| **Photogrammetry Ingestion** | ⚠️ พร้อมใช้งานบางส่วน | `apps/worker/src/index.ts` | มี BullMQ Worker Queue (`geomonitor-jobs`) รันกระบวนการ 4 ขั้นตอน (Validation, Tiling, DSM Extraction, Completion) อัปเดตสถานะแบบ Real-time | Worker ปัจจุบันเป็น Ingestion Pipeline จำลอง หากต้องการนำเข้าไฟล์ภาพถ่ายดิบ 1,000+ ภาพเพื่อ Stitching และ Mesh ต้องติดตั้ง **NodeODM / OpenDroneMap Server** ภายนอก |
| **3D CesiumJS Map Viewer** | ✅ พร้อมใช้งาน | `apps/web/src/components/map/CesiumMap.tsx` | ควบคุมมุมกล้อง 3D (Pan, Zoom, Tilt, Orbit), ตัวปรับความโปร่งแสง Layer, ไม้บรรทัดวัดระยะทาง (Distance), เครื่องมือวัดพื้นที่โพลีกอน (Area), เข็มทิศ Compass | นำเข้า 3D Mesh โมเดลอาคารแบบ Textured b3dm เพิ่มเติม |
| **Survey Comparison (Swipe)** | ✅ พร้อมใช้งาน | `apps/web/src/app/analysis/`<br>`apps/web/src/components/map/` | เลือกคู่ Survey $T_1$ (Baseline) และ $T_2$ (Comparison), แสดงแถบเลื่อน Swipe Splitter ซ้าย-ขวา เปรียบเทียบความแตกต่างของภาพออร์โธ | รองรับโหมด Flicker / Difference Image นอกเหนือจาก Split Slider |
| **Change Detection & Volumes** | ✅ พร้อมใช้งาน | `apps/api/src/modules/change-analysis/change.router.ts` | สั่งรันวิเคราะห์เปรียบเทียบความสูง DSM ($\Delta Z$), คำนวณปริมาตรดินขุด (Cut) ดินถม (Fill) และ Net Volume, สร้างรูปแปลงเวกเตอร์ในตาราง `change_features` | โมดูลคำนวณราสเตอร์พิกเซลต่อพิกเซลระดับ GDAL C++ สำหรับไฟล์ GeoTIFF ขนาดยักษ์ (10 GB+) |
| **Analyst Review & Annotations**| ✅ พร้อมใช้งาน | `apps/api/src/modules/change-analysis/change.router.ts` | บันทึกผลการตรวจรูปแปลง (Confirmed, False Positive Shadow, Natural Vegetation, Sensor Noise), บันทึกข้อคิดเห็นลงในตาราง `analyst_annotations` | รองรับการวาดแก้ไขรูปแปลง (Edit Polygon Geometry) บนแผนที่ผ่าน UI |
| **Report Generation** | ✅ พร้อมใช้งาน | `apps/api/src/modules/reports/reports.router.ts`<br>`apps/web/src/app/reports/` | ออกรายงานสรุปสถิติงานดิน, ส่งออกไฟล์ CSV พร้อมรหัส UTF-8 BOM สำหรับ Excel ภาษาไทย, ส่งออกเอกสารจัดหน้าสำหรับพิมพ์หรือแปลงเป็น PDF | เทมเพลตรายงานรูปแบบเอกสารราชการครุฑ หรือแบบฟอร์มเฉพาะทางขององค์กร |
| **Audit Logging** | ✅ พร้อมใช้งาน | `apps/api/src/middlewares/audit.middleware.ts`<br>`apps/web/src/app/audit/` | บันทึกทุกคำสั่งการเปลี่ยนแปลงทรัพยากร (User ID, Action, Resource Type, IP Address, User Agent, Payload Diff) ลงในตาราง `audit_logs` | ระบบส่งต่อบันทึกไปยัง SIEM กลาง (เช่น Splunk หรือ Elastic SIEM) |
| **Dashboard Metrics** | ✅ พร้อมใช้งาน | `apps/api/src/modules/dashboard/`<br>`apps/web/src/app/page.tsx` | สรุปจำนวนโครงการ, พื้นที่ดูแล, รอบการสำรวจ, พื้นที่เปลี่ยนแปลงสะสม และปริมาตรงานดินสุทธิ | กราฟแนวโน้มอัตราการเปลี่ยนแปลงย้อนหลังหลายปี (Time-series Trend Forecasting) |
| **Team & Personnel Operations** | ✅ พร้อมใช้งาน | `apps/api/src/modules/teams/`<br>`apps/web/src/app/operations/map/` | จัดการชุดปฏิบัติการภาคสนาม, สมาชิก, รหัสเรียกขาน Callsign, และสถานะความพร้อม (Active, Standby, Deployed) | เชื่อมโยงระบบจัดการวิทยุสื่อสารภายนอก (Radio Over IP - RoIP) |
| **Team Locations & Base Camps** | ✅ พร้อมใช้งาน | `apps/api/src/modules/team-locations/`<br>`apps/web/src/components/operations/` | บันทึกจุดพิกัดฐานปฏิบัติการ (Base Camp, Staging Area, Checkpoint) จัดเก็บพิกัด WGS84 ลง PostGIS ด้วย GIST Index | รองรับการวาดรูปแปลงขอบเขตฐานหลายเหลี่ยมบนแผนที่ผ่าน UI |
| **Custom Map Layers & Features**| ✅ พร้อมใช้งาน | `apps/api/src/modules/map-layers/` | สร้างเลเยอร์แผนที่, ปรับความทึบแสง (Opacity), เปิด/ปิดการมองเห็น, นำเข้า/ส่งออก GeoJSON FeatureCollection | รองรับการแปลงไฟล์ KML/KMZ แบบ Zip อัตโนมัติ |
| **Movement Simulation (Replay)** | ✅ พร้อมใช้งาน | `apps/api/src/modules/simulations/`<br>`apps/web/src/components/operations/SimulationTimeline.tsx` | เซสชันจำลองการฝึกซ้อม, บันทึกชุดพิกัดตามลำดับเวลา (Timestamped Trackpoints), ควบคุมไทม์ไลน์ Play/Pause/Scrubbing สปีด 1x-10x แบบ Deterministic | เครื่องมือนำเข้าไฟล์ GPX จากการฝึกซ้อมจริง |
| **Authorized Field Updates** | ✅ พร้อมใช้งาน | `apps/api/src/modules/location-updates/` | รับพิกัดจากอุปกรณ์ภาคสนามที่ได้รับอนุญาต, ตรวจสอบความยินยอม (Consent), จำแนกความสดใหม่ Live / Stale / Unavailable, บันทึกการเข้าดูย้อนหลังใน `location_access_logs` | แอพพลิเคชันมือถือเฉพาะกิจ (PWA / Native Field App) สำหรับทีมหน้างาน |
| **Map Symbol Library & Drawing** | ✅ พร้อมใช้งาน | `apps/api/src/modules/symbols/`<br>`apps/web/src/components/operations/SymbolLibraryModal.tsx`<br>`apps/web/src/components/operations/DrawingToolbar.tsx`<br>`apps/web/src/components/operations/FeatureEditorPanel.tsx` | คลังสัญลักษณ์ 10 หมวดหมู่ (map.army style), โหมดวางตำแหน่งพิกัด Cesium 3D, เครื่องมือวาดเวกเตอร์ 6 รูปแบบ (Point, Polyline, Polygon, Rectangle, Circle, Text), Undo/Redo, แผง Symbol Editor, คัดลอก (Duplicate), จัดลำดับชั้นข้อมูล (Layer Reorder), สิทธิ์ Read-Only, กรอง SVG ปลอดภัย (XSS Sanitized), และนำเข้า/ส่งออก GeoJSON พร้อม Style Extension | นำเข้าคลังสัญลักษณ์มาตรฐานทหาร MIL-STD-2525D / APP-6D ในอนาคต |

---


## 2. สิ่งที่ต้องดำเนินการเพิ่มเติมเพื่อเข้าสู่สภาวะ Production (Production Readiness Checklist)

### 1. การเชื่อมต่อระบบ Photogrammetry สำหรับประมวลผลภาพถ่ายดิบ (Raw Drone Images)
- **สถานะปัจจุบัน**: Worker มีกระบวนการ Ingestion, แปลง Tiling, และคำนวณค่า DSM จากไฟล์ GeoTIFF ที่พร้อมใช้งาน
- **สิ่งที่ต้องติดตั้งเพิ่มเติม**:
  - ติดตั้งเซิร์ฟเวอร์ **NodeODM** (หรือ WebODM Cluster) บนเครื่องที่มี GPU (NVIDIA CUDA):
    ```bash
    docker run -d -p 3001:3000 --gpus all opendronemap/nodeodm:gpu
    ```
  - เพิ่ม Environment Variable ใน Worker ให้ยิง REST API ส่งภาพดิบไปประมวลผลที่ NodeODM เมื่อผู้ใช้อัปโหลดไฟล์ Zip ภาพถ่ายโดรน

### 2. การติดตั้ง Offline Tile Server สำหรับระบบเครือข่ายปิด (Air-Gapped Local Imagery)
- **สถานะปัจจุบัน**: ลูกโลก 3D ใช้ Cesium World Imagery ผ่านอินเทอร์เน็ต (หรือ Local Fallback Grid เมื่อออฟไลน์)
- **สิ่งที่ต้องติดตั้งเพิ่มเติม**:
  - ติดตั้ง **TileServer GL** หรือ **GeoServer** ภายในเครื่องเซิร์ฟเวอร์ On-premises
  - โหลดไฟล์แผนที่ภาพถ่ายดาวเทียมออฟไลน์ความละเอียดสูงของประเทศไทย (เช่น MBTiles หรือ GeoTIFF Base Map)
  - กำหนดค่า `NEXT_PUBLIC_LOCAL_TILES_URL=http://localhost:8080/styles/satellite/{z}/{x}/{y}.png` ในไฟล์ `.env`

### 3. การรักษาความปลอดภัยและการเข้ารหัส (Production SSL/TLS & Reverse Proxy)
- **สถานะปัจจุบัน**: ระบบรันผ่าน HTTP พอร์ต 3000 (Web) และ 4000 (API) ในระดับการพัฒนา
- **สิ่งที่ต้องติดตั้งเพิ่มเติม**:
  - ติดตั้ง **Nginx** หรือ **Caddy** ด้านหน้าระบบ เพื่อทำ Reverse Proxy
  - ติดตั้งใบรับรองความปลอดภัย SSL/TLS Certificate (HTTPS พอร์ต 443) ขององค์กร
  - ตั้งค่า `SECURE_COOKIES=true` และ `COOKIE_DOMAIN` ใน `.env`

---

## 3. แผนการทดสอบระบบแบบ End-to-End (E2E Validation Protocol)

ก่อนส่งมอบระบบให้หน่วยงานใช้งานจริง ให้ปฏิบัติตามขั้นตอนการทดสอบ (Verification Protocol) ดังนี้:

1. **ทดสอบความพร้อมระดับโครงสร้าง (Infrastructure Smoke Test)**:
   - ตรวจสอบความสมบูรณ์ของคอนเทนเนอร์ 7 ตัวด้วยคำสั่ง `docker compose ps`
   - ตรวจสอบ Endpoint สุขภาพ: `curl -s http://localhost:4000/api/v1/health | jq .`
2. **ทดสอบการสร้างข้อมูลลำดับชั้น (Hierarchy Test)**:
   - สร้างโครงการใหม่ `PROJ-001`
   - สร้างพื้นที่ดูแล `AREA-001` พร้อมปักหมุดพิกัด 4 จุด (ตรวจสอบว่าพื้นที่คำนวณเป็น ไร่-งาน-ตร.ว. ถูกต้อง)
3. **ทดสอบวงรอบการสำรวจโดรน (Survey Lifecycle Test)**:
   - สร้างรอบการสำรวจ $T_1$ (Baseline) และ $T_2$ (Comparison)
   - สั่งเริ่ม Job ประมวลผลและตรวจสอบว่าสถานะใน Worker Queue ขยับครบ 100%
4. **ทดสอบการวิเคราะห์ความเปลี่ยนแปลง (Change Detection & Cut/Fill Test)**:
   - รันการวิเคราะห์ระหว่าง $T_1$ และ $T_2$
   - ตรวจสอบว่ามีค่า `cutVolumeM3`, `fillVolumeM3` และโพลีกอนเวกเตอร์แสดงบนแผนที่ 3D
5. **ทดสอบการตรวจสอบของนักวิเคราะห์และการออกรายงาน (Review & Reporting Test)**:
   - คลิกเลือกรูปแปลงและยืนยันผลการตรวจเป็น `confirmed_change`
   - สร้างรายงานสรุปผลและดาวน์โหลดไฟล์ CSV
   - เปิดไฟล์ CSV ใน Microsoft Excel และตรวจสอบว่าไม่มีปัญหาตัวอักษรภาษาไทยเพี้ยน
6. **ทดสอบการสำรองและกู้คืน (Backup & Recovery Drill)**:
   - รันคำสั่ง `pg_dump` สำรองข้อมูลลงในโฟลเดอร์ภายนอก
   - ดำเนินการทดสอบกู้คืน (Dry-run Restore) ในฐานข้อมูลทดสอบ

---

## 4. สรุปภาพรวม
โค้ดเบสของโปรเจกต์ **GeoMonitor 3D** มีโครงสร้างสถาปัตยกรรมที่แข็งแกร่ง Type-safe ผ่าน TypeScript ทั้งระบบ จัดเก็บข้อมูลเชิงพื้นที่ด้วย PostGIS แท้ มีระบบความปลอดภัยและ Audit Logging ครบวงจร พร้อมสำหรับการต่อยอดและติดตั้งใช้งานจริงในระดับองค์กร
