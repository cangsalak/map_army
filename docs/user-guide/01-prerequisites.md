# 01-prerequisites.md — ซอฟต์แวร์และอุปกรณ์ที่ต้องเตรียม

## วัตถุประสงค์
เอกสารฉบับนี้ระบุข้อกำหนดขั้นต่ำและคำแนะนำด้านฮาร์ดแวร์ ซอฟต์แวร์ พอร์ตเครือข่าย และสภาพแวดล้อมระบบปฏิบัติการที่จำเป็นสำหรับการติดตั้งและใช้งานระบบ GeoMonitor 3D บนเครือข่ายภายในองค์กร

---

## ข้อกำหนดฮาร์ดแวร์ (Hardware Requirements)

เนื่องจากระบบต้องรองรับการประมวลผลข้อมูลภาพถ่ายออร์โธโมเสกขนาดใหญ่และเรนเดอร์แบบจำลอง 3 มิติเชิงพื้นที่ จึงแบ่งขนาดฮาร์ดแวร์ตามระดับการใช้งานดังนี้:

| รายการฮาร์ดแวร์ | สภาพแวดล้อมทดสอบ (Development / Test) | ใช้งานจริงระดับพื้นฐาน (Production Baseline) | ใช้งานระดับองค์กร (Enterprise Production) |
|---|---|---|---|
| **หน่วยประมวลผล (CPU)** | 4 Cores (x86_64 หรือ Apple Silicon) | 8–16 Cores (รองรับ AVX2) | 16–32+ Cores |
| **หน่วยความจำ (RAM)** | 16 GB | 32–64 GB | 64–128+ GB |
| **พื้นที่จัดเก็บข้อมูล (Storage)** | 100 GB SSD | 1 TB NVMe SSD + 4 TB HDD | 2 TB NVMe SSD + 10–50 TB NAS/SAN |
| **การ์ดแสดงผล (GPU สำหรับ Client)** | Integrated GPU (รองรับ WebGL 2.0) | Dedicated GPU (VRAM 4 GB+) | Dedicated GPU (VRAM 8 GB+) |
| **แบนด์วิดท์เครือข่าย (Network)** | 1 Gbps LAN | 1–10 Gbps LAN | 10 Gbps Air-Gapped Network |

---

## ซอฟต์แวร์ที่ต้องติดตั้งบนเครื่องแม่ข่าย (Server Software Prerequisites)

### 1. Docker & Docker Compose
ระบบ GeoMonitor 3D รันบริการหลักผ่าน Docker Containers:
- **Docker Engine**: เวอร์ชัน 24.0 ขึ้นไป
- **Docker Compose**: เวอร์ชัน v2.20 ขึ้นไป (คำสั่ง `docker compose`)

### 2. Node.js & Package Manager (สำหรับการรันแบบ Local Development / Native Host)
- **Node.js**: เวอร์ชัน 20.x LTS หรือ 22.x LTS (ระบบรองรับ `node >= 20.0.0`)
- **NPM**: เวอร์ชัน 10.x หรือ 11.x

### 3. Git
- **Git**: เวอร์ชัน 2.40 ขึ้นไป สำหรับโคลนและจัดการเวอร์ชันของซอร์สโค้ด

---

## พอร์ตเครือข่ายที่ต้องเปิดใช้งาน (Network Port Allocations)

ก่อนเริ่มติดตั้งระบบ กรุณาตรวจสอบให้แน่ใจว่าพอร์ตเหล่านี้บนเครื่องแม่ข่ายไม่ได้ถูกใช้งานโดยบริการอื่นและสามารถเชื่อมต่อได้:

