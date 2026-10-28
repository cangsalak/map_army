# GeoMonitor 3D — Drone Mission Planner Feasibility & Target Ecosystem Audit

## 1. บทนำและวัตถุประสงค์
เอกสารนี้จัดทำขึ้นเพื่อสำรวจ ตรวจสอบขีดความสามารถที่มีอยู่จริงของระบบ **GeoMonitor 3D (Enterprise Geospatial Command Center)** ข้อจำกัดทางสถาปัตยกรรม และวิเคราะห์การเชื่อมต่อกับระบบอากาศยานไร้คนขับ (UAV/Drone Target Ecosystems) ตามข้อกำหนด Phase 1 เพื่อเตรียมความพร้อมในการพัฒนาโมดูล **Drone Mission Planner & Flight Plan Export Integration** อย่างถูกต้องตามหลักวิศวกรรมการบินและระบบสารสนเทศภูมิศาสตร์ (GIS)

---

## 2. การสำรวจระบบ GeoMonitor 3D ที่มีอยู่จริง

| ส่วนประกอบระบบ | สถานะปัจจุบันในระบบ | ขีดความสามารถที่มีอยู่ | ข้อจำกัดและสิ่งที่ต้องพัฒนาเพิ่ม |
| :--- | :--- | :--- | :--- |
| **1. Map Engine & CRS** | CesiumJS 1.119+ / Next.js 15 App Router | รองรับ 3D Globe และ 2D Orthographic Morphing, WGS84 Geographic CRS (EPSG:4326), Web Mercator (EPSG:3857), UTM Zone 47N projection math | จำเป็นต้องแยกความสูง (Altitude References: AGL, AMSL, Relative-to-Home) ออกจากกันอย่างเข้มงวด |
| **2. Terrain & Elevation Data** | Cesium World Terrain & Local DSM/DTM Rasters | มี 3D Terrain Sampling API (`viewer.scene.globe.getHeight`) และเลเยอร์ DSM/DTM ในระบบสำรวจ | ข้อมูลความสูงภายนอกอาจไม่ครอบคลุมแบบ Real-time ทุกพื้นที่ ต้องมี Fallback และ Validation ห้ามเคลม AGL Terrain Following หากไม่มีข้อมูลความสูงความละเอียดสูง |
| **3. GIS Drawing & Vector Math** | `@geomonitor/web/src/lib/gis-engine.ts` | Chamberlain-Duquette Spherical Polygon Area, Great-Circle Haversine Geodesic Distance, Polygon Ring generation | ขาด Grid Transect Route Generator สำหรับการบินสำรวจแบบ Photogrammetry (Boustrophedon path) |
| **4. Database & Storage** | PostgreSQL 16 + PostGIS 3.4 (Drizzle ORM) | ตาราง `projects`, `managed_areas`, `drone_surveys`, `survey_assets`, `map_layers`, `placed_map_features`, `teams`, `team_locations` | ต้องเพิ่ม Entity: `drone_missions`, `drone_mission_waypoints`, `drone_profiles` และ `drone_mission_exports` เพื่อจัดเก็บแผนการบินและประวัติ |
| **5. Authentication & Authorization** | JWT Auth + Role-Based Access Control (RBAC) | บทบาท: `admin`, `project_manager`, `analyst`, `viewer` ตรวจสอบผ่าน middleware | แผนการบินระดับปฏิบัติการ (Flight Plan) ต้องจำกัดสิทธิ์แก้ไขเฉพาะ `admin` และ `project_manager` ขณะที่ `analyst`/`viewer` มีสิทธิ์อ่านหรือจำลอง |
| **6. Audit & Compliance** | ตาราง `audit_logs` ใน PostgreSQL | บันทึกการกระทำของผู้ใช้ (User Action, Resource Type, Payload Diff, Timestamp) | ต้องบันทึกประวัติการ Export Mission และพารามิเตอร์การบินเข้า Audit Trail ทุกครั้ง เพื่อความปลอดภัยในการบิน |

---

