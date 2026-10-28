# 04-start-system.md — การเริ่มต้นระบบและตรวจสอบสถานะ

## วัตถุประสงค์
เอกสารฉบับนี้อธิบายคำสั่งและขั้นตอนในการเริ่มต้นการทำงานของระบบ GeoMonitor 3D ทั้งหมด การตรวจสอบสถานะการทำงาน (Health Monitoring) การดูบันทึกเหตุการณ์ (Logs) ตลอดจนการหยุดและรีสตาร์ตบริการอย่างถูกต้อง

---

## สิ่งที่ต้องเตรียม
- ติดตั้งระบบตาม [02-installation.md](02-installation.md)
- ปรับแต่งไฟล์ `.env` ตาม [03-configuration.md](03-configuration.md) เรียบร้อยแล้ว

---

## วิธีการเริ่มต้นระบบ (System Startup Methods)

### วิธีที่ 1: การเริ่มต้นระบบเต็มรูปแบบด้วย Docker Compose (แนะนำ)
คำสั่งนี้จะเริ่มต้นบริการทั้งหมด 7 คอนเทนเนอร์ในลักษณะ Background Daemon:

```bash
# สตาร์ตบริการทั้งหมด
docker compose -f infra/docker/docker-compose.yml up -d

# หรือใช้ NPM Shortcut Script ที่ตั้งค่าไว้ใน root package.json
npm run docker:up
```

**ผลลัพธ์ที่ควรเห็น:**
```text
[+] Running 7/7
 ✔ Container geomonitor-postgres  Healthy
 ✔ Container geomonitor-redis     Healthy
 ✔ Container geomonitor-minio     Healthy
 ✔ Container geomonitor-api       Started
 ✔ Container geomonitor-worker    Started
 ✔ Container geomonitor-web       Started
 ✔ Container geomonitor-nginx     Started
```

---

### วิธีที่ 2: การเริ่มต้นเฉพาะบริการแอปพลิเคชันแบบ Native Node.js (โหมดนักพัฒนา)
ในกรณีที่ต้องการรัน API, Web และ Worker ด้วย Node.js โดยตรงบนเครื่อง Host (โดยให้ฐานข้อมูลและ Redis ทำงานบน Docker):

```bash
# 1. รัน Backend API (Port 4000)
npm run dev:api

# 2. เปิดอีกหน้าต่าง Terminal รัน Background Worker (BullMQ)
npm run dev:worker

# 3. เปิดอีกหน้าต่าง Terminal รัน Frontend Next.js (Port 3000)
npm run dev:web
```

---

## การตรวจสอบสถานะระบบ (Health Verification)

### 1. ตรวจสอบสถานะการเชื่อมต่อ Service Health Check
รันคำสั่งเรียก API Health Endpoint:

```bash
curl -s http://localhost:4000/api/v1/health | jq .
```

**ผลลัพธ์ที่ถูกต้อง (Status ต้องเป็น "healthy"):**
```json
{
  "status": "healthy",
  "system": "GeoMonitor 3D API Service",
  "version": "1.0.0",
  "timestamp": "2026-10-26T04:17:53.083Z",
  "latencyMs": 10,
  "services": {
    "database": {
      "status": "connected",
      "type": "PostgreSQL 16 + PostGIS",
      "postgisVersion": "3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1"
    },
    "redis": {
      "status": "connected",
      "host": "localhost:6379"
    },
    "objectStorage": {
      "status": "configured",
      "provider": "MinIO / S3 Compatible & Local Storage Fallback",
      "buckets": [
        "geomonitor-assets",
        "geomonitor-reports"
      ]
    }
  }
}
```

### 2. ตรวจสอบหน้าจอเว็บแอปพลิเคชัน
เปิดเว็บบราวเซอร์แล้วเข้าไปที่ URL:
- เข้าสู่ระบบผ่าน Nginx Proxy: `http://localhost/` หรือ `http://<SERVER_IP>/`
- หรือเข้าสู่ระบบโดยตรง: `http://localhost:3000/`