| หมายเลขพอร์ต | โปรโตคอล | บริการ (Service) | รายละเอียดการใช้งาน | ขอบเขตการเปิดสิทธิ์ (Scope) |
|---|---|---|---|---|
| **80** | HTTP | Nginx Reverse Proxy | ทางเข้าหลักสำหรับเว็บบราวเซอร์และ REST API | เปิดให้เครื่องลูกข่าย (Clients) ภายในองค์กร |
| **3000** | HTTP | Next.js Frontend Web | บริการหน้าเว็บ GeoMonitor 3D UI | ภายใน Docker Network / Local Host |
| **4000** | HTTP | Express.js Backend API | บริการ REST API & OpenAPI Swagger Docs | ภายใน Docker Network / Local Host |
| **5432** | TCP | PostgreSQL + PostGIS | ฐานข้อมูลเชิงพื้นที่ (Spatial DB) | จำกัดเฉพาะภายในเครื่องเซิร์ฟเวอร์ |
| **6379** | TCP | Redis | แคชและคิวงานประมวลผล BullMQ | จำกัดเฉพาะภายในเครื่องเซิร์ฟเวอร์ |
| **9000** | HTTP | MinIO S3 API | บริการจัดเก็บไฟล์ภาพผลลัพธ์ (S3 API) | ภายในองค์กร / Local Host |
| **9001** | HTTP | MinIO Web Console | แดชบอร์ดจัดการไฟล์ MinIO สำหรับแอดมิน | เปิดให้เฉพาะผู้ดูแลระบบ |

---

## ข้อกำหนดของเครื่องลูกข่าย (Client Workstation Requirements)

ผู้ใช้งานระบบ (Admin, Project Manager, Analyst, Viewer) ต้องใช้งานเครื่องคอมพิวเตอร์ลูกข่ายที่มีคุณสมบัติต่อไปนี้:
- **ระบบปฏิบัติการ**: macOS 13+, Windows 10/11 (64-bit), หรือ Linux (Ubuntu 22.04+)
- **เว็บบราวเซอร์**: Google Chrome 115+, Microsoft Edge 115+, Mozilla Firefox 115+, หรือ Safari 17+
- **การรองรับกราฟิก**: ต้องเปิดใช้งาน **Hardware Acceleration** ในการตั้งค่าของเว็บบราวเซอร์ เพื่อให้ CesiumJS สามารถเรนเดอร์โมเดล 3 มิติได้อย่างลื่นไหล

---

## ขั้นตอนการตรวจสอบความพร้อมของระบบ (Verification Commands)

เปิด Terminal หรือ Command Prompt แล้วรันคำสั่งตรวจสอบ:

### บน macOS และ Linux:
```bash
# ตรวจสอบเวอร์ชัน Docker
docker --version
docker compose version

# ตรวจสอบเวอร์ชัน Node.js และ NPM
node -v
npm -v

# ตรวจสอบการใช้งานพอร์ตหลัก (80, 3000, 4000, 5432, 6379, 9000)
lsof -i :80 -i :3000 -i :4000 -i :5432 -i :6379 -i :9000
```

### บน Windows (PowerShell):
```powershell
# ตรวจสอบเวอร์ชัน Docker
docker --version
docker compose version

# ตรวจสอบเวอร์ชัน Node.js
node -v
npm -v

# ตรวจสอบการใช้งานพอร์ต
Get-NetTCPConnection -LocalPort 80,3000,4000,5432,6379,9000 -ErrorAction SilentlyContinue
```

---

## ข้อควรระวังด้านความปลอดภัย
- สำหรับการใช้งานในระบบปิด (Air-Gapped Private Network) ห้ามเปิดพอร์ตฐานข้อมูล (5432) และ Redis (6379) ออกสู่เครือข่ายสาธารณะภายนอก
- ตรวจสอบไฟร์วอลล์ (Firewall / iptables) ให้ยอมรับเฉพาะทราฟฟิกพอร์ต 80 (หรือ 443 สำหรับ HTTPS) จากเครือข่ายย่อยที่ได้รับอนุญาตเท่านั้น

---

## ขั้นตอนถัดไป
เมื่อเตรียมอุปกรณ์และซอฟต์แวร์ครบถ้วนแล้ว ให้ดำเนินการติดตั้งระบบตาม [02-installation.md](02-installation.md)
