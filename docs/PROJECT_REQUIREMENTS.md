# GeoMonitor 3D — Master Project Requirements Specification

> **เอกสารข้อกำหนดหลัก (Single Source of Truth for Requirements)**  
> รวบรวมข้อกำหนดทั้งหมดของระบบ **GeoMonitor 3D** จาก Phase 1 ถึง Phase 10 ครอบคลุมทั้งฝั่ง Frontend, Backend API, Database, GIS/Photogrammetry Engine และความปลอดภัย

---

## สารบัญ

1. [ภาพรวมระบบและสถาปัตยกรรม](#1-ภาพรวมระบบและสถาปัตยกรรม)
2. [Authentication, Login, Logout และ Protected Routes](#2-authentication-login-logout-และ-protected-routes)
3. [กระบวนการทำงานหลักแบบครบวงจร (End-to-End Workflow)](#3-กระบวนการทำงานหลักแบบครบวงจร-end-to-end-workflow)
4. [ข้อกำหนด Map Bearing (-90° / 270°)](#4-ข้อกำหนด-map-bearing--90--270)
5. [Ground Geometry, Flight Geometry และ Terrain Clamping](#5-ground-geometry-flight-geometry-และ-terrain-clamping)
6. [ระบบพิกัด CRS, AGL, AMSL และ Vertical Reference](#6-ระบบพิกัด-crs-agl-amsl-และ-vertical-reference)
7. [Drone Mission Planning Algorithms (Grid, Crosshatch, Orbit, Corridor)](#7-drone-mission-planning-algorithms-grid-crosshatch-orbit-corridor)
8. [Photogrammetry Parameters & Camera Capture Positions](#8-photogrammetry-parameters--camera-capture-positions)
9. [การคำนวณแผนการบินจากข้อมูลจริง (Real Data Calculation Only)](#9-การคำนวณแผนการบินจากข้อมูลจริง-real-data-calculation-only)
10. [ระบบ Export แผนการบินและความเข้ากันได้ (Export Pipeline & Compatibility)](#10-ระบบ-export-แผนการบินและความเข้ากันได้-export-pipeline--compatibility)
11. [ระบบ Import KML / KMZ (Phase 10)](#11-ระบบ-import-kml--kmz-phase-10)
12. [ความเข้ากันได้กับโดรนและรีโมตคอนโทรลเลอร์ (Hardware Compatibility)](#12-ความเข้ากันได้กับโดรนและรีโมตคอนโทรลเลอร์-hardware-compatibility)
13. [Database Integrity, Multi-tenancy, Authorization และ Security](#13-database-integrity-multi-tenancy-authorization-และ-security)
14. [เกณฑ์การยอมรับและการทดสอบอัตโนมัติ (Automated Tests & Acceptance Criteria)](#14-เกณฑ์การยอมรับและการทดสอบอัตโนมัติ-automated-tests--acceptance-criteria)
15. [ข้อห้ามเรื่อง Mock / Demo Data ใน Production](#15-ข้อห้ามเรื่อง-mock--demo-data-ใน-production)

---

## 1. ภาพรวมระบบและสถาปัตยกรรม

- **เป้าหมายระบบ**: GeoMonitor 3D เป็นระบบปฏิบัติการเชิงพื้นที่ 3 มิติ สำหรับวางแผนและติดตามภารกิจทางอากาศ (Drone Field Operations), บริหารจัดการพื้นที่รับผิดชอบ (Responsibility Area), วางแผนการบินถ่ายภาพสำรวจทางอากาศ (Photogrammetry Flight Planning), นำเข้า/ส่งออกข้อมูล GIS มาตรฐาน, และตรวจจับการเปลี่ยนแปลงภูมิประเทศ 3 มิติ (Cut/Fill Volumetric Analysis)
- **Tech Stack**:
  - **Frontend**: Next.js 15 (App Router), React 19, CesiumJS 3D Globe, Tailwind CSS, Lucide Icons
  - **Backend API**: Node.js, Express.js (TypeScript), PostGIS Spatial Extension, Drizzle ORM
  - **Database**: PostgreSQL 16 พร้อมส่วนขยาย PostGIS 3.4
  - **Worker Tier**: Redis 7, BullMQ, GDAL/WebODM Bridge
  - **Object Storage**: MinIO (S3 Compatible Storage)
  - **Monorepo**: npm workspaces (`apps/web`, `apps/api`, `apps/worker`, `packages/shared`)

---

## 2. Authentication, Login, Logout และ Protected Routes

### 2.1 กลไกการยืนยันตัวตน (Authentication)
- การยืนยันตัวตนใช้ **JWT (JSON Web Token)** บรรจุใน HttpOnly Cookie หรือ Authorization Header (`Bearer <token>`)
- มีระบบ Refresh Token สำหรับต่ออายุ Session อัตโนมัติเมื่อ Access Token หมดอายุ
- รหัสผ่านของผู้ใช้ต้องถูก Hash ด้วย `bcrypt` ก่อนบันทึกลงฐานข้อมูล

### 2.2 การคุ้มครองเส้นทาง (Protected Routes & Navigation Guard)
- หน้าที่ต้องผ่านการเข้าสู่ระบบ: `/dashboard`, `/projects`, `/areas`, `/missions`, `/operations/map`, `/surveys`, `/analysis`, `/reports`, `/admin`
- หากผู้ใช้ที่ยังไม่ล็อกอินพยายามเข้าถึง Protected Routes:
  - Client-side middleware หรือ Navigation Guard ต้อง redirect ไปยัง `/login` พร้อมบันทึก return url
- เมื่อเข้าสู่ระบบสำเร็จ:
  - เส้นทาง Root `/` ต้องเปลี่ยนเส้นทางไปหน้า Dashboard (`/dashboard`)
  - ไม่อนุญาตให้เกิด Redirect Loop หรือการค้างที่หน้าว่าง

### 2.3 การออกจากระบบ (Logout Security)
- การกดปุ่ม Logout ต้อง:
  - เรียก API `/api/v1/auth/logout` ฝั่ง Server เพื่อล้าง/ยกเลิก Session
  - ลบ HttpOnly Cookie และ Local Storage Token
  - ล้าง State ผู้ใช้ใน Auth Context
  - Redirect ผู้ใช้กลับไปยังหน้า `/login` ทันที
  - ป้องกันการกดย้อนกลับ (Browser Back Button) เพื่อดูข้อมูลแคชใน Protected Pages

### 2.4 Server-side Authorization & Multi-tenancy
- ทุก Endpoint ภายใต้ `/api/v1/*` (ยกเว้น `/auth/login` และ `/health`) ต้องตรวจสอบ Token และ Role-based Access Control (RBAC)
- ป้องกันการเข้าถึงข้อมูลข้าม Project หรือข้าม Tenant (IDOR Protection)

---

## 3. กระบวนการทำงานหลักแบบครบวงจร (End-to-End Workflow)

ระบบต้องสนับสนุนลำดับการทำงานต่อเนื่องตามขั้นตอนทางวิศวกรรมจริง:

```
[1. Login เข้าสู่ระบบ]
       │
       ▼
[2. สร้างและเลือกโครงการ (Project)]
       │
       ▼
[3. กำหนดพื้นที่รับผิดชอบ (Responsibility Area / Managed Area)]
       │
       ▼
[4. บันทึกข้อมูล Master Data (เจ้าหน้าที่, อุปกรณ์, โดรน, สัญลักษณ์)]
       │
       ▼
[5. วางแผนปฏิบัติการภาคสนาม (Field Operations Planning)]
       │
       ▼
[6. เปิด Drone Mission Planner]
       │
       ▼
[7. กำหนดขอบเขตพื้นที่สำรวจ (วาดใหม่ หรือ เลือกจาก Responsibility Area หรือ Import KML/KMZ)]
       │
       ▼
[8. ตั้งค่าพารามิเตอร์การบินและกล้อง (Altitude, Overlaps, Speed, GSD, Sensor)]
       │
       ▼
[9. ผู้ใช้กดปุ่ม "คำนวณแนวบิน" (Calculate Flight Plan) ด้วยตนเอง]
       │
       ▼
[10. ตรวจสอบผลการคำนวณและข้อกำหนดความปลอดภัย (Safety Validation)]
       │
       ▼
[11. ส่งออกไฟล์ภารกิจ (Export KML, KMZ/WPML, QGC Plan, MAVLink) ตามความเข้ากันได้]
       │
       ▼
[12. บันทึกประวัติการดำเนินงานและจัดทำรายงานสรุป (Execution Records & Reports)]
```

---

## 4. ข้อกำหนด Map Bearing (-90° / 270°)

### 4.1 ค่าเริ่มต้นและมุมกล้อง
- เมื่อเปิดหน้าแผนที่ 3D ทุกหน้า (`/`, `/operations/map`, `/missions`) มุม Bearing เริ่มต้นต้องเป็น **-90° (หรือ 270° ตามระบบพิกัดทิศของ Cesium heading)**
- การกดปุ่ม **Reset View** หรือดับเบิลคลิกเข็มทิศต้องปรับมุมกล้องกลับมาที่ -90° (Heading 270°)
- การรีเฟรชหน้าเว็บ (Page Reload) ต้องคงมุมตามนโยบายระบบหรือกลับสู่ -90° เมื่อไม่มี Session View บันทึกไว้

### 4.2 การแยก Map Bearing ออกจาก Mission Grid Bearing
- **Map Bearing**: เป็นมุมหมุนของกล้องสังเกตการณ์ (Camera View Heading) เท่านั้น
- **Mission Grid Bearing**: เป็นมุมองศาของแนวบินสำรวจสัมพันธ์กับทิศเหนือจริง (True North 0°–360°)
- **Flight Heading**: เป็นทิศทางหัวโดรนขณะบินตามเส้นทาง
- **ข้อห้าม**: การหมุนแผนที่ (Map Orbit/Rotation) ของผู้ใช้ **ต้องไม่เปลี่ยนพิกัด GIS หรือมุมแนวบินของภารกิจโดยเด็ดขาด**

---

## 5. Ground Geometry, Flight Geometry และ Terrain Clamping

### 5.1 Ground Geometry (รูปทรงบนพื้นผิวภูมิประเทศ)
- ขอบเขตพื้นที่รับผิดชอบ (Responsibility Area), ขอบเขตแปลงที่ดิน, รูปปิด Polygon, เส้นกรอบ และสัญลักษณ์บนพื้น
- ต้องใช้กลไก **Ground Clamping / Terrain Draping**:
  - ใน CesiumJS ต้องกำหนด `classificationType: Cesium.ClassificationType.TERRAIN`
  - Polyline ต้องกำหนด `clampToGround: true`
  - ห้ามกำหนดความสูงลอยคงที่ เช่น `height: 100` สำหรับวัตถุที่ควรอยู่บนพื้นดิน
  - ห้ามกำหนด `Z = 0` แบบเหมารวมหากระดับพื้นดินของภูมิประเทศมีความสูงจากระดับน้ำทะเล (AMSL)

### 5.2 Flight Geometry (รูปทรงทางอากาศ)
- เส้นทางบิน (Flight Lines), จุดนำทาง (Waypoints), และตำแหน่งถ่ายภาพ (Camera Capture Positions)
- ต้องแสดงผลในระดับความสูง 3 มิติตามพิกัด Cartesian ที่คำนวณได้จริง:
  - ต้องไม่ถูกกดลงไปแนบพื้นดิน
  - แปลงพิกัดเป็น 3D Cartesian3: `Cesium.Cartesian3.fromDegrees(lon, lat, targetAltitudeM)`
  - รองรับการแสดงเส้น Drop-line จากจุดบินลงมายังพื้นผิวภูมิประเทศเพื่ออ้างอิงตำแหน่งจริง

---

## 6. ระบบพิกัด CRS, AGL, AMSL และ Vertical Reference

### 6.1 Coordinate Reference Systems (CRS)
- **Map & Display CRS**: WGS84 Geographic Coordinate System (EPSG:4326) ในหน่วยองศาทศนิยม (Decimal Degrees)
- **Spatial Calculations**: การคำนวณระยะทาง พื้นที่ และแนวบิน ต้องคำนวณบนพื้นผิวทรงรี WGS84 ด้วย Geodesic Math (เช่น Haversine, Karney Geodesic, หรือ Projected UTM Zone 47N / 48N)
- **ห้ามเด็ดขาด**: ห้ามคำนวณระยะทางหรือพื้นที่เป็นหน่วยองศาเสมือนเป็นเมตร

### 6.2 Altitude Reference Systems
- **AGL (Above Ground Level)**: ความสูงสัมพันธ์กับพื้นผิวภูมิประเทศใต้ตัวโดรน ณ จุดนั้นๆ (ต้องมี Terrain DEM ข้อมูลความสูงประกอบ)
- **AMSL (Above Mean Sea Level)**: ความสูงสัมบูรณ์เทียบกับระดับน้ำทะเลปานกลาง (WGS84 Ellipsoid / EGM96 Geoid)
- **Relative to Takeoff / Home**: ความสูงสัมพันธ์กับจุดเริ่มต้นขึ้นบิน (ค่าเริ่มต้นของโดรนส่วนใหญ่)
- ทุกไฟล์ส่งออกและข้อมูลภารกิจต้องระบุ `altitudeReference` ไว้อย่างชัดเจน

---

## 7. Drone Mission Planning Algorithms

ระบบต้องคำนวณแผนการบินจากสมการคณิตศาสตร์ภูมิศาสตร์จริง ครอบคลุม 4 รูปแบบ:

### 7.1 Grid Mapping (การบินสำรวจพื้นที่แบบตารางขนาน)
- สร้างเส้นแนวบินขนานกันตามมุม `gridAngleDeg` ภายในขอบเขต Polygon
- ตัดเส้นแนวบินตามขอบเขตพื้นที่จริง (Polygon Clipping)
- คำนวณระยะห่างระหว่างแนวบิน (Line Spacing) ตามค่า Side Overlap และ Sensor FOV
- คำนวณระยะห่างระหว่างจุดถ่ายภาพ (Photo Spacing) ตามค่า Forward Overlap
- สร้างเส้นทางเชื่อมระหว่างแนวบิน (Transition Turn Paths)

### 7.2 Crosshatch Mapping (การบินสำรวจแบบตารางตัดขวางสองทิศทาง)
- สร้างแนวบิน Grid สองชุดตัดกัน (โดยทั่วไปตั้งฉาก 90°)
- ช่วยลดปัญหาจุดอับสายตาและเพิ่มความแม่นยำในการสร้าง 3D Mesh / Point Cloud
- แยกสถิติระยะทาง จำนวนภาพ และเวลาของแต่ละทิศทาง

### 7.3 3D Orbit / Oblique Mapping (การบินวนรอบวัตถุ/จุดสนใจ)
- ให้ผู้ใช้กำหนดจุดศูนย์กลาง POI (Point of Interest), รัศมีวงบิน (Radius), และความสูงแต่ละชั้น
- คำนวณจุดบินวนรอบวงกลม Geodesic พร้อมกำหนดมุมก้มกล้อง (Gimbal Pitch) ให้เล็งเข้าหาจุดกึ่งกลาง POI ตลอดเวลา
- คำนวณจำนวนภาพและระยะห่างเชิงมุมตามความเร็วและช่วงเวลาถ่ายภาพจริง

### 7.4 Corridor Mapping (การบินสำรวจแนวเส้นทางยาว)
- รองรับพื้นที่แนวยาว เช่น ถนน แม่น้ำ แนวกำแพง หรือท่อส่ง
- ให้ผู้ใช้กำหนด Centerline และความกว้างแนวกันชน (Corridor Width)
- ขยายพื้นที่เป็น Buffer Polygon และสร้างแนวบินตามทิศทางของเส้นทาง

---

## 8. Photogrammetry Parameters & Camera Capture Positions

ระบบต้องคำนวณตัวแปรการถ่ายภาพตามหลักการโฟโตแกรมเมตรี:
- **Sensor Width / Height (mm)**, **Focal Length (mm)**, **Image Resolution (Pixels)**
- **Ground Sampling Distance (GSD)**:
  $$\text{GSD} = \frac{\text{Flight Altitude} \times \text{Sensor Dimension}}{\text{Focal Length} \times \text{Image Dimension}} \times 100 \quad (\text{cm/pixel})$$
- **Camera Footprint on Ground**: ขนาดพื้นที่จริงบนพื้นดินที่กล้องบันทึกได้ในหนึ่งภาพ
- **Photo Interval**: คำนวณว่าต้องลั่นชัตเตอร์ทุกๆ กี่เมตร หรือทุกๆ กี่วินาที ตามความเร็วบิน

---

## 9. การคำนวณแผนการบินจากข้อมูลจริง (Real Data Calculation Only)

1. **State Machine ของภารกิจ**:
   - `EMPTY`: เริ่มต้นไม่มีข้อมูลขอบเขตหรือพารามิเตอร์
   - `AREA_DEFINED`: กำหนดรูปแปลงพื้นที่แล้ว แต่ยังไม่มีการคำนวณ
   - `READY_TO_CALCULATE`: ข้อมูลครบถ้วนพร้อมกดคำนวณ
   - `CALCULATING`: อยู่ระหว่างประมวลผลคำนวณแนวบิน
   - `CALCULATED`: คำนวณแนวบินสำเร็จ พร้อมแสดงผลบนแผนที่และอนุญาตให้ Export
   - `OUTDATED`: มีการแก้ไขขอบเขตหรือพารามิเตอร์หลังคำนวณ ต้องกดคำนวณใหม่ก่อน Export
2. **ข้อห้าม**: ห้ามสร้าง Waypoints หรือ Flight Lines อัตโนมัติเมื่อเปิดหน้าหรือเปลี่ยนค่าตัวเลข

---

## 10. ระบบ Export แผนการบินและความเข้ากันได้ (Export Pipeline & Compatibility)

### 10.1 รูปแบบไฟล์ที่รองรับ
1. **DJI Pilot 2 / FlightHub 2 (WPML KMZ)**:
   - บรรจุไฟล์ `wpmz/template.kml` และ `wpmz/waypoint.kml`
   - รองรับ DJI Mavic 3 Enterprise Series, Matrice 30/300/350 RTK
2. **QGroundControl (.plan)**:
   - JSON Structure ตาม MAVLink Mission Protocol (MAV_CMD 16, 22)
   - รองรับ PX4 และ ArduPilot
3. **Mission Planner / ArduPilot (.waypoints)**:
   - ข้อความแยกด้วย Tab ตามมาตรฐาน QGC WPL 110
4. **GIS Vector Format (.kml, .kmz, .geojson)**:
   - สำหรับเปิดดูรูปทรงบน Google Earth, QGIS, ArcGIS (ไม่ใช่คำสั่งบินอัตโนมัติ)

### 10.2 Compatibility Status Classification
- `VERIFIED_IMPORT`: ตรวจสอบโครงสร้างไฟล์และทดสอบนำเข้าในโปรแกรมแล้ว
- `VERIFIED_WITH_LIMITATIONS`: ใช้งานได้โดยมีข้อกำหนดเฉพาะ
- `VISUALIZATION_ONLY`: สำหรับแสดงผลใน GIS ไม่ใช่คำสั่งบิน
- `NEEDS_DEVICE_TEST`: ต้องนำไฟล์ไปทดสอบบนรีโมตหรือโดรนจริง

---

## 11. ระบบ Import KML / KMZ (Phase 10)

### 11.1 คุณสมบัติ UI และการทำงาน
- รองรับไฟล์ `.kml` และ `.kmz` (ZIP) ผ่านการเลือกไฟล์หรือ Drag & Drop
- ตรวจสอบความถูกต้อง Client-side ทันที พร้อมแสดงข้อมูลสถิติ (ขนาด, จำนวน Feature, ชนิด Geometry)
- ให้ผู้ใช้เลือกวัตถุประสงค์ในการนำเข้า (Intent):
  1. *แสดงบนแผนที่เท่านั้น (Visual Layer)*
  2. *นำเข้าเป็นพื้นที่รับผิดชอบ (Responsibility Area)*
  3. *นำเข้าเป็นพื้นที่สำรวจ (Mission Survey Area)*
  4. *นำเข้าเป็นข้อมูลอ้างอิง (GIS Reference)*
- ตรวจจับชื่อซ้ำในโครงการ (Duplicate Detection) และแจ้งเตือนก่อนบันทึก
- รองรับการ Export Layer กลับเป็น KML/KMZ

### 11.2 ความปลอดภัยและการตรวจสอบไฟล์ (Security Enforcement)
- **XXE Prevention**: ปฏิเสธไฟล์ XML ที่มี DTD Entity (`<!ENTITY`, `SYSTEM`, `PUBLIC`)
- **Zip Slip Prevention**: ตรวจสอบ Path ใน ZIP ไม่ให้ออกนอกโฟลเดอร์ปลายทาง
- **Zip Bomb Prevention**: จำกัดขนาดบีบอัดสูงสุด 35MB, ขนาดแตกไฟล์สูงสุด 60MB, จำนวนไฟล์สูงสุด 500 ไฟล์, อัตราส่วนไม่เกิน 100 เท่า
- **Network Isolation**: ปฏิเสธการดาวน์โหลดรูปภาพหรือ URL ภายนอกจากไฟล์โดยอัตโนมัติ

---

## 12. ความเข้ากันได้กับโดรนและรีโมตคอนโทรลเลอร์ (Hardware Compatibility)

- การสร้างไฟล์ส่งออกสำเร็จ **ไม่เท่ากับว่าโดรนทุกลำจะสามารถบินได้ทันที**
- โดรนบางรุ่น (เช่น DJI Mini Series ที่ใช้รีโมตทั่วไป) อาจไม่รองรับการนำเข้าไฟล์ Waypoints ทางตรงผ่านรีโมต โดยจำเป็นต้องใช้ซอฟต์แวร์บุคคลที่สาม (3rd party apps เช่น Litchi) หรือ SDK Bridge
- ระบบต้องแสดงคำเตือนและข้อจำกัดให้ผู้ใช้ทราบอย่างตรงไปตรงมา

---

## 13. Database Integrity, Multi-tenancy, Authorization และ Security

- ข้อมูลภูมิสารสนเทศถูกจัดเก็บใน PostgreSQL + PostGIS ด้วย SRID 4326
- การบันทึกข้อมูลต้องเป็น Database Transaction ป้องกันข้อมูลตกค้างหรือบันทึกไม่ครบ
- มีระบบ Audit Log บันทึกทุกกิจกรรมสำคัญของผู้ใช้ (Login, Create Area, Calculate Mission, Export, Import)
- มีการ Sanitize ข้อมูลอินพุตเพื่อป้องกัน SQL Injection และ Stored XSS

---

## 14. เกณฑ์การยอมรับและการทดสอบอัตโนมัติ (Automated Tests & Acceptance Criteria)

- โค้ดทุกชุดต้องผ่านการทดสอบอัตโนมัติ (Automated Tests) ด้วย Vitest
- ชุดทดสอบต้องครอบคลุม:
  - Auth & RBAC Security
  - Map Bearing -90° Initial & Reset
  - Ground Clamping & Altitude Engine
  - Photogrammetry & Mission Route Planning
  - Export Integrity & Validation Engine
  - KML/KMZ Safe Parser & Roundtrip Export (18 Test Cases)
- ผลการทดสอบ Unit/Integration Tests ต้องผ่าน 100% ก่อนส่งมอบงาน

---

## 15. ข้อห้ามเรื่อง Mock / Demo Data ใน Production

1. ห้ามสร้างฟังก์ชันที่คืนค่าสำเร็จเทียม (Fake Success)
2. ห้ามสร้าง Seed Data จำลองแนวบินใน Production
3. ห้ามใช้ค่าพิกัดคงที่แทนการคำนวณจริง
4. ห้ามแสดงสถานะว่าทดสอบผ่านหากยังไม่ได้รันคำสั่งจริง
