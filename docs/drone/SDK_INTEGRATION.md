# GeoMonitor 3D — เอกสารการเชื่อมต่อ DJI Mobile SDK V5 และ Android Companion App
**เอกสารทางการ:** `docs/drone/SDK_INTEGRATION.md`  
**สถานะ:** RELEASED & IMPLEMENTED  
**วันที่ประกาศ:** 26 ตุลาคม 2026  

---

## 1. ภาพรวมสถาปัตยกรรม (Android Bridge Architecture)

เนื่องจากเบราว์เซอร์ไม่สามารถเข้าถึงพอร์ตฮาร์ดแวร์ USB หรือโปรโตคอล O4 ของ DJI โดยตรงได้ ระบบ GeoMonitor 3D จึงใช้สถาปัตยกรรม **Android Companion Bridge Pattern**:

```
 ┌─────────────────────────────────────────────────────────┐
 │               GeoMonitor 3D Web Application             │
 │          (Mission Planning, GIS 3D, Validation)         │
 └────────────────────────────┬────────────────────────────┘
                              │
               WebSocket / mTLS Secure Bridge
               (Bearer Token + AES-256 GCM)
                              │
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │          GeoMonitor Drone Bridge (Android App)          │
 │             apps/drone-bridge-android/                  │
 │                                                         │
 │  - DJI Mobile SDK V5 (v5.13.0+)                         │
 │  - Android 9.0+ (API Level 28+)                         │
 │  - DJIBridgeApplication: SDK Init & AppKey Registration │
 │  - DJIMissionExecutionService: Waypoint 3.0 Controller  │
 │  - GeoMonitorWebSocketBridge: Bi-directional Telemetry  │
 └────────────────────────────┬────────────────────────────┘
                              │
                  AOA USB Cable (Accessory Mode)
                              │
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │          DJI Remote Controller (DJI RC-N2)              │
 └────────────────────────────┬────────────────────────────┘
                              │
                    DJI O4 Radio Transmission
                              │
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │               DJI Mini 4 Pro Aircraft                   │
 │       (Waypoint 3.0 Execution, Flight Telemetry)        │
 └─────────────────────────────────────────────────────────┘
```

---

## 2. ขั้นตอนการทำงานจริง (SDK Integration Workflow)

```
[1. ตรวจสอบการเชื่อมต่ออุปกรณ์]
    DJISDKManager.getInstance().init(...)
    -> ตรวจสอบการเสียบสาย USB กับรีโมท DJI RC-N2
    -> ตรวจสอบ AircraftKey.KeyConnection == true

[2. ตรวจสอบรุ่นอากาศยานและเฟิร์มแวร์]
    AircraftKey.KeyProductType == DJIMini4Pro
    -> ตรวจสอบเวอร์ชันเฟิร์มแวร์ตรงตามเมทริกซ์ความปลอดภัย (>= v01.00.0800)

[3. แปลงภารกิจและอัปโหลดเข้าหน่วยความจำอากาศยาน]
    WaypointMissionManager.getInstance().pushKMZFileToAircraft(kmzLocalPath, callback)
    -> ตรวจสอบผลลัพธ์ผ่าน CommonCallbacks.CompletionCallback
    -> บันทึกสถานะ: MISSION_UPLOADED_READY

[4. Human-in-the-Loop: ขอการยืนยันจากผู้ปฏิบัติงาน]
    *ห้ามเริ่มบินโดยอัตโนมัติจากการอัปโหลด*
    ผู้ควบคุมที่หน้างานต้องตรวจสอบสภาพอากาศและพื้นที่ จากนั้นกดปุ่ม:
    AUTHORIZE & START MISSION

[5. สั่งเริ่มบินและติดตามการทำงาน]
    WaypointMissionManager.getInstance().startMission(missionFileName, ...)
    -> ส่งพิกัด Telemetry กลับมาแสดงผลบน 3D Map (10 Hz)
    -> รองรับคำสั่งฉุกเฉิน pauseMission() และ stopMission() ทันที
```

---

## 3. รายละเอียดแพ็กเกจซอร์สโค้ด (Android Source Tree)

โครงสร้างโฟลเดอร์ในโปรเจกต์ `apps/drone-bridge-android/`:
- `app/src/main/kotlin/com/geomonitor/dronebridge/DJIBridgeApplication.kt`: จัดการการลงทะเบียน App Key และสถานะการเชื่อมต่อ
- `app/src/main/kotlin/com/geomonitor/dronebridge/service/DJIMissionExecutionService.kt`: คลาสจัดการ `WaypointMissionManager` คำสั่ง Start, Pause, Resume, Stop และ Telemetry KeyListeners
- `app/src/main/kotlin/com/geomonitor/dronebridge/network/GeoMonitorWebSocketBridge.kt`: ตัวกลางสตรีมข้อมูลสองทางระหว่างโทรศัพท์ Android กับ GeoMonitor 3D API Server