## 3. การวิเคราะห์ Drone Target Ecosystems & Mission Protocols

**ข้อกำหนดสำคัญยิ่ง:** ห้ามถือว่า KML, KMZ, GeoJSON, MAVLink หรือ Shapefile เป็นไฟล์ภารกิจที่โดรนทุกลำสามารถนำเข้าแล้วบินได้ทันที แต่ละผู้ผลิตและ Ground Control Station (GCS) มีโปรโตคอลและโครงสร้างข้อมูลเฉพาะตัว:

```
+-------------------------------------------------------------------------+
|                  GeoMonitor 3D Universal Mission Model                  |
|  (Waypoints, Reference Datum, Speed, Gimbal, Actions, Photogrammetry)   |
+-------------------------------------------------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
+-----------------------+                       +-----------------------+
|  DJI Pilot 2 / WPML   |                       | QGroundControl Plan   |
|   Mission Adapter     |                       |   (MAVLink v2 / PX4 / |
| (template.kml / .kmz) |                       |    ArduPilot Format)  |
+-----------------------+                       +-----------------------+
            |                                               |
            v                                               v
• DJI Matrice 300/350 RTK                       • PX4 Autopilot
• DJI Mavic 3 Enterprise (3E/3T)                • ArduPilot (ArduCopter/Plane)
• DJI Dock 1 / Dock 2                           • QGroundControl / Mission Planner
```

### 3.1 DJI Enterprise WPML (Waypoint Mapping Language)
- **อุปกรณ์เป้าหมาย:** DJI Matrice 350 RTK, Matrice 300 RTK, Mavic 3 Enterprise Series (M3E, M3T, M3M), DJI Matrice 30 / 30T
- **Ground Control Station:** DJI Pilot 2, DJI FlightHub 2
- **โครงสร้างไฟล์:** บรรจุในไฟล์ `.kmz` (ZIP container) ประกอบด้วย:
  - `wpmz/template.kml`: กฎการสร้างภารกิจ, รูปแบบการบิน (Grid / Waypoint), ข้อมูลกล้องและการคำนวณ Overlap
  - `wpmz/waypoint.kml`: ลำดับ Waypoint จริง, พิกัด `coordinates` (Lon, Lat, Alt), ทิศทางหัวโดรน (`droneYaw`), การเอียงกิมบอล (`gimbalPitch`), แอ็กชันถ่ายภาพ (`actionList`)
- **Vertical Datum:** รองรับ `EGM96` (AMSL) หรือ `relativeToStartPoint` (Relative AGL)
- **ข้อควรระวัง:** โดรน DJI ไม่รองรับไฟล์ `.geojson` หรือ `.kml` ธรรมดาในการรัน Mission อัตโนมัติ ต้องเป็น WPML ตามสเปกของ DJI เท่านั้น

### 3.2 QGroundControl Plan (.plan)
- **อุปกรณ์เป้าหมาย:** โดรนที่ใช้ Flight Controller ตระกูล **PX4 Autopilot** หรือ **ArduPilot**
- **Ground Control Station:** QGroundControl (QGC), Mission Planner, Auterion Mission Control
- **โครงสร้างไฟล์:** JSON Object มี Schema ตาม QGC Plan Specification:
  - `fileType`: `"Plan"`
  - `version`: `1`
  - `groundStation`: `"QGroundControl"`
  - `mission`: Object ประกอบด้วย `cruiseSpeed`, `hoverSpeed`, `plannedHomePosition`, และอาร์เรย์ `items`
  - `items`: คำสั่ง MAVLink Command เช่น `MAV_CMD_NAV_WAYPOINT` (16), `MAV_CMD_NAV_TAKEOFF` (22), `MAV_CMD_NAV_RETURN_TO_LAUNCH` (20), `MAV_CMD_DO_SET_CAM_TRIGG_DIST` (206)
- **Vertical Datum:** MAV_FRAME (`MAV_FRAME_GLOBAL_RELATIVE_ALT` = 3 หรือ `MAV_FRAME_GLOBAL` = 0)

