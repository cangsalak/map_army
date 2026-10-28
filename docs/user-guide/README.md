# คู่มือการใช้งานระบบ GeoMonitor 3D (User & Technical Operations Guide)

ยินดีต้อนรับสู่คู่มือการติดตั้ง การตั้งค่า และการใช้งานระบบ **GeoMonitor 3D** — แพลตฟอร์มตรวจติดตามการเปลี่ยนแปลงทางภูมิสารสนเทศ 3 มิติจากภาพถ่ายโดรนระดับองค์กร (On-Premises Drone Mapping & Change Detection Platform)

เอกสารชุดนี้จัดทำขึ้นสำหรับผู้ดูแลระบบ (DevOps/System Administrator), ผู้จัดการโครงการ (Project Manager), นักบินสำรวจโดรน (Drone Pilot/Operator) และนักวิเคราะห์ภูมิสารสนเทศ (GIS Analyst) เพื่อให้สามารถติดตั้งระบบและปฏิบัติงานได้จริงทีละขั้นตอน (Step-by-Step) ตั้งแต่ระดับโครงสร้างพื้นฐานจนถึงการวิเคราะห์ปริมาตรงานดิน

---

## 🗺️ แผนผังและลำดับการอ่านคู่มือ (Sequential Reading Roadmap)

```mermaid
graph TD
    subgraph Phase 1: การเตรียมตัวและติดตั้ง
        M00[00. ภาพรวมระบบ] --> M01[01. สิ่งที่ต้องเตรียม]
        M01 --> M02[02. การติดตั้งระบบ On-premises]
        M02 --> M03[03. การตั้งค่า Environment Variables]
        M03 --> M04[04. การเริ่มระบบและตรวจสอบสถานะ]
    end

    subgraph Phase 2: การจัดการโครงการและข้อมูลสำรวจ
        M04 --> M05[05. การเข้าสู่ระบบและจัดการผู้ใช้]
        M05 --> M06[06. การสร้างโครงการ]
        M06 --> M07[07. การสร้างพื้นที่รับผิดชอบ]
        M07 --> M08[08. การนำเข้าภาพถ่ายโดรน]
        M08 --> M09[09. การประมวลผล Photogrammetry]
    end

    subgraph Phase 3: การวิเคราะห์ 3 มิติและตรวจจับความเปลี่ยนแปลง
        M09 --> M10[10. การดูแผนที่ 3 มิติ CesiumJS]
        M10 --> M11[11. การจัดการประวัติการบินและเปรียบเทียบ]
        M11 --> M12[12. การตรวจจับความเปลี่ยนแปลงและคำนวณปริมาตร]
        M12 --> M13[13. การตรวจสอบผลและบันทึกข้อคิดเห็น]
        M13 --> M14[14. การสร้างและดาวน์โหลดรายงาน]
    end

    subgraph Phase 4: การบำรุงรักษาและการกู้คืนระบบ
        M14 --> M15[15. การแก้ไขปัญหาที่พบบ่อย]
        M15 --> M16[16. การสำรองและกู้คืนข้อมูล]
        M16 --> M17[17. คำถามที่พบบ่อย FAQ]
        M17 --> MStatus[IMPLEMENTATION-STATUS: สถานะระบบจริง]
    end
```

---

## 📚 สารบัญคู่มือ (Table of Contents)

