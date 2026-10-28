# 02-installation.md — การติดตั้งระบบ On-premises

## วัตถุประสงค์
เอกสารฉบับนี้อธิบายขั้นตอนการติดตั้งระบบ GeoMonitor 3D บนเครื่องแม่ข่ายภายในองค์กร (On-premises / Local Server) อย่างละเอียด ตั้งแต่การเตรียมซอร์สโค้ด การติดตั้งแพ็กเกจ การคอมไพล์ระบบ ไปจนถึงการสตาร์ตคอนเทนเนอร์บริการผ่าน Docker Compose

---

## สิ่งที่ต้องเตรียม
- เครื่องแม่ข่ายที่ติดตั้ง Docker, Docker Compose, Node.js (>=20.0.0), NPM และ Git เรียบร้อยแล้วตาม [01-prerequisites.md](01-prerequisites.md)
- สิทธิ์ผู้ดูแลระบบ (Root หรือ Sudo บน Linux/macOS, Administrator บน Windows)
- สิทธิ์การเข้าถึงไฟล์ซอร์สโค้ดโปรเจกต์ `geomonitor-3d`

---

## ขั้นตอนการติดตั้งทีละข้อ (Step-by-Step Installation)

### ขั้นตอนที่ 1: การนำเข้าซอร์สโค้ดโปรเจกต์
หากนำเข้าผ่าน Git หรือการคัดลอกไฟล์ zip ภายในเครือข่ายปิด ให้วางโค้ดไว้ในไดเรกทอรีทำงาน เช่น `/opt/geomonitor-3d` หรือไดเรกทอรีโปรเจกต์:

```bash
# สำหรับการ Clone ผ่าน Git ภายในองค์กร
git clone <INTERNAL_GIT_URL>/geomonitor-3d.git
cd geomonitor-3d
```

### ขั้นตอนที่ 2: ติดตั้ง Node.js Dependencies ทั้งหมด
ระบบใช้ระบบ Monorepo (NPM Workspaces) สามารถติดตั้งไลบรารีทุกแพ็กเกจทั้งระบบได้ด้วยคำสั่งเดียวจาก Root Directory:

```bash
npm install
```

### ขั้นตอนที่ 3: คอมไพล์โมดูลส่วนกลาง (Shared Package Build)
แพ็กเกจ `@geomonitor/shared` เก็บ Data Schemas, Zod Validators, Types และ Utility Functions ทางภูมิศาสตร์ ต้องคอมไพล์ก่อนที่ API และ Frontend จะเรียกใช้งานได้:

```bash
npm run build --workspace=@geomonitor/shared
```

**ผลลัพธ์ที่ควรเห็น:**
```text
> @geomonitor/shared@1.0.0 build
> tsup
CLI Building entry: src/index.ts
CLI Using tsconfig: tsconfig.json
CLI tsup v8.3.6
CLI Target: es2022
CJS Build start
ESM Build start
CJS dist/index.cjs     xx.xx KB
ESM dist/index.js      xx.xx KB
CJS ⚡️ Build success
ESM ⚡️ Build success
```

---

## รูปแบบการติดตั้งและการรันระบบ (Deployment Modes)

ท่านสามารถเลือกรันระบบได้ 2 รูปแบบตามความเหมาะสมของสภาพแวดล้อม:

### แบบที่ 1: รันบริการทั้งหมดผ่าน Docker Compose (แนะนำสำหรับ Production)
โครงสร้างบริการจะถูกสร้างขึ้นตามไฟล์ `infra/docker/docker-compose.yml` ประกอบด้วย 7 คอนเทนเนอร์:
1. `geomonitor-postgres` (PostgreSQL 16 + PostGIS 3.4)
2. `geomonitor-redis` (Redis Cache & Queue)
3. `geomonitor-minio` (S3 Object Storage)
4. `geomonitor-api` (Express.js Backend)
5. `geomonitor-worker` (BullMQ Background Worker)
6. `geomonitor-web` (Next.js Frontend)
7. `geomonitor-nginx` (Reverse Proxy Port 80)

```bash
# 1. คัดลอกไฟล์ตั้งค่า Environment
cp .env.example .env

# 2. เริ่มต้นคอนเทนเนอร์ทั้งหมด
docker compose -f infra/docker/docker-compose.yml up -d --build
```

### แบบที่ 2: รันแบบไฮบริด (Docker เฉพาะฐานข้อมูล + Native Node.js Services)
เหมาะสำหรับการทดสอบ บำรุงรักษา หรือเครื่องที่ต้องการควบคุม Process ด้วยตนเอง:

