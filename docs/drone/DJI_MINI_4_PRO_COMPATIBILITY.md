# GeoMonitor 3D — รายงานการตรวจสอบความเข้ากันได้ DJI Mini 4 Pro
**เอกสารทางการ:** `docs/drone/DJI_MINI_4_PRO_COMPATIBILITY.md`  
**สถานะการตรวจสอบ:** VERIFIED WITH LIMITATIONS  
**วันที่ตรวจสอบ:** 26 ตุลาคม 2026  
**เป้าหมาย:** วิเคราะห์ขีดความสามารถจริงของอากาศยาน DJI Mini 4 Pro, DJI Mobile SDK V5 (Android), รีโมทคอนโทรล, เฟิร์มแวร์ และแอปพลิเคชัน DJI Fly ก่อนการพัฒนา Adapter  

---

## 1. บทสรุปผู้บริหารและการตรวจสอบความจริง (Reality Check)

| ประเด็นสำคัญ | ข้อเท็จจริงทางเทคนิค (Ground Truth) | ผลกระทบต่อสถาปัตยกรรม GeoMonitor 3D |
| :--- | :--- | :--- |
| **DJI Mobile SDK V5 Support** | DJI เพิ่มการรองรับ Mini 4 Pro ใน **MSDK V5.13.0+ (Android)** | **รองรับการเชื่อมต่อผ่าน Android เท่านั้น** (ไม่มี iOS SDK สำหรับ Mini 4 Pro) |
| **รีโมทคอนโทรลที่รองรับ** | รองรับ **DJI RC-N2** (ต่อสาย USB-C กับโทรศัพท์/แท็บเล็ต Android) | **DJI RC 2 (จอในตัว) ไม่รองรับ** การติดตั้งแอปบุคคลที่สามโดยตรงเนื่องจากระบบปฏิบัติการปิดกั้น (Closed OS) |
| **แอปพลิเคชัน DJI Fly** | **DJI Fly ไม่มีฟังก์ชัน Import ไฟล์ภารกิจภายนอก (.kmz, .kml, .json)** | **ห้ามหลอกผู้ใช้ว่าส่งออกไฟล์ไปเปิดบินใน DJI Fly ได้** ต้องเชื่อมต่อผ่าน Android Companion Bridge เท่านั้น |
| **ระบบพิกัดและ Altitude** | MSDK V5 Waypoint V3 ตีความความสูงสัมพันธ์กับจุด Home (`relative_to_home`) หรือ AMSL | ต้องแปลงความสูงจาก DEM/DSM ของ GeoMonitor 3D ให้เป็น Relative to Home ให้ถูกต้องก่อนส่งให้อากาศยาน |
| **การส่งคำสั่งบินอัตโนมัติ** | ใช้ `WaypointMissionManager` อัปโหลดชุดคำสั่ง (WPML / KMZ package) ไปยังอากาศยานผ่าน MSDK | ต้องมีขั้นตอนขอการยืนยันจากผู้ปฏิบัติงาน (Human-in-the-Loop) ก่อนสั่งเริ่มบิน ห้ามสั่ง Takeoff อัตโนมัติ |

---

## 2. ตารางประเมินความเข้ากันได้แบบละเอียด (Compatibility Matrix)

ระดับสถานะที่ใช้:
- `VERIFIED`: ตรวจสอบยืนยันจากเอกสารทางการและโค้ด API จริงเรียบร้อย
- `VERIFIED_WITH_LIMITATIONS`: รองรับ แต่มีข้อจำกัดด้านฮาร์ดแวร์/เฟิร์มแวร์/รีโมทที่ต้องปฏิบัติตาม
- `NEEDS_DEVICE_TEST`: มี API ใน SDK แต่ต้องทดสอบร่วมกับอากาศยานและเฟิร์มแวร์จริงหน้างาน
- `NOT_SUPPORTED`: ไม่รองรับในระดับฮาร์ดแวร์ เฟิร์มแวร์ หรือนโยบายของ DJI
- `NOT_VERIFIED`: ยังไม่มีหลักฐานทางเทคนิคเพียงพอที่จะยืนยันได้

