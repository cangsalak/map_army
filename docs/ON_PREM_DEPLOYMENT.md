# GeoMonitor 3D — On-Premises Deployment & Operations Manual
**คู่มือการติดตั้ง ใช้งาน และบริหารจัดการระบบบนโครงสร้างพื้นฐานภายในองค์กร (On-Premises / Air-Gapped Network)**

---

## 1. ข้อกำหนดฮาร์ดแวร์และการปรับขนาด (Hardware Sizing Guidance)

ระบบ GeoMonitor 3D ออกแบบเพื่อประมวลผลข้อมูลภาพถ่ายโดรนปริมาณมากและสตรีมมิ่งแบบจำลอง 3 มิติ จึงแบ่งโปรไฟล์เครื่องแม่ข่ายตามขนาดการใช้งานดังนี้:

| โปรไฟล์เซิร์ฟเวอร์ | CPU (Cores) | หน่วยความจำ (RAM) | พื้นที่จัดเก็บ (Storage) | เครือข่าย (Network) | ปริมาณงานที่รองรับ |
|---|---|---|---|---|---|
| **Development / Test** | 4 Cores | 16 GB | 250 GB NVMe SSD | 1 Gbps | รองรับ < 500 ภาพ/รอบบิน, 1 พื้นที่พร้อมกัน |
| **Production Baseline** | 16 Cores | 64 GB | 2 TB NVMe SSD + 10 TB HDD | 10 Gbps | รองรับ 2,000 ภาพ/รอบบิน, 3 ไปป์ไลน์ประมวลผลพร้อมกัน |
| **Enterprise / Heavy UAV** | 32+ Cores | 128+ GB | 4 TB NVMe (Cache) + 40 TB NAS/SAN | 10–25 Gbps | รองรับ LiDAR Point Cloud, 10,000+ ภาพ/วัน |

### คำแนะนำด้านอุปกรณ์ประมวลผล (Photogrammetry Node):
- **CPU**: สถาปัตยกรรม x86_64 หรือ ARM64 ที่รองรับ AVX2 สำหรับงาน Structure from Motion (SfM) และการจับคู่จุดภาพ (Dense Matching)
- **GPU (ทางเลือกสำหรับ OpenDroneMap)**: NVIDIA GPU (VRAM 16GB+ แนะนำ RTX 4080/4090 หรือ A4000) สำหรับการเร่งความเร็วการคำนวณจุดเมฆ (Point Cloud)
- **พื้นที่ชั่วคราว (Scratch Disk)**: ควรกำหนดให้อยู่บน NVMe SSD สำหรับการคลายและแปลงไฟล์ Geotiff / Orthomosaic ขนาดใหญ่

---

## 2. ขั้นตอนการติดตั้งบนเครือข่ายภายในองค์กร (Air-Gapped Deployment)

### สถาปัตยกรรมการแยกส่วนเครือข่าย (Network Segmentation)
```
[ User Workstations / Web Browser ]
                 │
            (Port 80/443)
                 ▼
       ┌──────────────────┐
       │   Nginx Proxy    │ (DMZ / Private LAN)
       └─────────┬────────┘
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
┌──────────────┐   ┌──────────────┐
│ Next.js Web  │   │ Express API  │ (App Layer - Internal Only)
│ (Port 3000)  │   │ (Port 4000)  │
└──────────────┘   └───────┬──────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  PostGIS 16  │   │   Redis 7    │   │ MinIO S3     │ (Data Layer)
│ (Port 5432)  │   │ (Port 6379)  │   │ (Port 9000)  │
└──────────────┘   └───────┬──────┘   └──────────────┘
                           │
                   ┌───────┴──────┐
                   │ BullMQ Worker│ (Processing Engine)
                   └──────────────┘
```

### การเริ่มรันระบบผ่าน Docker Compose:
```bash
# 1. ตรวจสอบไฟล์การตั้งค่าสภาพแวดล้อม
cp .env.example .env

# 2. บิลด์และสตาร์ตคอนเทนเนอร์ทั้งหมดในคราวเดียว
docker compose -f infra/docker/docker-compose.yml up -d --build

# 3. ตรวจสอบความสมบูรณ์ของ Service
docker compose -f infra/docker/docker-compose.yml ps
```

---

## 3. การสำรองและกู้คืนข้อมูล (Backup & Disaster Recovery Procedures)

### ก. การสำรองฐานข้อมูลเชิงพื้นที่ (PostGIS Spatial Database Backup)
```bash
#!/bin/bash
BACKUP_DIR="/backup/geomonitor/postgres"
DATE=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

# ดัมป์ฐานข้อมูลโครงสร้างและข้อมูลตารางพิกัด
docker exec -t geomonitor-postgres pg_dump -U geomonitor -d geomonitor -F c -b -v -f "/var/lib/postgresql/data/backup_${DATE}.dump"

# คัดลอกออกมาเก็บยังที่ปลอดภัย
docker cp "geomonitor-postgres:/var/lib/postgresql/data/backup_${DATE}.dump" "$BACKUP_DIR/"
echo "PostGIS Backup completed: $BACKUP_DIR/backup_${DATE}.dump"
```

