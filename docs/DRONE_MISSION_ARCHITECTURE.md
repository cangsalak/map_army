# GeoMonitor 3D — Drone Mission Architecture & Technical Specification

## 1. ภาพรวมสถาปัตยกรรม (System Architecture)

ระบบ Drone Mission Planner ได้รับการออกแบบตามหลัก **Separation of Concerns (SoC)**, **Adapter Pattern** และ **Vendor-Neutral Data Abstraction** เพื่อให้สามารถวางแผนภารกิจการบินโดรนได้แม่นยำ ปลอดภัย และส่งออกไฟล์คำสั่งภารกิจไปยัง Ground Control Station (GCS) ของผู้ผลิตแต่ละรายได้อย่างถูกต้อง

```
+----------------------------------------------------------------------------------------------------+
|                                     GeoMonitor 3D Client (Web)                                     |
|  - Mission Drawing & Polygon Editor (CesiumJS 3D / 2D)                                             |
|  - Route Configuration, Grid Spacing, Speed, Altitude Reference (AGL / AMSL / Relative)            |
|  - Photogrammetry Camera Estimator (GSD, Forward/Side Overlap, Battery Margin)                     |
|  - Multi-Axis Mission Validation Panel (Pass / Warning / Blocked)                                  |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼ REST API / JSON
+----------------------------------------------------------------------------------------------------+
|                                      Backend Mission Service                                       |
|  - Mission CRUD, Versioning & Audit Logs                                                           |
|  - Route Generation Engine (Boustrophedon Grid, Turn Strategy, Corridor Mapping)                   |
|  - Terrain Elevation Sampler (DSM/DTM Extraction)                                                  |
|  - Mission Validation Engine (Geometry, Altitude Datum, Device Constraints)                        |
|  - Vendor Export Adapters:                                                                         |
|      ├── DJI WPML Adapter (KMZ template.kml / waypoint.kml)                                        |
|      ├── QGroundControl Plan Adapter (JSON MAVLink v2 Items)                                       |
|      └── Generic GIS GeoJSON Adapter (Flight Path Reference Only)                                  |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
+----------------------------------------------------------------------------------------------------+
|                                   PostgreSQL 16 + PostGIS Storage                                  |
|  - drone_missions (id, project_id, name, type, flight_parameters, validation_status)                |
|  - drone_mission_waypoints (id, mission_id, sequence, lon, lat, altitude, speed, action)           |
|  - drone_mission_exports (id, mission_id, format, target_device, file_payload, created_by)         |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Universal Drone Mission Model (โมเดลภารกิจมาตรฐานกลาง)

เพื่อไม่ให้โมเดลผูกติดกับผู้ผลิตใดรายหนึ่ง GeoMonitor 3D นิยามโมเดลกลางใน `@geomonitor/shared`:

### 2.1 Mission Attributes
- `id`: UUID ของภารกิจ
- `projectId`: รหัสโครงการที่เป็นเจ้าของ
- `name`: ชื่อภารกิจการบิน (เช่น "สำรวจภูมิประเทศมาบตาพุดรอบประจำเดือน")
- `missionType`:
  - `grid_survey`: การบินแบบตะแกรงเส้นตรงสำหรับทำภาพถ่ายทางอากาศ (Orthophoto)
  - `crosshatch_survey`: การบินตัดกันสองทิศทาง (90 องศา) สำหรับสร้างโมเดล 3D Mesh
  - `corridor_mapping`: การบินตามแนวเส้นทางแคบยาว เช่น ถนน แนวท่อส่งก๊าซ
  - `waypoint_mission`: การบินตามพิกัดจุดนำทางที่กำหนดเอง
  - `orbit_poi`: การบินวนรอบวัตถุเป้าหมาย (Point of Interest)
- `surveyArea`: GeoJSON Polygon ขอบเขตการบิน
- `homePoint`: พิกัดจุดขึ้นบินและลงจอดฉุกเฉิน `[longitude, latitude, elevation]`
- `altitudeReference`:
  - `relative_to_home`: อ้างอิงจุดขึ้นบิน ($H=0$)
  - `agl`: เหนือผิวดินจริง (ต้องการข้อมูล Terrain)
  - `amsl`: เหนือระดับน้ำทะเลปานกลาง (EGM96 Geoid)
- `flightAltitudeMeters`: ความสูงเป้าหมายของการบิน
- `flightSpeedMps`: ความเร็วในการบินเดินทาง (เมตร/วินาที)
- `finishAction`: การกระทำเมื่อจบภารกิจ (`return_to_home`, `land_at_last_waypoint`, `hover`)

### 2.2 Photogrammetry Camera Parameters
- `sensorWidthMm`: ความกว้างเซนเซอร์กล้อง (มม.) เช่น 17.3 มม. (Micro 4/3) หรือ 35.9 มม. (Full-frame)
- `sensorHeightMm`: ความสูงเซนเซอร์กล้อง (มม.)
- `focalLengthMm`: ความยาวโฟกัสเลนส์ (มม.)
- `imageWidthPx`: ความละเอียดภาพแนวกว้าง (Pixels)
- `imageHeightPx`: ความละเอียดภาพแนวสูง (Pixels)
- `forwardOverlapPercent`: อัตราการซ้อนทับภาพในแนวบิน (ปกติ 70% - 80%)
- `sideOverlapPercent`: อัตราการซ้อนทับภาพข้ามแนวบิน (ปกติ 60% - 75%)

---

## 3. Route Generation Engine (ขั้นตอนการคำนวณแนวบิน)

### 3.1 Ground Sampling Distance (GSD)
ระยะห่างระหว่างจุดภาพบนพื้นดิน ($GSD$) คำนวณจากความสูงการบิน ($H$) ความยาวโฟกัส ($F$) และขนาดพิกเซล ($P_x$):
$$GSD = \frac{H \times S_w}{F \times I_w} \times 100 \quad (\text{cm/pixel})$$

### 3.2 Flight Line Spacing (ระยะห่างแนวบิน)
ระยะห่างระหว่างแนวบินสองแนว ($W_{side}$) และระยะลั่นชัตเตอร์ ($W_{forward}$) คำนวณจากอัตราซ้อนทับ ($Overlap$):
$$W_{side} = \text{Ground Coverage Width} \times (1 - \text{SideOverlap})$$
$$W_{forward} = \text{Ground Coverage Height} \times (1 - \text{FrontOverlap})$$

### 3.3 Boustrophedon Grid Generator Algorithm
1. รับขอบเขต Polygon และมุมทิศทางแนวบิน (Grid Angle $\theta$)
2. ทำการหมุนแกนพิกัด (Coordinate Rotation) ตามมุม $-\theta$ เพื่อแปลงพื้นที่ให้อยู่ในแกนนอน
3. คำนวณแนวตัด (Scanlines) ขนานแกน $X$ โดยมีระยะห่างตาม $W_{side}$
4. หาจุดตัดระหว่าง Scanlines กับเส้นรอบรูป Polygon (Line-Polygon Intersections)
5. เรียงจุดตัดแบบสลับทิศทาง (Boustrophedon / S-Pattern) เพื่อลดระยะการเลี้ยว
6. หมุนพิกัดกลับสู่แกนเดิมตามมุม $\theta$ และเชื่อมต่อ Waypoint เลี้ยว
7. ตรวจสอบว่า Waypoint ทั้งหมดอยู่ในขอบเขตปลอดภัย
