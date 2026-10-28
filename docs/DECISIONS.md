# GeoMonitor 3D — Architecture Decision Records (ADRs)

> **บันทึกการตัดสินใจทางสถาปัตยกรรม (Architecture Decision Records)**  
> **กฎบังคับ**: ห้ามเปลี่ยนแปลงการตัดสินใจที่มีผลกระทบสูง (High Impact) โดยไม่บันทึกเหตุผล บริบท และผลกระทบลงในเอกสารนี้ก่อน

---

## สารบัญ ADRs

- [ADR-001: การเลือก CesiumJS เป็น 3D Geospatial Map Engine](#adr-001-การเลือก-cesiumjs-เป็น-3d-geospatial-map-engine)
- [ADR-002: การกำหนดมาตรฐาน Map Bearing ที่ -90° (Heading 270°)](#adr-002-การกำหนดมาตรฐาน-map-bearing-ที่--90-heading-270)
- [ADR-003: สถาปัตยกรรมการแยก Ground Geometry ออกจาก Flight Geometry](#adr-003-สถาปัตยกรรมการแยก-ground-geometry-ออกจาก-flight-geometry)
- [ADR-004: การจัดการระบบอ้างอิงระดับความสูง (Altitude Reference: AGL vs AMSL)](#adr-004-การจัดการระบบอ้างอิงระดับความสูง-altitude-reference-agl-vs-amsl)
- [ADR-005: รูปแบบไฟล์ที่รองรับในระบบ Export แผนการบินโดรน](#adr-005-รูปแบบไฟล์ที่รองรับในระบบ-export-แผนการบินโดรน)
- [ADR-006: สถาปัตยกรรมความปลอดภัยในการนำเข้าไฟล์ KML/KMZ (Safe In-Memory Parser)](#adr-006-สถาปัตยกรรมความปลอดภัยในการนำเข้าไฟล์-kmlkmz-safe-in-memory-parser)
- [ADR-007: กลยุทธ์การจำแนกความเข้ากันได้ของอุปกรณ์โดรนและรีโมตคอนโทรล](#adr-007-กลยุทธ์การจำแนกความเข้ากันได้ของอุปกรณ์โดรนและรีโมตคอนโทรล)

---

## ADR-001: การเลือก CesiumJS เป็น 3D Geospatial Map Engine

- **สถานะ**: ACCEPTED
- **วันที่**: 2026-10-25
- **บริบท**:
  - ระบบ GeoMonitor 3D จำเป็นต้องแสดงผลข้อมูลภูมิประเทศ 3 มิติ (3D Terrain & DEM), โมเดลสิ่งปลูกสร้าง, เมชภาพถ่ายทางอากาศ (3D Mesh / Point Cloud), เส้นทางบินโดรน และการวิเคราะห์ปริมาตรการตัด/ถมดิน (Cut/Fill Volumetric Analysis)
  - ตัวเลือกที่พิจารณา: Mapbox GL JS, Leaflet, Three.js (สร้างเอง), CesiumJS
- **การตัดสินใจ**:
  - เลือก **CesiumJS** เป็น Core 3D Geospatial Engine ของทั้งระบบ
  - ใช้ `packages/shared` ในการคำนวณสูตรคณิตศาสตร์เชิงพื้นที่ WGS84 Geodesic เพื่อไม่ให้ผูกติดกับ WebGL Canvas เพียงอย่างเดียว
- **เหตุผล**:
  1. CesiumJS มีการรองรับ 3D Tiles มาตรฐาน OGC อย่างสมบูรณ์แบบ
  2. รองรับ WGS84 Ellipsoid และระบบพิกัดสากลโดยกำเนิด
  3. มีฟังก์ชัน Ground Clamping (`ClassificationType.TERRAIN`) ที่ทำงานได้มีประสิทธิภาพบน GPU
- **ผลกระทบ**:
  - ต้องจัดการ SSR (Server-Side Rendering) ของ Next.js ด้วย `dynamic(..., { ssr: false })`
  - ต้องตั้งค่า Asset Base URL (`/cesium`) ใน Web Client

---

## ADR-002: การกำหนดมาตรฐาน Map Bearing ที่ -90° (Heading 270°)

- **สถานะ**: ACCEPTED
- **วันที่**: 2026-10-26
- **บริบท**:
  - ระบบเดิมพบปัญหา Camera View มีมุมหมุนประมาณ -46° เมื่อเริ่มต้น ทำให้ผู้ปฏิบัติงานสับสนทิศทางและไม่ตรงกับข้อกำหนดทางยุทธวิธีของระบบ
  - ต้องการให้มุมกล้องเริ่มต้นหันไปในทิศทาง -90° อย่างคงที่
- **การตัดสินใจ**:
  - กำหนดค่าคงที่กลาง `MAP_BEARING` ใน `packages/shared/src/constants/map-bearing.ts`:
    - `SIGNED_DEG = -90` (มุมเครื่องหมายลบตามความต้องการระบบ)
    - `CESIUM_DEG = 270` (มุม Heading ของ CesiumJS ในช่วง 0°–360° ซึ่ง $-90^\circ \equiv 270^\circ$)
  - ทุกจุดที่เรียก `flyTo`, `setView` หรือ Reset Camera ต้องอ้างอิงจาก `MAP_BEARING.CESIUM_DEG`
  - การหมุนแผนที่ของผู้ใช้ (Map Orbit) ต้องเป็นอิสระ และ**ห้ามเขียนทับหรือเปลี่ยนพิกัด GIS และมุมของ Mission Grid Bearing**
- **ผลกระทบ**:
  - มุมมองแผนที่เมื่อเปิดและรีเซ็ตจะเป็น -90° เสมอ
  - แก้ไขปัญหาเข็มทิศและมุมมองกล้องคลาดเคลื่อนอย่างถาวร

---

## ADR-003: สถาปัตยกรรมการแยก Ground Geometry ออกจาก Flight Geometry

- **สถานะ**: ACCEPTED
- **วันที่**: 2026-10-26
- **บริบท**:
  - ในระบบเดิม รูปแปลงพื้นที่ (Polygon) และเส้นทางบินโดรน (Flight Path) บางครั้งแสดงผลผิดพลาด โดยรูปแปลงลอยอยู่เหนือพื้น หรือเส้นทางบินถูกกดจมลงไปบนพื้นดิน
- **การตัดสินใจ**:
  - แยกชนิดของ Geometry ในเอนจินการแสดงผลเป็น 2 ประเภทอย่างเด็ดขาด:
    1. **Ground Geometry**:
       - ครอบคลุม: Responsibility Area, Polygon ขอบเขตสำรวจ, เส้นแบ่งแปลงที่ดิน, สัญลักษณ์บนพื้น
       - การตั้งค่า: `classificationType: Cesium.ClassificationType.TERRAIN`, `clampToGround: true`, ไม่กำหนดความสูง `height` แบบคงที่
    2. **Flight Geometry**:
       - ครอบคลุม: Flight Path, Waypoints, Camera Capture Positions, Drop Lines
       - การตั้งค่า: `clampToGround: false`, คำนวณเป็นพิกัด 3D Cartesian3 ที่ความสูงจริง (`targetAltitudeM`)
- **ผลกระทบ**:
  - รูปแปลงพื้นที่แนบสนิทกับผิวภูมิประเทศตามความสูงจริงของ Terrain
  - เส้นทางบินลอยอยู่ในระดับความสูงที่ปลอดภัยตามพารามิเตอร์ของภารกิจ

---

## ADR-004: การจัดการระบบอ้างอิงระดับความสูง (Altitude Reference: AGL vs AMSL)

- **สถานะ**: ACCEPTED
- **วันที่**: 2026-10-26
- **บริบท**:
  - การบินโดรนมีระดับความสูงอ้างอิง 3 แบบหลัก: AGL (เทียบพื้นดิน), AMSL (เทียบระดับน้ำทะเล), และ Relative to Home (เทียบจุดขึ้นบิน)
  - การผสมปนเปความสูงทำให้เกิดความเสี่ยงต่อการชนสิ่งกีดขวางหรืออุบัติเหตุทางการบิน
- **การตัดสินใจ**:
  - กำหนดค่าเริ่มต้นของระบบเป็น **Relative to Home (จุดขึ้นบิน = 0 เมตร)** ซึ่งปลอดภัยที่สุดสำหรับโดรนสำรวจทั่วไป
  - หากเลือก **AGL**: ระบบต้องมีข้อมูลความสูงภูมิประเทศ (Terrain DEM) ที่เชื่อถือได้ หากไม่มีข้อมูลเพียงพอ ระบบจะแจ้งเตือนคำนวณความสูงสัมพัทธ์โดยประมาณ
  - หากเลือก **AMSL**: ระบบต้องคำนวณพิกัดระดับความสูงจริงโดยบวกค่า Terrain Elevation ณ จุดขึ้นบินเข้ากับความสูงเป้าหมาย
  - ต้องบันทึก `altitudeReference` กำกับในทุกไฟล์ส่งออกและฐานข้อมูล
- **ผลกระทบ**:
  - ป้องกันการบินชนเขาหรือภูมิประเทศที่มีความชัน
  - สอดคล้องกับมาตรฐานความปลอดภัยของกรมการบินพลเรือนและมาตรฐานสากล

---

## ADR-005: รูปแบบไฟล์ที่รองรับในระบบ Export แผนการบินโดรน

- **สถานะ**: ACCEPTED
- **วันที่**: 2026-10-26
- **บริบท**:
  - ผู้ใช้ต้องการนำแผนการบินไปใช้งานจริงกับโดรนหลายยี่ห้อและหลายแพลตฟอร์ม แต่ละแพลตฟอร์มมีข้อกำหนดของรูปแบบไฟล์ที่แตกต่างกันโดยสิ้นเชิง
- **การตัดสินใจ**:
  - รองรับ 4 มาตรฐานหลัก:
    1. **DJI WPML (Waypoint Mapping Language)**: ไฟล์ `.kmz` (ZIP บรรจุ `wpmz/template.kml` และ `wpmz/waypoint.kml`) สำหรับ DJI Mavic 3 Enterprise, Matrice 30/300/350 RTK ผ่าน DJI Pilot 2
    2. **QGroundControl Plan**: ไฟล์ `.plan` (JSON ตาม MAVLink Mission Protocol) สำหรับ PX4 และ ArduPilot
    3. **MAVLink WPL 110**: ไฟล์ `.waypoints` (ข้อความคั่นด้วย Tab) สำหรับ Mission Planner
    4. **Standard GIS**: ไฟล์ `.kml`, `.kmz`, `.geojson` สำหรับ Google Earth, QGIS, ArcGIS
  - ทุกประเภท Export ต้องผ่านการคำนวณจริง และต้องไม่สร้างไฟล์จากผลคำนวณที่ `OUTDATED`
- **ผลกระทบ**:
  - ครอบคลุมทั้งฝั่งโดรนอุตสาหกรรม (DJI Enterprise), โดรนโอเพนซอร์ส (PX4/ArduPilot), และระบบ GIS แผนที่ทั่วไป

---

## ADR-006: สถาปัตยกรรมความปลอดภัยในการนำเข้าไฟล์ KML/KMZ (Safe In-Memory Parser)

- **สถานะ**: ACCEPTED
- **วันที่**: 2026-10-27
- **บริบท**:
  - การเปิดให้ผู้ใช้อัปโหลดไฟล์ KML และ KMZ (ZIP) เสี่ยงต่อช่องโหว่ XML External Entity (XXE), Zip Slip (Path Traversal), Zip Bomb (Decompression Bomb) และ Stored XSS
- **การตัดสินใจ**:
  - พัฒนา Safe Parser บน `packages/shared/src/gis/kml-kmz-parser.ts`:
    1. **XXE Protection**: สแกนห้ามมี `<!ENTITY`, `SYSTEM`, `PUBLIC` ก่อนนำเข้า DOM Parser
    2. **Zip Slip Protection**: ตรวจสอบ path ของทุกไฟล์ใน KMZ ป้องกันอักขระ `../` หรือการแตกไฟล์ออกนอกขอบเขต
    3. **Zip Bomb Limits**: บังคับจำกัดขนาดบีบอัดสูงสุด 35MB, ขนาดหลังแตกไฟล์สูงสุด 60MB, จำนวนไฟล์สูงสุด 500 ไฟล์, อัตราส่วนไม่เกิน 100 เท่า
    4. **Zero Outbound Network Fetching**: ปฏิเสธการยิง HTTP/HTTPS ดาวน์โหลดภาพภายนอกโดยอัตโนมัติ สกัดเฉพาะ Local Icons ภายใน KMZ แล้วแปลงเป็น Data URLs
  - การบันทึกพิกัดลง PostGIS ใช้ `ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(...), 4326))` เพื่อความเข้ากันได้กับ Typmod 2D พร้อมเก็บค่าความสูงไว้ใน Properties
- **ผลกระทบ**:
  - ปิดช่องโหว่ความปลอดภัยระดับร้ายแรง (Critical Vulnerabilities) ทั้งหมด
  - ระบบทำงานได้รวดเร็วและปลอดภัยทั้งบน Client Browser และ Server Backend

---

## ADR-007: กลยุทธ์การจำแนกความเข้ากันได้ของอุปกรณ์โดรนและรีโมตคอนโทรล

- **สถานะ**: ACCEPTED
- **วันที่**: 2026-10-27
- **บริบท**:
  - โดรนระดับผู้บริโภค (Consumer Drones เช่น DJI Mini 4 Pro, Mini 3) เมื่อใช้งานกับรีโมต DJI RC-N2 หรือ DJI RC 2 ที่ไม่มีแอป DJI Pilot 2 จะไม่สามารถนำเข้าไฟล์ Waypoints ทางตรงผ่านรีโมตได้
- **การตัดสินใจ**:
  - กำหนดสถานะความเข้ากันได้ (Compatibility Status) อย่างโปร่งใส:
    - **Enterprise Models (Mavic 3E, Matrice 350 RTK)**: `VERIFIED_IMPORT` (ผ่าน DJI Pilot 2)
    - **Consumer Models (Mini 4 Pro)**: `VERIFIED_WITH_LIMITATIONS` (ต้องใช้แอปบุคคลที่สาม เช่น Litchi หรือ SDK Bridge ในการส่ง Waypoints)
    - **Generic GIS File**: `VISUALIZATION_ONLY` (สำหรับดูบนแผนที่ ไม่ใช่คำสั่งบินอัตโนมัติ)
  - ห้ามอ้างว่าโดรนทุกลำสามารถบินอัตโนมัติได้หากอุปกรณ์ปลายทางไม่รองรับ
- **ผลกระทบ**:
  - ผู้ใช้งานและนักบินเข้าใจข้อจำกัดของอุปกรณ์ตนเองอย่างถูกต้อง ป้องกันความผิดพลาดหน้างาน

---

## ADR-008: สถาปัตยกรรม Shared Map 2D-First & Ground-Level Camera Initialization

- **สถานะ**: ACCEPTED
- **วันที่**: 2026-10-28
- **บริบท**:
  - ก่อนหน้านี้เมื่อเปิดหน้าใหม่หรือรีโหลดหน้าเว็บ กล้อง 3D อาจลอยเคว้งคว้างกลางอวกาศ (Altitude > 30,000 กม.) หรือหันไปยังตำแหน่งพิกัดที่ไม่เกี่ยวข้อง
  - มี Race Condition จากการเรียก `navigator.geolocation.getCurrentPosition()` ที่ทำงานแบบอะซิงโครนัสแล้วสั่ง `flyTo` ทับพิกัดพื้นที่ปฏิบัติการจริงหลังจากโหลดเสร็จ 1-2 วินาที
  - แต่ละโมดูล (Command Center, Drone Mission Planner, Operations Field GIS) มีการจัดการ Camera State แยกจากกัน ทำให้มุมมองกล้องหลุดเมื่อสลับหน้า
- **การตัดสินใจ**:
  1. **สถาปัตยกรรม 2D-First แบบรวมศูนย์**:
     - กำหนดให้ทุกโมดูลเริ่มต้นด้วยโหมด 2D Top-Down Nadir (`sceneMode: Cesium.SceneMode.SCENE2D`, `pitch: -90°`, `heading: 270° / -90°`) เป็นค่าเริ่มต้น
     - พัฒนาไลบรารีคำนวณตำแหน่งกล้อง `packages/shared/src/gis/camera-controller.ts` ประกอบด้วยฟังก์ชัน:
       - `computeBoundingBox`: คำนวณ Bounding Box ของพื้นที่รูปปิด
       - `calculate2DGroundAltitude`: คำนวณความสูงกล้อง 2D ที่เหมาะสมกับขนาดพื้นที่และ Viewport พร้อม Padding 25% ป้องกันขอบล้น
       - `getInitial2DCameraTarget`: กำหนดเป้าหมายกล้องตามลำดับความสำคัญ (Survey Polygon > Selected Area > First Project Area > Default Center `100.5018, 13.7563`)
       - `validateCameraState`: ตรวจสอบความถูกต้องของพิกัดก่อน Restore State ป้องกันพิกัดผิดเพี้ยน
  2. **Passive Geolocation**:
     - เปลี่ยนการตรวจจับ GPS ของอุปกรณ์เมื่อโหลดหน้าให้เป็นแบบ Passive โดยบันทึกเฉพาะค่าลง `userGps` State เพื่อรอให้ผู้ใช้กดปุ่ม "ตำแหน่งของฉัน" อย่างชัดเจน และห้ามสั่ง `camera.flyTo` เขียนทับพื้นที่ปฏิบัติการโดยอัตโนมัติ
  3. **Event-Driven 2D/3D Mode Transition**:
     - ใช้ `viewer.scene.morphComplete` ในการดักจับจังหวะที่การแปลง Scene Mode เสร็จสมบูรณ์ เพื่อตั้งพิกัดกล้องให้อยู่ตรงกึ่งกลางพื้นที่เดิมอย่างแม่นยำ ไม่หลุดพิกัดไป `(0, 0)` หรืออวกาศ
  4. **Shared Map Context**:
     - สร้าง `SharedMapProvider` (`apps/web/src/lib/map-context.tsx`) เพื่อแชร์ Camera State และ Area Selection ข้าม Route
- **ผลกระทบ**:
  - แผนที่เปิดขึ้นมาอยู่ในระดับสายตาภาคพื้นดิน (Ground Level) ครอบคลุมพื้นที่ปฏิบัติการจริงทันที
  - กล้องไม่ลอยเคว้งคว้างหรือเปลี่ยนตำแหน่งโดยไม่ตั้งใจ
  - คงมาตรฐาน Map Bearing (-90° / 270°) และระบบพิกัด WGS84 / EPSG:4326 ตามข้อกำหนดแม่บท

