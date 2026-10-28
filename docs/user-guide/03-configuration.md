# 03-configuration.md — การตั้งค่า Environment Variables

## วัตถุประสงค์
เอกสารฉบับนี้อธิบายรายละเอียดของตัวแปรสภาพแวดล้อม (Environment Variables) ทุกตัวที่มีอยู่จริงในไฟล์ `.env` และ `.env.example` ของระบบ GeoMonitor 3D เพื่อให้ผู้ดูแลระบบสามารถปรับแต่งการทำงานให้สอดคล้องกับมาตรฐานความปลอดภัยและสถาปัตยกรรมเครือข่ายขององค์กร

---

## สิ่งที่ต้องเตรียม
- ไฟล์ต้นแบบ `.env.example` ที่ Root Directory ของโปรเจกต์
- ข้อมูลการเชื่อมต่อฐานข้อมูล เครือข่าย แคช และพื้นที่จัดเก็บไฟล์จริง

---

## รายการตัวแปรสภาพแวดล้อมทั้งหมด (Complete Environment Reference)

### 1. หมวดการทำงานทั่วไปและเซิร์ฟเวอร์ (Server & Application)

| ตัวแปร (Variable) | ชนิดข้อมูล | ค่าเริ่มต้นใน `.env.example` | คำอธิบายและคำแนะนำสำหรับ Production |
|---|---|---|---|
| `NODE_ENV` | String | `development` | โหมดการทำงานของ Node.js กำหนดเป็น `production` เมื่อใช้งานจริง |
| `API_PORT` | Number | `4000` | หมายเลขพอร์ตสำหรับ Backend Express REST API |
| `WEB_PORT` | Number | `3000` | หมายเลขพอร์ตสำหรับ Frontend Next.js Web |
| `API_BASE_URL` | URL | `http://localhost:4000/api/v1` | URL ฐานสำหรับเข้าถึง API ฝั่งเซิร์ฟเวอร์ |
| `WEB_BASE_URL` | URL | `http://localhost:3000` | URL ฐานสำหรับเข้าถึงหน้าเว็บ |

---

### 2. หมวดความปลอดภัยและการยืนยันตัวตน (Security & JWT Auth)

| ตัวแปร (Variable) | ชนิดข้อมูล | ตัวอย่างค่าเริ่มต้น | ข้อกำหนดความปลอดภัยที่เข้มงวด |
|---|---|---|---|
| `JWT_SECRET` | String | `super-secret-geomonitor-key-...` | **ต้องเปลี่ยนทันที!** รหัสลับสำหรับลงนาม Access Token ต้องมีความยาวอย่างน้อย 32 อักขระ |
| `JWT_ACCESS_EXPIRES_IN` | String | `1h` | อายุการใช้งานของ Access Token (แนะนำ 15m ถึง 1h) |
| `JWT_REFRESH_EXPIRES_IN` | String | `7d` | อายุการใช้งานของ Refresh Token ที่เก็บใน HttpOnly Cookie |
| `COOKIE_SECRET` | String | `geomonitor-secure-cookie-...` | รหัสลับสำหรับลงนาม Cookie ความยาวอย่างน้อย 32 ตัวอักษร |

> [!WARNING]
> ห้ามใช้ค่าเริ่มต้น `super-secret-geomonitor-key-change-in-production-min32chars` บนระบบที่ใช้งานจริงโดยเด็ดขาด การใช้คีย์เริ่มต้นอาจทำให้ระบบถูกโจมตีด้วยการปลอมแปลงสิทธิ์ (Token Forgery) ได้

---

### 3. หมวดฐานข้อมูลเชิงพื้นที่ (PostgreSQL & PostGIS)

| ตัวแปร (Variable) | ชนิดข้อมูล | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `DB_HOST` | String | `localhost` | ชื่อโฮสต์หรือ IP ของเซิร์ฟเวอร์ PostgreSQL |
| `DB_PORT` | Number | `5432` | หมายเลขพอร์ต PostgreSQL |
| `DB_USER` | String | `geomonitor` | บัญชีผู้ใช้ฐานข้อมูล |
| `DB_PASSWORD` | String | `geomonitor_secret` | รหัสผ่านฐานข้อมูล (ต้องเปลี่ยนใน Production) |
| `DB_NAME` | String | `geomonitor` | ชื่อฐานข้อมูลหลัก |
| `DATABASE_URL` | Connection String | `postgresql://geomonitor:geomonitor_secret@localhost:5432/geomonitor` | Connection String รูปแบบมาตรฐานสำหรับ pg pool และ migrations |