| ขีดความสามารถ (Capability) | สถานะ (Status) | หลักฐานทางเทคนิค (Technical Evidence) | ข้อกำหนดและข้อจำกัด (Constraints) |
| :--- | :---: | :--- | :--- |
| **1. SDK Initialization** | `VERIFIED` | `DJISDKManager.getInstance().init(...)` ใน MSDK V5 Android | ใช้งานได้เฉพาะระบบปฏิบัติการ Android 9.0+ (API 28+) ต้องลงทะเบียน App Key กับ DJI Developer Portal |
| **2. Aircraft Connection** | `VERIFIED_WITH_LIMITATIONS` | `AircraftKey.KeyConnection` callback ผ่าน USB Accessory | รองรับเฉพาะรีโมท **DJI RC-N2** เท่านั้น **DJI RC 2 (มีจอ) ไม่รองรับ** การรันแอป Third-Party |
| **3. Telemetry Streaming** | `VERIFIED` | `KeyAircraftLocation3D`, `KeyBatteryState`, `KeyCompassHeading` | สตรีมพิกัด ละติจูด, ลองจิจูด, ความสูง, แบตเตอรี่, สัญญาณวิทยุ ได้ที่ความถี่ 1-10 Hz |
| **4. Waypoint Planning (Core)** | `VERIFIED` | Boustrophedon Grid & Waypoint Generator ของ GeoMonitor 3D | คำนวณในระบบ WGS84 แปลงความสูงตามระดับ Elevation ของนิคมฯ มาบตาพุด |
| **5. Mission Upload to Aircraft** | `NEEDS_DEVICE_TEST` | `WaypointMissionManager.getInstance().pushKMZFileToAircraft(...)` | ส่งไฟล์แพ็กเกจภารกิจ KMZ ผ่าน USB/O4 ไปบันทึกในหน่วยความจำของอากาศยาน ต้องทดสอบความเร็วและเสถียรภาพ |
| **6. Mission Execution (Start/Pause/Stop)** | `NEEDS_DEVICE_TEST` | `startMission(...)`, `pauseMission(...)`, `stopMission(...)` | โดรนจะบินตาม Waypoint อัตโนมัติเมื่อสั่ง Start; สามารถสั่ง Pause เพื่อโฮเวอร์ค้างกลางอากาศ และสั่ง RTH ได้ |
| **7. Camera / Gimbal Actions** | `VERIFIED_WITH_LIMITATIONS` | `GimbalKey.KeyGimbalPitch`, `CameraKey.KeyShootPhotoMode` | รองรับการถ่ายภาพเดี่ยวตามระยะทาง (Interval Distance) หรือ Waypoint Action แต่การถ่ายแบบ Smart Oblique ติดข้อจำกัดฮาร์ดแวร์กิมบอลหมุนได้ 90° |
| **8. DJI Fly Mission Import** | `NOT_SUPPORTED` | เอกสารทางการ DJI Fly Application | **DJI Fly ไม่มีเมนู Import ไฟล์ภารกิจ** (KML/KMZ/JSON) สำหรับบุคคลภายนอกอย่างเป็นทางการ |
| **9. Native File Export to Aircraft** | `NOT_SUPPORTED` | สถาปัตยกรรม O4 / DJI Fly | ไม่สามารถดาวน์โหลดไฟล์จากเว็บแล้วก๊อปปี้ลง MicroSD เพื่อให้โดรนอ่านเองได้ ต้องส่งผ่าน MSDK เท่านั้น |
| **10. PX4 / ArduPilot Adapter** | `VERIFIED` | MAVLink v2 & QGroundControl `.plan` JSON Spec | แยกเป็น Adapter อิสระ ไม่แชร์โค้ดหรือ API ข้ามค่าย |

---

## 3. รายละเอียด API ทางการของ DJI Mobile SDK V5 (Android)

จากการตรวจสอบ Source Code และ Reference ของ `Mobile-SDK-Android-V5` (Package: `dji.v5.*`):

