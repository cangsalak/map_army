# GeoMonitor 3D — Drone Export Compatibility & Format Specifications

## 1. ตารางความเข้ากันได้ของระบบควบคุมการบิน (Compatibility Matrix)

| แพลตฟอร์ม / GCS | รุ่นโดรนที่รองรับ | รูปแบบไฟล์ส่งออก | Autopilot Protocol | การตรวจสอบความถูกต้อง | สถานะรองรับ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DJI Pilot 2 / FlightHub 2** | DJI Matrice 350 RTK, M300 RTK, Mavic 3 Enterprise (3E/3T/3M), Matrice 30/30T | `.kmz` (ZIP container บรรจุ `wpmz/template.kml` และ `wpmz/waypoint.kml`) | DJI WPML v1.0 XML | ตรวจสอบ Tag WPML, ActionList, GimbalPitch, Coordinate Datums | **VERIFIED & SUPPORTED** |
| **QGroundControl (QGC)** | PX4 Autopilot, ArduPilot (ArduCopter, ArduPlane, QuadPlane, VTOL) | `.plan` (JSON File) | MAVLink Command Protocol (MAV_CMD) | ตรวจสอบ JSON Schema, MAVLink Item IDs (16, 22, 20), Home Pos | **VERIFIED & SUPPORTED** |
| **Mission Planner / ArduPilot** | Pixhawk, Cube Orange/Blue, SITL Simulators | `.waypoints` / QGC WPL 110 | MAVLink WPL 110 Tab-separated text | ตรวจสอบลำดับ Column (Index, Current, Frame, Command, Param1-4, X, Y, Z, Auto) | **VERIFIED & SUPPORTED** |
| **Generic GIS Review** | ทุกระบบ (QGIS, ArcGIS, Google Earth Pro, Global Mapper) | `.geojson` (FeatureCollection) | GIS Vector Standard (RFC 7946) | WGS84 GeoJSON Schema | **SUPPORTED (Reference Only)** |

---

## 2. ข้อกำหนดทางเทคนิคของ DJI WPML (Waypoint Mapping Language)

ไฟล์ภารกิจโดรนของ DJI รุ่นใหม่ (ตั้งแต่ Mavic 3 Enterprise และ Matrice 30/300/350 เป็นต้นไป) ถูกจัดโครงสร้างเป็น ZIP Archive นามสกุล `.kmz`:

```
mission_export.kmz
└── wpmz/
    ├── template.kml   <-- กำหนดแม่แบบภารกิจ ข้อมูลเซนเซอร์กล้อง และขอบเขต
    └── waypoint.kml   <-- กำหนดพิกัด Waypoints, ความเร็ว, แอ็กชันกล้อง
```

### 2.1 โครงสร้าง `template.kml`
ต้องประกอบด้วย XML Header และ Namespace ของ DJI WPML:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <wpml:createTime>1730000000000</wpml:createTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:takeOffSecurityHeight>30</wpml:takeOffSecurityHeight>
      <wpml:droneInfo>
        <wpml:droneEnumValue>67</wpml:droneEnumValue> <!-- 67 = Mavic 3 Enterprise -->
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
  </Document>
</kml>
```

### 2.2 โครงสร้าง `waypoint.kml`
กำหนดเส้นทางบิน (Folder -> Placemark) พร้อมระดับความสูง `wpml:executeHeight` และแอ็กชันถ่ายภาพ:
```xml
<Placemark>
  <Point>
    <coordinates>101.145000,12.678000</coordinates>
  </Point>
  <wpml:index>0</wpml:index>
  <wpml:executeHeight>100</wpml:executeHeight>
  <wpml:waypointSpeed>10</wpml:waypointSpeed>
  <wpml:waypointHeadingParam>
    <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
  </wpml:waypointHeadingParam>
</Placemark>
```

---

## 3. ข้อกำหนดทางเทคนิคของ QGroundControl Plan (.plan)

ไฟล์ JSON มาตรฐานสำหรับส่งเข้า QGroundControl หรือโปรแกรม Ground Station ทั่วไป:

```json
{
  "fileType": "Plan",
  "version": 1,
  "groundStation": "QGroundControl",
  "geoFence": { "circles": [], "polygons": [], "version": 2 },
  "rallyPoints": { "points": [], "version": 2 },
  "mission": {
    "cruiseSpeed": 12,
    "hoverSpeed": 5,
    "plannedHomePosition": [12.678000, 101.145000, 50],
    "vehicleType": 2,
    "version": 2,
    "items": [
      {
        "autoContinue": true,
        "command": 22,
        "frame": 3,
        "params": [15, 0, 0, null, 12.678, 101.145, 30],
        "type": "SimpleItem"
      },
      {
        "autoContinue": true,
        "command": 16,
        "frame": 3,
        "params": [0, 0, 0, null, 12.679, 101.146, 80],
        "type": "SimpleItem"
      },
      {
        "autoContinue": true,
        "command": 20,
        "frame": 3,
        "params": [0, 0, 0, 0, 0, 0, 0],
        "type": "SimpleItem"
      }
    ]
  }
}
```

---

## 4. ข้อกำหนดความปลอดภัยและการแจ้งเตือน (Safety Disclaimer)

> [!CAUTION]
> **ข้อกำหนดความปลอดภัยก่อนขึ้นบินจริง:**
> 1. การส่งออกไฟล์ภารกิจจาก GeoMonitor 3D **ไม่ได้ทดแทน** การขออนุญาตทำการบินจากสำนักงานการบินพลเรือน (กพท. / CAAT) หรือหน่วยงานความมั่นคงในเขตพื้นที่รับผิดชอบ
> 2. นักบินผู้ควบคุมอากาศยาน (Pilot-in-Command) ต้องตรวจสอบสภาพอากาศ, แนวสายไฟแรงสูง, ความสูงของเครนก่อสร้าง, และความพร้อมของแบตเตอรี่หน้างานจริงทุกครั้ง
> 3. ในกรณีที่ใช้ความสูงแบบ Relative-to-Home พื้นที่บินที่มีเนินเขาชันอาจเกิดความเสี่ยงต่อการชนภูมิประเทศ (CFIT) หากไม่ได้เปิดระบบตรวจจับสิ่งกีดขวาง (Obstacle Avoidance) บนตัวอากาศยาน