### 3.3 MAVLink Waypoint Protocol (.waypoints / WPL 110)
- **อุปกรณ์เป้าหมาย:** ArduPilot / Pixhawk Systems
- **รูปแบบไฟล์:** Text-based tab-delimited file ที่ขึ้นต้นด้วย `QGC WPL 110` รองรับการโหลดตรงเข้า Mission Planner / MAVProxy

### 3.4 GIS Reference / Review Export (GeoJSON / KML)
- สำหรับนำเข้าโปรแกรม GIS เช่น QGIS, ArcGIS, Google Earth Pro เพื่อตรวจสอบแนวบิน
- **คำเตือนความปลอดภัย:** ระบบต้องระบุชัดเจนว่า *"ไฟล์นี้เป็นเพียงเส้นทางอ้างอิง GIS ไม่ใช่ไฟล์คำสั่งการบินสำหรับ Autopilot"*

---

## 4. ความสูงอ้างอิง (Vertical Datum & Altitude Reference Matrix)

การสับสนเรื่องความสูงเป็นสาเหตุอันดับ 1 ของอุบัติเหตุโดรนชนภูมิประเทศ GeoMonitor 3D ต้องแยกความสูงออกเป็น 3 ประเภทอย่างเด็ดขาด:

1. **Relative-to-Home (ความสูงเทียบจุดขึ้นบิน):**
   - ความสูง $H_{rel} = 0$ เมตร ณ จุด Takeoff / Home Point
   - เป็นค่าเริ่มต้นที่ปลอดภัยที่สุดสำหรับพื้นที่ราบหรือไซต์งานก่อสร้างที่ไม่มีข้อมูล Digital Elevation Model (DEM)
2. **Above Ground Level (AGL - ความสูงเหนือผิวดิน):**
   - ต้องใช้โมเดลความสูงผิวดิน (DSM/DTM) ของ GeoMonitor 3D ในการ Sampling ตลอดแนวบิน
   - หากจุดใดไม่มีข้อมูลความสูง หรือความละเอียดไม่เพียงพอ ระบบต้องปฏิเสธการบินแบบ Terrain Following
3. **Above Mean Sea Level (AMSL - ความสูงเหนือระดับน้ำทะเลปานกลาง):**
   - อ้างอิง WGS84 Geoid (EGM96) สำหรับการบินข้ามภูเขาหรือพื้นที่ขนาดใหญ่

---

## 5. สรุปผลการตรวจสอบความเป็นไปได้ (Feasibility Conclusion)
- **สถานะ:** **FEASIBLE (เป็นไปได้อย่างสมบูรณ์)**
- **แนวทางสถาปัตยกรรม:**
  1. สร้าง **Universal Mission Model** ใน `@geomonitor/shared` เพื่อรองรับข้อมูลภารกิจกลางที่ไม่ผูกมัดกับยี่ห้อใด
  2. พัฒนา **Grid Transect Route Generator** ใน GIS Engine เพื่อคำนวณแนวบินสำรวจ Boustrophedon ตัดขอบเขต Polygon พร้อมคำนวณ Photogrammetry (GSD, Overlap)
  3. พัฒนา **Mission Validation Engine** แบ่งระดับผลการตรวจเป็น `PASS`, `WARNING`, `BLOCKED`, `NOT_VERIFIED`
  4. สร้าง **Export Adapters** แยกอิสระ:
     - `DJIWPMLAdapter`: ส่งออก KMZ/WPML สำหรับ DJI Pilot 2 & Matrice 350/Mavic 3E
     - `QGCPlanAdapter`: ส่งออก `.plan` JSON สำหรับ QGroundControl & PX4/ArduPilot
     - `GenericGISAdapter`: ส่งออก GeoJSON สำหรับตรวจสอบใน GIS
  5. พัฒนาหน้าจอ **Drone Mission Planner** บน Next.js 15 + CesiumJS 3D Globe พร้อม Bottom Timeline และแผง Mission Configuration
