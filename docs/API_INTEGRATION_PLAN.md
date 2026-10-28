# GeoMonitor 3D — Express API & PostGIS Integration Plan

This plan establishes the connection architecture between the **Next.js Frontend (Command Center)**, the **Express.js REST API (`/api/v1`)**, the **PostgreSQL 16 + PostGIS 3.4 database**, and the **BullMQ Asynchronous Processing Pipeline**.

---

## 1. Architecture Flow

```
[Next.js Client Components]
            │
            ▼  (apiFetch with JWT Bearer & Credentials)
   [Express.js /api/v1 Gateway]
      ├── /auth          -> JWT Token Rotation & Session
      ├── /areas         -> PostGIS ST_AsGeoJSON & ST_Area UTM Projections
      ├── /surveys       -> Survey Records & S3 Deliverable URLs
      ├── /change        -> Cut/Fill Volume Calculations & Feature GeoJSON
      ├── /reports       -> On-the-fly PDF and CSV Streaming
      └── /dashboard     -> Real-time Aggregated Intelligence Metrics
            │
      ┌─────┴───────────────────────┐
      ▼                             ▼
[PostgreSQL 16 + PostGIS]     [Redis 7 + BullMQ]
 - spatial GiST indexing       - background photogrammetry
 - ST_Transform EPSG:32647     - GDAL COG raster tiling
 - immutable audit logs        - DSM diff & volume calculation
```

---

## 2. Spatial PostGIS Query Patterns

### A. Area Retrieval with GeoJSON Boundary
```sql
SELECT 
  m.id,
  m.project_id AS "projectId",
  p.name AS "projectName",
  m.name,
  m.description,
  ST_AsGeoJSON(m.boundary)::json AS boundary,
  m.area_sqm AS "areaSqm",
  m.status,
  COUNT(s.id)::int AS "surveyCount",
  MAX(s.survey_date) AS "latestSurveyDate"
FROM managed_areas m
JOIN projects p ON m.project_id = p.id
LEFT JOIN drone_surveys s ON m.id = s.area_id
WHERE m.status = 'active' OR m.status = 'monitoring'
GROUP BY m.id, p.name
ORDER BY m.updated_at DESC;
```

### B. Accurate Metric Area Calculation via PostGIS UTM Projection
To calculate the true physical surface area in square meters for Thailand without distortion from degree coordinates:
```sql
INSERT INTO managed_areas (project_id, name, description, boundary, area_sqm, status, created_by)
VALUES (
  $1, $2, $3,
  ST_SetSRID(ST_GeomFromGeoJSON($4), 4326),
  ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326), 32647)), -- UTM Zone 47N
  $5, $6
)
RETURNING id, area_sqm;
```

### C. Change Polygons Extraction for Cesium 3D Extrusion
```sql
SELECT 
  f.id,
  f.feature_type AS "featureType",
  ST_AsGeoJSON(f.geometry)::json AS geometry,
  f.area_sqm AS "areaSqm",
  f.mean_elevation_change_m AS "meanElevationChangeM",
  f.max_elevation_change_m AS "maxElevationChangeM",
  f.estimated_volume_m3 AS "estimatedVolumeM3",
  f.is_confirmed AS "isConfirmed",
  f.confidence
FROM change_features f
WHERE f.change_analysis_id = $1
ORDER BY f.area_sqm DESC;
```

---

## 3. Frontend TanStack Query Integration Matrix

| Endpoint | Method | Frontend Hook / Usage | Cache Key |
|---|---|---|---|
| `/areas` | `GET` | `useAreas()` | `['areas']` |
| `/areas/:id/surveys` | `GET` | `useSurveys(areaId)` | `['surveys', areaId]` |
| `/change-analyses/:id/features` | `GET` | `useChangeFeatures(analysisId)` | `['change-features', analysisId]` |
| `/change-features/:id/review` | `POST` | `useMutation(reviewFeature)` | Invalidates `['change-features']` |
| `/dashboard/metrics` | `GET` | `useDashboardMetrics()` | `['dashboard-metrics']` (30s stale) |
| `/reports` | `POST` | `useMutation(generateReport)` | Returns report ID for instant download |

---

## 4. Asynchronous Photogrammetry Worker Integration

1. **Upload Phase**: User uploads drone raw deliverables (Orthomosaic, DSM, LAZ point clouds) to `/api/v1/surveys/:id/assets`. Files are placed in MinIO S3 object storage.
2. **Dispatch Phase**: Endpoint `POST /api/v1/surveys/:id/process` enqueues a job into BullMQ queue `geomonitor-jobs`.
3. **Execution Phase**: `apps/worker` receives the job:
   - Validates EXIF and GCP coordinate references.
   - Converts GeoTIFF rasters into Cloud Optimized GeoTIFF (COG) with GDAL.
   - Computes elevation difference matrix $\Delta Z = Z_{\text{cmp}} - Z_{\text{base}}$.
   - Calculates cell-by-cell Cut & Fill volume in cubic meters.
   - Writes detected vector polygon features into `change_features` table.
4. **Polling & WebSocket Phase**: Frontend polls `GET /api/v1/jobs/:jobId` (rendered in `ProcessingIndicator.tsx`) displaying real-time progress percentages (0% -> 25% -> 50% -> 75% -> 100%).
