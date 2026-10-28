# GeoMonitor 3D — REST API Specification (`/api/v1`)

Base URL: `http://localhost:4000/api/v1`

All responses follow a consistent envelope structure:
```json
{
  "success": true,
  "data": { ... },
  "message": "ข้อความตอบกลับภาษาไทย/อังกฤษ (optional)"
}
```
Error format:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ข้อมูลไม่ถูกต้องตามรูปแบบที่กำหนด",
    "details": [ ... ]
  }
}
```

---

## 1. Authentication Endpoints

### `POST /api/v1/auth/login`
- **Request Body**:
  ```json
  {
    "email": "analyst@geomonitor.local",
    "password": "Password123!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "jwt_token_here",
      "user": {
        "id": "c1f7a0b3-1b94-4d2c-8b89-112233445566",
        "email": "analyst@geomonitor.local",
        "fullName": "ธีรภัทร วงศ์เจริญ (Lead GIS Analyst)",
        "role": "analyst"
      }
    }
  }
  ```
  *(Also sets secure HTTP-only cookie `refresh_token`)*

### `POST /api/v1/auth/refresh`
- Refreshes access token using the HTTP-only cookie.

### `POST /api/v1/auth/logout`
- Clears refresh cookie and revokes session.

### `GET /api/v1/auth/me`
- Returns currently logged-in user details and permissions.

---

## 2. Area Management (`/api/v1/areas`)

### `GET /api/v1/areas`
- **Query Params**: `search`, `projectId`, `status`, `page`, `limit`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "a90b7914-1e03-455b-80cb-563b71120001",
          "name": "นิคมอุตสาหกรรมมาบตาพุด เฟส 3 (Map Ta Phut Phase 3)",
          "description": "โครงการถมทะเลและก่อสร้างท่าเรือก๊าซธรรมชาติเหลว LNG Terminal",
          "boundary": {
            "type": "Polygon",
            "coordinates": [[[101.1234, 12.6789], [101.1345, 12.6789], [101.1345, 12.6890], [101.1234, 12.6890], [101.1234, 12.6789]]]
          },
          "areaSqm": 1254300.5,
          "status": "monitoring",
          "surveyCount": 5,
          "latestSurveyDate": "2026-03-15T08:30:00.000Z",
          "createdAt": "2026-01-10T02:00:00.000Z"
        }
      ],
      "total": 1,
      "page": 1,
      "limit": 20
    }
  }
  ```

### `POST /api/v1/areas`
- **Request Body**:
  ```json
  {
    "projectId": "p1f7a0b3-1b94-4d2c-8b89-112233445566",
    "name": "พื้นที่เหมืองหิน ปากช่อง นครราชสีมา",
    "description": "สำรวจปริมาตรการขุดเจาะประจำไตรมาส",
    "boundary": {
      "type": "Polygon",
      "coordinates": [[[101.401, 14.652], [101.415, 14.652], [101.415, 14.665], [101.401, 14.665], [101.401, 14.652]]]
    }
  }
  ```
- **Validation**: GeoJSON Polygon coordinates must be valid and closed. Calculates `area_sqm` via PostGIS `ST_Area`.

---

## 3. Drone Surveys & Deliverables

### `GET /api/v1/areas/:areaId/surveys`
- List historical surveys for the specified area ordered chronologically.

### `POST /api/v1/areas/:areaId/surveys`
- Register a new drone survey record:
  ```json
  {
    "surveyCode": "SRV-MTP-2026-04",
    "surveyDate": "2026-04-10T09:00:00Z",
    "droneModel": "DJI Matrice 350 RTK",
    "sensorType": "Zenmuse P1 45MP",
    "flightAltitudeM": 120.0,
    "groundSampleDistanceCm": 2.5,
    "crsHorizontal": "EPSG:4326",
    "crsVertical": "WGS84 Ellipsoidal"
  }
  ```

### `POST /api/v1/surveys/:id/assets`
- Request upload or register deliverable (Orthomosaic, GeoTIFF, DSM, DTM, 3D Tiles, GeoJSON).
- Returns presigned S3 upload URL or registers uploaded metadata with SHA256 checksum.

### `POST /api/v1/surveys/:id/process`
- Dispatches background photogrammetry/raster tiling BullMQ pipeline.

---

## 4. Change Analysis & Volume Calculations

### `POST /api/v1/areas/:areaId/change-analyses`
- **Request Body**:
  ```json
  {
    "baselineSurveyId": "srv-001-uuid",
    "comparisonSurveyId": "srv-002-uuid",
    "analysisType": "combined",
    "signConvention": "Positive=Fill/ElevationGain, Negative=Cut/Excavation"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "ca-789-uuid",
      "areaId": "a90b7914-1e03-455b-80cb-563b71120001",
      "baselineSurveyDate": "2026-01-15T08:00:00Z",
      "comparisonSurveyDate": "2026-03-15T08:30:00Z",
      "totalChangeAreaSqm": 45200.0,
      "cutVolumeM3": 182400.0,
      "fillVolumeM3": 65300.0,
      "netVolumeM3": -117100.0,
      "status": "pending_review",
      "featureCount": 4
    }
  }
  ```

### `GET /api/v1/change-analyses/:id/features`
- Returns vector polygon features with attributes (Cut/Fill, area, mean elevation change, confidence, confirmation status).

### `POST /api/v1/change-features/:id/review`
- Update review status: `confirmed_change`, `false_positive_shadow`, `false_positive_vegetation`, `false_positive_misalignment`.

---

## 5. Reports & Audit Trail

### `POST /api/v1/reports`
- Generates PDF or CSV survey comparison report.
### `GET /api/v1/reports/:id/download`
- Returns presigned download link.
### `GET /api/v1/audit/logs`
- Filterable audit logs of user actions.