### 3.1 Waypoint 3.0 Manager
```kotlin
package dji.v5.manager.aircraft.waypoint3

import dji.v5.common.callback.CommonCallbacks
import dji.v5.common.error.IDJIError

// Singleton Controller
val manager = WaypointMissionManager.getInstance()

// 1. Push KMZ / Wayline Package to Drone
manager.pushKMZFileToAircraft(filePath: String, callback: CommonCallbacks.CompletionCallback)

// 2. Start Mission
manager.startMission(missionFileName: String, waylineIds: MutableList<Int>, callback: CommonCallbacks.CompletionCallback)

// 3. Operational Safety Controls
manager.pauseMission(callback: CommonCallbacks.CompletionCallback)
manager.resumeMission(callback: CommonCallbacks.CompletionCallback)
manager.stopMission(callback: CommonCallbacks.CompletionCallback)

// 4. Execution State Monitoring
manager.addWaypointMissionExecuteStateListener(object : WaypointMissionExecuteStateListener {
    override fun onMissionExecStateUpdate(state: WaypointMissionExecuteState) {
        // IDLE, PREPARING, UPLOADING, EXECUTING, PAUSED, INTERRUPTED, FINISHED
    }
})
```

### 3.2 Aircraft Telemetry ผ่าน KeyManager
```kotlin
package dji.v5.manager.key

import dji.v5.common.callback.KeyListener
import dji.v5.et.create
import dji.v5.et.listen
import dji.v5.keyvalue.key.FlightControllerKey
import dji.v5.keyvalue.value.common.LocationCoordinate3D

// Listen to 3D Coordinates (WGS84 Lat, Lon, Altitude AMSL)
FlightControllerKey.KeyAircraftLocation3D.create().listen(this) { location ->
    val lat = location?.latitude ?: 0.0
    val lon = location?.longitude ?: 0.0
    val altitude = location?.altitude ?: 0.0 // AMSL Meters
}

// Listen to RTK / GPS Health Status
FlightControllerKey.KeyGPSSignalLevel.create().listen(this) { signalLevel ->
    // 0 to 5 Bars
}
```

---

## 4. ข้อกำหนดสถาปัตยกรรมการเชื่อมต่อ (System Workflow)

เนื่องจาก **DJI Fly ไม่รองรับการนำเข้าไฟล์ KML/KMZ เพื่อบินโดยตรง** สถาปัตยกรรมการบินจริงของ GeoMonitor 3D จึงแบ่งออกเป็น 2 แนวทางอย่างโปร่งใส:

```
[GeoMonitor 3D Web UI]
          │
          ├── (1) โหมดส่งออกเพื่อการอ้างอิง (Reference GIS Only)
          │         └── Export: GeoJSON / KML (แสดงผลบน GIS / Google Earth, ห้ามบิน)
          │
          └── (2) โหมดปฏิบัติการบินจริง (Live Drone Operations)
                    └── WebSocket / REST API (เข้ารหัส TLS + Token)
                              │
                    [GeoMonitor Drone Bridge (Android)]
                    ติดตั้งบนโทรศัพท์ Android ที่เสียบสายกับ DJI RC-N2
                              │
                    DJI Mobile SDK V5.13+ API
                              │
                    [DJI Mini 4 Pro Aircraft] (บินอัตโนมัติตามคำสั่งที่ได้รับ)
```

---

## 5. บทสรุปและข้อห้าม (Operational Directives)

1. **ห้ามหลอกผู้ปฏิบัติงาน**: ปุ่มและหน้าจอใน GeoMonitor 3D จะต้องแสดงอย่างชัดเจนว่า *"DJI Fly ไม่รองรับการ Import ไฟล์ภารกิจ หากต้องการบินอัตโนมัติ ต้องเชื่อมต่อผ่าน GeoMonitor Drone Bridge (Android MSDK V5)"*
2. **ห้ามเริ่มบินโดยอัตโนมัติ (No Auto-Takeoff on Upload)**: เมื่ออัปโหลดเส้นทางบินสำเร็จ ระบบจะรายงานสถานะ `MISSION_UPLOADED_READY` และต้องให้ผู้ควบคุมที่หน้างานตรวจสอบความปลอดภัยและกดปุ่มยืนยัน `AUTHORIZE & START MISSION` ด้วยตนเองเท่านั้น
3. **การตัดการทำงานฉุกเฉิน (Emergency Interruption)**: เมื่อเกิดเหตุขัดข้อง ต้องสามารถส่งคำสั่ง `PAUSE` หรือ `RETURN_TO_HOME` ได้ทันที