หน้าจอจะแสดงแถบนำทางด้านบน (Navbar), แผนที่ 3 มิติ CesiumJS Globe, แถบเมนูด้านซ้าย (Left Sidebar) และแผงตรวจสอบข้อมูล (Inspector Panel)

---

## การตรวจสอบบันทึกการทำงาน (Log Inspection)

สามารถติดตาม Log ของบริการต่างๆ แบบเรียลไทม์ได้ด้วยคำสั่งต่อไปนี้:

```bash
# ดู Log ของบริการทั้งหมดพร้อมกัน
docker compose -f infra/docker/docker-compose.yml logs -f

# ดูเฉพาะ Log ของ Backend API (Express.js)
docker compose -f infra/docker/docker-compose.yml logs -f api

# ดูเฉพาะ Log ของ Background Processing Worker (BullMQ)
docker compose -f infra/docker/docker-compose.yml logs -f worker

# ดูเฉพาะ Log ของฐานข้อมูล PostgreSQL / PostGIS
docker compose -f infra/docker/docker-compose.yml logs -f postgres

# ดูเฉพาะ Log ของ Nginx Web Gateway
docker compose -f infra/docker/docker-compose.yml logs -f nginx
```

---

## การหยุดและรีสตาร์ตระบบ (Stopping & Restarting)

### 1. การรีสตาร์ตระบบทั้งหมด
```bash
docker compose -f infra/docker/docker-compose.yml restart
```

### 2. การรีสตาร์ตเฉพาะบริการใดบริการหนึ่ง (เช่น เมื่อแก้ไขโค้ด API หรือ Worker)
```bash
docker compose -f infra/docker/docker-compose.yml restart api
docker compose -f infra/docker/docker-compose.yml restart worker
```

### 3. การหยุดระบบโดยยังคงเก็บรักษาข้อมูลไว้ (Graceful Stop)
คำสั่งนี้จะปิดคอนเทนเนอร์ทั้งหมด **โดยข้อมูลในฐานข้อมูลและไฟล์ใน MinIO ยังคงอยู่ครบถ้วน**:
```bash
docker compose -f infra/docker/docker-compose.yml down

# หรือใช้ NPM Shortcut
npm run docker:down
```

> [!CAUTION]
> ห้ามเติมแฟล็ก `-v` หรือ `--volumes` ในคำสั่ง `docker compose down` โดยเด็ดขาด เพราะจะเป็นการสั่งลบข้อมูลถาวรทั้งหมดในดิสก์ของ PostgreSQL, Redis และ MinIO

---

## ข้อผิดพลาดที่พบบ่อยและวิธีแก้ไข

### ข้อผิดพลาด: API ขึ้นสถานะ `database: disconnected`
- **สาเหตุ**: คอนเทนเนอร์ `geomonitor-postgres` ยังสตาร์ตไม่เสร็จ หรือรหัสผ่านใน `.env` ไม่ตรงกับที่กำหนดไว้ตอนสร้างดาต้าเบส
- **วิธีแก้ไข**: ตรวจสอบสถานะคอนเทนเนอร์ด้วย `docker logs geomonitor-postgres` และรอให้ Health Check ขึ้น `(healthy)`

### ข้อผิดพลาด: หน้าเว็บขึ้น `Application error: a client-side exception has occurred`
- **สาเหตุ**: เว็บบราวเซอร์ไม่สามารถเชื่อมต่อกับพอร์ต API (4000) ได้ หรือเว็บบราวเซอร์ปิดการใช้งาน WebGL
- **วิธีแก้ไข**: ตรวจสอบว่า API รันอยู่ และเปิดฟังก์ชัน Hardware Acceleration ในการตั้งค่าของบราวเซอร์

---

## ขั้นตอนถัดไป
เมื่อเริ่มต้นระบบและบริการทั้งหมดทำงานปกติแล้ว ให้ศึกษาขั้นตอนการเข้าสู่ระบบและจัดการบัญชีผู้ใช้งานใน [05-login-and-users.md](05-login-and-users.md)