```bash
# 1. สตาร์ตเฉพาะ PostgreSQL และ Redis ผ่าน Docker
docker run -d --name geomonitor-postgres -p 5432:5432 \
  -e POSTGRES_DB=geomonitor \
  -e POSTGRES_USER=geomonitor \
  -e POSTGRES_PASSWORD=geomonitor_secret \
  postgis/postgis:16-3.4

docker run -d --name geomonitor-redis -p 6379:6379 redis:alpine

# 2. รัน Database Migrations (สร้างตารางและเปิดใช้งาน PostGIS)
npm run db:migrate --workspace=@geomonitor/api

# 3. รัน Database Seed (สร้างบัญชีเริ่มต้นและองค์กร)
npm run db:seed --workspace=@geomonitor/api

# 4. บิลด์ Next.js Frontend
npm run build --workspace=@geomonitor/web
```

---

## วิธีตรวจสอบว่าติดตั้งสำเร็จ (Verification)

### 1. ตรวจสอบสถานะ Docker Containers
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**ผลลัพธ์ที่ถูกต้อง:**
```text
NAMES                  STATUS                    PORTS
geomonitor-postgres    Up (healthy)              0.0.0.0:5432->5432/tcp
geomonitor-redis       Up (healthy)              0.0.0.0:6379->6379/tcp
geomonitor-minio       Up (healthy)              0.0.0.0:9000->9000/tcp, 0.0.0.0:9001->9001/tcp
geomonitor-api         Up                        0.0.0.0:4000->4000/tcp
geomonitor-worker      Up                        
geomonitor-web         Up                        0.0.0.0:3000->3000/tcp
geomonitor-nginx       Up                        0.0.0.0:80->80/tcp
```

### 2. ตรวจสอบ Health Check ของระบบ Backend API
ทดสอบส่ง HTTP GET ไปยังพอร์ต 4000 หรือผ่าน Nginx พอร์ต 80:

```bash
curl -s http://localhost:4000/api/v1/health | jq .
# หรือผ่าน Nginx
curl -s http://localhost/api/v1/health | jq .
```

**ผลลัพธ์ที่ควรได้รับ (HTTP 200 OK):**
```json
{
  "status": "healthy",
  "system": "GeoMonitor 3D API Service",
  "version": "1.0.0",
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
      "buckets": ["geomonitor-assets", "geomonitor-reports"]
    }
  }
}
```

---

## ข้อผิดพลาดที่พบบ่อยและวิธีแก้ไข (Troubleshooting)

### ข้อผิดพลาด 1: `npm run build` ใน `@geomonitor/web` ฟ้องว่า `Cannot find module '@geomonitor/shared'`
- **สาเหตุ**: ยังไม่ได้คอมไพล์แพ็กเกจ `packages/shared` หรือโฟลเดอร์ `dist` ยังไม่ถูกสร้าง
- **วิธีแก้ไข**: รันคำสั่ง `npm run build --workspace=@geomonitor/shared` ก่อนคอมไพล์ web

### ข้อผิดพลาด 2: `PostGIS extension not found` หรือ `function st_area does not exist`
- **สาเหตุ**: คอนเทนเนอร์ PostgreSQL ที่ใช้งานไม่ใช่ Image ที่มี PostGIS หรือยังไม่ได้เปิด Extension
- **วิธีแก้ไข**: ตรวจสอบว่าใช้ Image `postgis/postgis:16-3.4` และรันคำสั่ง SQL:
  ```bash
  docker exec -it geomonitor-postgres psql -U geomonitor -d geomonitor -c "CREATE EXTENSION IF NOT EXISTS postgis;"
  ```

### ข้อผิดพลาด 3: พอร์ต 5432 หรือ 80 ชนกับโปรแกรมเดิมในเครื่อง
- **สาเหตุ**: มี PostgreSQL ท้องถิ่น หรือ Apache/IIS/Nginx ทำงานอยู่ก่อนแล้ว
- **วิธีแก้ไข**: แก้ไขหมายเลขพอร์ตภายนอกในไฟล์ `.env` เช่น เปลี่ยน `DB_PORT=5433` หรือปิดบริการเดิมก่อนเริ่มติดตั้ง

---

## ข้อควรระวังด้านความปลอดภัย
- ห้ามใช้รหัสผ่านดีฟอลต์ `geomonitor_secret` หรือคีย์ JWT ดีฟอลต์ในการใช้งานระดับ Production บนเซิร์ฟเวอร์จริง
- ควรกำหนดรหัสผ่านที่รัดกุมในไฟล์ `.env` ก่อนสั่งรันคำสั่ง Docker Compose

---

## ขั้นตอนถัดไป
เมื่อติดตั้งระบบและตรวจสอบสถานะเบื้องต้นเรียบร้อยแล้ว ให้ดำเนินการตรวจสอบและปรับแต่งค่าคอนฟิกูเรชันใน [03-configuration.md](03-configuration.md)