### ข. การสำรองข้อมูลไฟล์ภาพโดรนและผลลัพธ์ (MinIO / S3 Backup)
```bash
# ซิงก์ถังจัดเก็บข้อมูลภาพโดรนไปยังพื้นที่สำรองภายนอก (NAS/Offsite)
mc mirror local/geomonitor-assets /mnt/secure-nas/geomonitor-assets-backup/
mc mirror local/geomonitor-reports /mnt/secure-nas/geomonitor-reports-backup/
```

### ค. ขั้นตอนการกู้คืนระบบ (Disaster Recovery / Restore)
```bash
# 1. สตาร์ตคอนเทนเนอร์ฐานข้อมูลใหม่
docker compose -f infra/docker/docker-compose.yml up -d postgres

# 2. ทำการ Restore ผ่าน pg_restore
docker cp "/backup/geomonitor/postgres/backup_20261026.dump" geomonitor-postgres:/tmp/
docker exec -i geomonitor-postgres pg_restore -U geomonitor -d geomonitor -v --clean "/tmp/backup_20261026.dump"

# 3. รัน Migration เช็คความสมบูรณ์
npm run db:migrate --workspace=@geomonitor/api
```

---

## 4. ข้อจำกัดของระบบและการตรวจสอบความถูกต้อง (Known Limitations & Validation Procedures)

### ข้อจำกัดทางเทคนิคและสมมติฐาน (Technical Assumptions & Limitations):
1. **การเบี่ยงเบนของเงาและพืชพรรณ (Shadow & Vegetation Artifacts)**:
   - การตรวจจับการเปลี่ยนแปลงระดับภาพถ่าย (Orthomosaic 2D) อาจตรวจพบความต่างของสีเนื่องจากทิศทางของมุมแสงอาทิตย์หรือการเติบโต/ผลัดใบของต้นไม้
   - **แนวทางปฏิบัติ**: ระบบกำหนดให้การเปลี่ยนแปลงระดับภาพถ่ายเป็น "Candidate Changes" (การเปลี่ยนแปลงเบื้องต้น) ซึ่งต้องผ่านการตรวจทานและรับรองโดยนักวิเคราะห์ (Analyst Review) ก่อนเป็นสถานะ Confirmed Change
2. **ความคลาดเคลื่อนทางดิ่งของแบบจำลองระดับความสูง (DSM Elevation Uncertainty)**:
   - การคำนวณปริมาตรงานดินขุดถม (Cut & Fill Volume) ดำเนินการผ่านความต่างของแบบจำลองความสูง $\Delta Z$ ซึ่งมีความคลาดเคลื่อนขึ้นอยู่กับจำนวนและการกระจายตัวของหมุดควบคุมภาคพื้นดิน (GCP)
   - หากบินโดยไม่มี GCP หรือไม่มีระบบ RTK/PPK ค่าระดับความสูงอาจคลาดเคลื่อนเชิงสัมบูรณ์ $\pm 0.10 - 0.25$ เมตร
3. **การแสดงผล CesiumJS 3D ในสภาวะตัดขาดอินเทอร์เน็ต (Air-Gapped Imagery)**:
   - ระบบตั้งค่าให้ใช้ภาพถ่ายออร์โธโมเสกที่นำเข้าจากโดรนและเลเยอร์แผนที่ท้องถิ่นผ่าน Local Tile Server
   - สำหรับภาพถ่ายดาวเทียมพื้นหลัง หากเครือข่ายไม่มีอินเทอร์เน็ต ระบบจะใช้ Local Fallback Grid หรือออฟไลน์แผนที่ฐานที่กำหนดไว้ในเซิร์ฟเวอร์ MinIO ภายใน

### ขั้นตอนการทดสอบความถูกต้องของข้อมูล (Data Validation Protocol):
1. ตรวจสอบความสอดคล้องของระบบพิกัด (`EPSG:4326` สำหรับ GeoJSON ขอบเขต และ `EPSG:32647` สำหรับการคำนวณปริมาตรพื้นที่ในไทย)
2. ตรวจสอบไฟล์ผลลัพธ์ผ่าน GDAL Info:
   ```bash
   gdalinfo /path/to/orthophoto.tif
   gdalinfo /path/to/dsm.tif
   ```
3. ยืนยันการเชื่อมต่อและดัชนีเชิงพื้นที่ (GiST Index) ใน PostgreSQL:
   ```sql
   SELECT tablename, indexname, indexdef FROM pg_indexes WHERE tablename = 'managed_areas';
   ```
