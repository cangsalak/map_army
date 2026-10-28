# GeoMonitor 3D — รายละเอียดรูปแบบการส่งออกภารกิจการบิน (Mission Export Formats Evaluation)
**เอกสารทางการ:** `docs/drone/MISSION_EXPORT_FORMATS.md`  
**สถานะ:** RELEASED & VERIFIED  
**วันที่ประกาศ:** 26 ตุลาคม 2026  

---

## 1. บทสรุปการประเมินรูปแบบการส่งออก (Executive Evaluation Summary)

| รูปแบบการส่งออก (Format) | แพลตฟอร์มเป้าหมาย | ความสามารถในการบินจริง (Flyable) | ความเข้ากันได้กับ DJI Mini 4 Pro | สถานะการตรวจสอบ |
| :--- | :--- | :---: | :---: | :---: |
| **1. Internal JSON (v2.0)** | GeoMonitor 3D Core | ออฟไลน์ / บันทึกระบบ | ใช้ส่งผ่าน Android Bridge | `VERIFIED` |
| **2. Generic GeoJSON (.geojson)** | GIS / Google Earth | **ไม่ใช่ (อ้างอิง GIS เท่านั้น)** | ดูแนวบินบน QGIS/Web | `VERIFIED` |
| **3. DJI Pilot 2 WPML (.kmz)** | M350 RTK, M300, M3E | **บินได้จริงบน DJI Pilot 2** | **ไม่รองรับบน DJI Fly** | `VERIFIED (Enterprise Only)` |
| **4. QGroundControl (.plan)** | PX4 Autopilot | **บินได้จริงบน QGC** | ไม่รองรับ | `VERIFIED` |
| **5. ArduPilot (.waypoints)** | ArduCopter / Mission Planner | **บินได้จริงบน Mission Planner** | ไม่รองรับ | `VERIFIED` |
| **6. Native DJI Fly File Import** | DJI Mini 4 Pro (DJI Fly) | **บินไม่ได้ (ไม่มีฟังก์ชันในแอป)** | `NOT_SUPPORTED` | `NOT_SUPPORTED` |

> [!CAUTION]
> **ข้อกำหนดความปลอดภัยสูงสุด**: แอปพลิเคชัน **DJI Fly ไม่มีเมนู Import ไฟล์ภารกิจ (.kmz, .kml หรือ .json)** จากภายนอก ห้ามหลอกผู้ใช้ว่าการดาวน์โหลดไฟล์ KMZ จะสามารถนำไปเปิดบินบน DJI Fly ได้ การบินภารกิจอัตโนมัติบน DJI Mini 4 Pro ต้องเชื่อมต่อผ่าน **GeoMonitor Drone Bridge (Android MSDK V5)** เท่านั้น

---

## 2. รายละเอียดข้อกำหนดแต่ละฟอร์แมต

### A. Internal Neutral JSON (`.json`)
ใช้สำหรับจัดเก็บและแลกเปลี่ยนข้อมูลโครงสร้างภารกิจฉบับเต็มของ GeoMonitor 3D:
- **Schema Version:** `2.0.0`
- **CRS:** `EPSG:4326 (WGS84)` แนวนอน, `EGM96` แนวตั้ง
- **โครงสร้างข้อมูล:**
  - `metadata`: ID, Name, Target Platform, Aircraft Model, Firmware Profile
  - `crs`: Horizontal CRS, Vertical Datum, Units
  - `homePoint`: `[lon, lat, alt]`
  - `waypoints`: Sequence, Coordinates, Altitudes, Speed, Actions, Gimbal Pitch, Heading
  - `platformCompatibility`: สิทธิ์การบิน, ข้อจำกัด และคำเตือน

### B. Generic GeoJSON Reference (`.geojson`)
- ใช้สำหรับเปิดตรวจสอบแนวสำรวจบน QGIS, ArcGIS หรือ Google Earth Pro
- มีการประทับคำเตือนอย่างชัดเจนใน Feature Properties:
  ```json
  "properties": {
    "isFlightControlPlan": false,
    "warning": "ไฟล์นี้เป็นเพียงเส้นทางอ้างอิง GIS ไม่ใช่ไฟล์คำสั่งการบินสำหรับ Autopilot"
  }
  ```

### C. DJI Pilot 2 WPML Archive (`.kmz`)
- เป็นไฟล์ ZIP Archive ตามมาตรฐาน **DJI OGC KML 2.2 + WPML 1.0.6 Specification**
- ภายในประกอบด้วย:
  1. `wpmz/template.kml`: กำหนดความปลอดภัยสากล, ความเร็วการเปลี่ยนแนวบิน, พฤติกรรมเมื่อสัญญาณขาดหาย (`executeLostAction -> goBack`)
  2. `wpmz/waypoint.kml`: กำหนดจุด Waypoint, ActionGroup ลั่นชัตเตอร์กล้องถ่ายภาพ Orthomosaic, โหมดเลี้ยวโค้ง และองศากิมบอล

### D. QGroundControl Mission Plan (`.plan`)
- โครงสร้าง JSON ตามมาตรฐาน **MAVLink Mission Protocol (PX4)**
- กำหนด Item แรกเป็น Takeoff (`MAV_CMD_NAV_TAKEOFF = 22`)
- Waypoint ปกติใช้ `MAV_CMD_NAV_WAYPOINT = 16` พร้อม `frame: 3 (MAV_FRAME_GLOBAL_RELATIVE_ALT)`
- จุดสิ้นสุดสั่ง `MAV_CMD_NAV_RETURN_TO_LAUNCH = 20`

### E. ArduPilot Mission File (`.waypoints`)
- รูปแบบ Plain Text ตามมาตรฐาน **QGC WPL 110**
- คอลัมน์แท็บ 12 ฟิลด์ รองรับการนำเข้าตรงสู่ซอฟต์แวร์ **Mission Planner** หรือ **QGroundControl**

---

## 3. ขั้นตอนการตรวจสอบก่อน Export (Export Validation Pipeline)

```
[ผู้ใช้เลือก Export Format]
          │
          ▼
1. ตรวจสอบความถูกต้องของ Schema (Zod Schema Validation)
          │
2. ตรวจสอบข้อจำกัดของแพลตฟอร์มเป้าหมาย (Platform Compatibility Gate)
   - หากเลือก DJI Mini 4 Pro แต่พยายามขอ Native Flight File -> แจ้งเตือนข้อจำกัดทันที
          │
3. ตรวจสอบความปลอดภัยทางพิกัดและความสูง (Terrain Clearance Check)
          │
4. ทำการแปลงโครงสร้าง (Serialization ผ่าน Export Adapters)
          │
5. บันทึกประวัติการส่งออก (Audit Log ในตาราง drone_mission_exports)
          │
          ▼
[ดาวน์โหลดไฟล์สำเร็จพร้อมคำแนะนำการใช้งานจริง]
```