---

### 4. หมวดระบบจัดการแคชและคิวงาน (Redis & BullMQ)

| ตัวแปร (Variable) | ชนิดข้อมูล | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `REDIS_HOST` | String | `localhost` | ชื่อโฮสต์หรือคอนเทนเนอร์ของ Redis (`redis` ใน docker-compose) |
| `REDIS_PORT` | Number | `6379` | หมายเลขพอร์ต Redis |
| `REDIS_PASSWORD` | String | *(เว้นว่าง)* | รหัสผ่านสำหรับเข้าถึง Redis (หากมีการตั้งค่า `requirepass`) |

---

### 5. หมวดการจัดเก็บไฟล์ภาพผลลัพธ์ (MinIO / S3 Object Storage)

| ตัวแปร (Variable) | ชนิดข้อมูล | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `MINIO_ENDPOINT` | String | `localhost` | ที่อยู่โฮสต์ของบริการ MinIO |
| `MINIO_PORT` | Number | `9000` | พอร์ต API สำหรับ S3 Bucket Operations |
| `MINIO_USE_SSL` | Boolean | `false` | กำหนดเป็น `true` หากใช้งานร่วมกับ HTTPS Certificate |
| `MINIO_ROOT_USER` | String | `minioadmin` | บัญชีผู้ดูแลระบบสูงสุดของ MinIO |
| `MINIO_ROOT_PASSWORD` | String | `minioadmin` | รหัสผ่านผู้ดูแลระบบ MinIO (ต้องเปลี่ยนใน Production) |
| `MINIO_BUCKET_ASSETS` | String | `geomonitor-assets` | ชื่อบัคเก็ตสำหรับเก็บไฟล์ภาพถ่ายโดรน, Orthomosaic และ DSM |
| `MINIO_BUCKET_REPORTS` | String | `geomonitor-reports` | ชื่อบัคเก็ตสำหรับเก็บเอกสารรายงานสรุป PDF และ CSV |
| `S3_PUBLIC_URL` | URL | `http://localhost:9000` | URL สาธารณะสำหรับดาวน์โหลดไฟล์ Asset |

---

### 6. หมวดแผนที่ 3 มิติและการแสดงผล (CesiumJS Configuration)

| ตัวแปร (Variable) | ชนิดข้อมูล | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` | String | *(เว้นว่าง)* | **ทางเลือก (Optional):** หากต้องการดึง World Terrain หรือ Bing Maps จาก Cesium Ion ภายนอก หากเว้นว่างไว้ ระบบจะใช้งาน WGS84 Ellipsoid และ OpenStreetMap ภายในระบบแทนแบบอัตโนมัติ (เหมาะสำหรับ Air-Gapped Network) |
| `NEXT_PUBLIC_API_URL` | URL | `http://localhost:4000/api/v1` | URL ของ API ที่ส่งให้เว็บบราวเซอร์ของ Client เรียกใช้งาน (หากใช้งานผ่าน Nginx ให้ตั้งเป็น `http://localhost/api/v1` หรือโดเมนจริง) |

---

## ขั้นตอนการสร้างและปรับแต่งไฟล์ `.env`

### 1. คัดลอกไฟล์จากตัวอย่าง
```bash
cp .env.example .env
```

### 2. การสร้างคีย์สุ่มความปลอดภัยสูง (Secure Random Keys Generation)
ท่านสามารถสร้างสตริงสุ่มความยาว 64 ตัวอักษรสำหรับ `JWT_SECRET` และ `COOKIE_SECRET` ด้วยคำสั่ง OpenSSL:

```bash
# สุ่มคีย์ความยาว 32 bytes (64 hex characters)
openssl rand -hex 32
```

นำค่าที่ได้ไปแทนที่ในไฟล์ `.env`:
```ini
JWT_SECRET=4f8b9a2d3e1c7f5a6b0c8d9e2f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a
COOKIE_SECRET=9a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b
```

---

## วิธีตรวจสอบความถูกต้องของ Configuration
รันสคริปต์ตรวจสอบการอ่านค่า Environment ของ Express API:

```bash
npm run test --workspace=@geomonitor/api
```
หากค่าตัวแปรถูกต้อง ชุดทดสอบจะโหลดค่าและผ่านการทดสอบ 100%

---

## ขั้นตอนถัดไป
เมื่อกำหนดค่าตัวแปรสภาพแวดล้อมเสร็จสิ้น ให้ศึกษาขั้นตอนการสตาร์ตระบบใน [04-start-system.md](04-start-system.md)