| ลำดับ | ชื่อเอกสาร | กลุ่มผู้ใช้งานหลัก | วัตถุประสงค์และสาระสำคัญ |
|:---:|---|---|---|
| **00** | [00-overview.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/00-overview.md) | ทุกกลุ่ม | ภาพรวมสถาปัตยกรรม 5 ชั้น, ขีดความสามารถ และระบบกำหนดสิทธิ์ RBAC |
| **01** | [01-prerequisites.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/01-prerequisites.md) | DevOps / Admin | สเปกฮาร์ดแวร์, ระบบปฏิบัติการ, พอร์ตเน็ตเวิร์ก และเครื่องมือที่ต้องติดตั้ง |
| **02** | [02-installation.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/02-installation.md) | DevOps / Admin | การติดตั้งแพ็กเกจ Monorepo, รัน Docker Compose และเตรียม PostGIS |
| **03** | [03-configuration.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/03-configuration.md) | DevOps / Admin | การตั้งค่าตัวแปรสภาพแวดล้อม (`.env`), คีย์ความลับ และการเชื่อมต่อ MinIO |
| **04** | [04-start-system.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/04-start-system.md) | DevOps / Admin | คำสั่งเริ่มระบบ, การทดสอบ Health Check (`/health`) และการดู Logs |
| **05** | [05-login-and-users.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/05-login-and-users.md) | ทุกกลุ่ม / Admin | การเข้าสู่ระบบด้วย JWT, บัญชีทดสอบเริ่มต้น และการจัดการผู้ใช้ใน `/admin` |
| **06** | [06-create-project.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/06-create-project.md) | Project Manager | การสร้างโครงการใหม่ การกำหนดรหัส `PROJ-<UUID>` และการเปลี่ยนโครงการที่ Navbar |
| **07** | [07-create-managed-area.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/07-create-managed-area.md) | PM / GIS Specialist | การวาดหรือนำเข้าพิกัดรูปแปลงขอบเขตพื้นที่ WGS84 EPSG:4326 และคำนวณพื้นที่ไร่-งาน-ตร.ว. |
| **08** | [08-upload-drone-images.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/08-upload-drone-images.md) | Drone Pilot | การบันทึกรอบการสำรวจ (Flight Metadata) และการอัปโหลดไฟล์ GeoTIFF/Assets เข้า MinIO |
| **09** | [09-photogrammetry.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/09-photogrammetry.md) | Operator / DevOps | การสั่งเริ่ม Ingestion & Processing Pipeline ผ่าน BullMQ Worker (`geomonitor-jobs`) |
| **10** | [10-view-3d-map.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/10-view-3d-map.md) | ทุกกลุ่ม | การควบคุมมุมกล้อง 3 มิติบน CesiumJS, เครื่องมือวัดระยะทาง/พื้นที่ และการเปิด-ปิด Layer |
| **11** | [11-manage-surveys.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/11-manage-surveys.md) | Analyst / Operator | การจัดการ Timeline ประวัติการบินสำรวจ และการเปิดแถบ Swipe Split เปรียบเทียบ $T_1$ กับ $T_2$ |
| **12** | [12-change-detection.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/12-change-detection.md) | GIS Analyst | การสั่งรันวิเคราะห์ความเปลี่ยนแปลง $\Delta Z$, การคำนวณปริมาตรงานดินขุด-ถม (Cut & Fill) |
| **13** | [13-review-results.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/13-review-results.md) | GIS Analyst | การตรวจสอบรูปแปลงคัดกรอง False Positives จากเงา และการบันทึกผลตรวจสอบ (Annotation) |
| **14** | [14-generate-reports.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/14-generate-reports.md) | PM / Analyst | การออกเอกสารรายงานทางการในรูปแบบ PDF และ CSV สรุปสถิติงานดิน (รองรับภาษาไทย UTF-8) |
| **15** | [15-troubleshooting.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/15-troubleshooting.md) | DevOps / Support | คู่มือแก้ไขปัญหา 15 สถานการณ์ (พอร์ตชน, PostGIS พัง, OOM, GPS หลุด, CRS ไม่ตรง) |
| **16** | [16-backup-and-restore.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/16-backup-and-restore.md) | DevOps / Admin | การสำรองฐานข้อมูล PostGIS (`pg_dump`), ซิงก์ MinIO Storage (`mc mirror`) และกู้คืนข้อมูล |
| **17** | [17-faq.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/17-faq.md) | ทุกกลุ่ม | คำถาม-คำตอบที่พบบ่อย (Air-Gapped, ความแม่นยำงานดิน, โดรนที่รองรับ, ระบบพิกัดไทย) |
| **18** | [18-field-operations-map.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/18-field-operations-map.md) | ทุกกลุ่ม / Operator | แผนที่ปฏิบัติการภาคสนาม การจัดการพิกัดทีม ฐานปฏิบัติการ และระบบจำลองการเคลื่อนที่ |
| **19** | [19-map-symbol-library.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/19-map-symbol-library.md) | ทุกกลุ่ม / GIS Specialist | คลังสัญลักษณ์ทางยุทธวิธี map.army, เครื่องมือวาดเวกเตอร์, Symbol Editor, การจัดการชั้นข้อมูล และ GeoJSON Import/Export |
| **ภาคผนวก** | [IMPLEMENTATION-STATUS.md](file:///Users/cangsalak/project/maparmy/docs/user-guide/IMPLEMENTATION-STATUS.md) | Tech Lead / DevOps | ตารางแจกแจงสถานะฟีเจอร์ที่มีอยู่จริง vs สิ่งที่ต้องติดตั้งเพิ่มเติมสำหรับโปรดักชัน |


---

## 🖼️ รายการภาพหน้าจอที่แนะนำให้บันทึก (Recommended Screenshot Inventory)

ระบบปัจจุบันใช้ Mermaid Diagrams ในการอธิบาย Workflow ทั้งหมดอย่างสมบูรณ์ สำหรับการจัดทำคู่มือฉบับภาพพิมพ์ในอนาคต แนะนำให้บันทึกภาพหน้าจอจริงจากระบบตามรายการไฟล์ดังต่อไปนี้และจัดเก็บไว้ใน `docs/user-guide/images/`:

| ลำดับภาพ | ชื่อไฟล์แนะนำ | หน้าจอที่ต้องบันทึก | รายละเอียดที่ควรปรากฏในภาพ |
|:---:|---|---|---|
| 1 | `01-login-screen.png` | `/login` | หน้าต่างเข้าสู่ระบบโทน Dark Navy พร้อมแผง Quick Switcher ด้านล่าง |
| 2 | `02-dashboard-3d.png` | `/` | หน้าต่างบัญชาการหลัก แสดงลูกโลก 3D Cesium, เมนูด้านซ้าย และ HUD พิกัด |
| 3 | `03-projects-list.png` | `/projects` | ตารางรายการโครงการ พร้อมการ์ดแสดงจำนวนพื้นที่และปุ่ม "สร้างโครงการ" |
| 4 | `04-area-creation.png` | `/areas` | ฟอร์มสร้างพื้นที่ดูแล พร้อมรูปแปลงโพลีกอนบนแผนที่และพื้นที่คำนวณ (ไร่-งาน-ตร.ว.) |
| 5 | `05-survey-upload.png` | `/surveys` | โมดอลบันทึกข้อมูลการบินสำรวจและกล่องลากวางอัปโหลดไฟล์ GeoTIFF |
| 6 | `06-processing-queue.png` | `/surveys` | แถบสถานะความคืบหน้าของ Worker Queue (25%, 50%, 75%, 100%) |
| 7 | `07-cesium-tools.png` | `/` | เครื่องมือวัดระยะทาง (Ruler) และเครื่องมือวัดพื้นที่ (Polygon Area) บนแผนที่ 3D |
| 8 | `08-swipe-compare.png` | `/` หรือ `/analysis` | หน้าต่างเปรียบเทียบภาพ $T_1$ และ $T_2$ ด้วยแถบเลื่อน Swipe Splitter |
| 9 | `09-cut-fill-map.png` | `/analysis` | แผนที่แสดงโพลีกอนขุดดิน (สีแดง) และถมดิน (สีน้ำเงิน) พร้อมแผงสถิติปริมาตร Net Volume |
| 10 | `10-feature-review.png` | `/analysis` | แผง Inspector ขวามือ ขณะเลือกสถานะ Confirmed Change หรือ False Positive |
| 11 | `11-report-preview.png` | `/reports` | หน้าต่างรายงานสรุปผลพร้อมตารางคำนวณปริมาตรและปุ่มดาวน์โหลด PDF / CSV |
| 12 | `12-admin-users.png` | `/admin` | หน้าต่างจัดการสิทธิ์ผู้ใช้งานและรายชื่อสมาชิกในระบบ |

---

## 🔒 ข้อตกลงความปลอดภัยและการรักษาความลับ (Security & Non-Disclosure)
1. ห้ามนำข้อมูลพิกัดความมั่นคง แผนที่ฐานราก หรือภาพถ่ายโดรนความละเอียดสูงอัปโหลดขึ้นบริการ Cloud ภายนอกที่ไม่ได้รับอนุญาต
2. ข้อมูลสถิติปริมาตรงานดินในรายงานมีผลทางนิติกรรมและสัญญาตรวจรับงาน ต้องผ่านการรับรองจากนักวิเคราะห์หรือวิศวกรผู้ได้รับมอบหมาย
3. เก็บรักษากุญแจรหัสผ่านในไฟล์ `.env` และ Token การเข้าถึงไว้ในสถานที่ปลอดภัยตามมาตรฐานความมั่นคงปลอดภัยสารสนเทศขององค์กร
