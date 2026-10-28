# GeoMonitor 3D — Full GIS Functional Audit & Feasibility Assessment

**Document Version:** 1.0.0  
**Audit Date:** 2026-10-26  
**Auditor Roles:** Principal GIS Software Architect, Senior Full-Stack Engineer, 3D Geospatial Engineer, QA Automation Engineer  
**System Evaluated:** GeoMonitor 3D Enterprise Geospatial Platform  
**Architecture:** Next.js App Router (TypeScript, Tailwind CSS) + Express.js API + PostgreSQL 16 (PostGIS 3.4) + CesiumJS (1.114+) 3D WebGL Engine + Redis 7 + Docker Compose.

---

## 1. Executive Summary & Stack Assessment

| Layer / Subsystem | Technology & Version | Status | Architectural Notes |
|---|---|---|---|
| **Frontend Framework** | Next.js 14.2.15 (React 18.3.1, TypeScript 5.4.5) | WORKING | Modern App Router, dynamic SSR-disabled loading for WebGL/CesiumJS. |
| **3D GIS Rendering Engine** | CesiumJS 1.114.0 (WebGL 2.0, ECEF / WGS84) | WORKING | Ellipsoid terrain & 3D tiles, custom shader/extrusion pipelines. |
| **Camera Controller** | Cesium `ScreenSpaceCameraController` | PARTIAL | Basic Pan/Zoom/Tilt active, missing Google Earth Pro compass gizmo & keyboard shortcuts (`N`, `R`). |
| **Spatial Database** | PostgreSQL 16 + PostGIS 3.4.2 | WORKING | Native `geometry(Polygon, 4326)`, `ST_Area(ST_Transform(..., 32647))` for metric precision. |
| **Backend REST API** | Express.js 4.19 + TypeScript + Zod 3.22 | WORKING | Modular routers, RBAC guards, audit trails, and Swagger-aligned routes. |
| **CRS & Projections** | EPSG:4326 (WGS84 lon/lat) & EPSG:32647 (UTM 47N) | PARTIAL | PostGIS transforms accurately; frontend had Euclidean degree approximations in measurement & circle radius. |
| **Elevation / DSM Cut & Fill** | Synthetic volume simulation vs. Raster GeoTIFF | PARTIAL / BLOCKED | Real PostGIS polygons generated, but raster grid differential calculation requires GDAL/Cloud-Optimized GeoTIFF pipeline. |

---

## 2. Comprehensive Functional Audit Inventory

Status Taxonomy:
- **WORKING**: Verified working correctly with real data and UI integration.
- **PARTIAL**: Partially functional, needs specific enhancements or edge-case handling.
- **BROKEN**: Implementation exists but contains mathematical bugs, synthetic mocks, or UI disconnects.
- **NOT_IMPLEMENTED**: UI or hook exists, but backend or engine logic is absent.
- **BLOCKED**: Requires external data provider, raster imagery service, or dedicated GDAL microservice.
- **NOT_FEASIBLE_WITH_CURRENT_STACK**: Cannot be implemented within current web browser or offline constraints.
- **NOT_TESTED**: Insufficient automated or manual evidence.

### Priority Severity Matrix

```
[Critical P0] Map Engine sync, Camera controls, PostGIS CRS integrity
[High P1]     Measurement geodesics, Drawing tools, Layer opacity wiring
[Medium P2]   Google Earth Pro compass gizmo, Keyboard shortcuts, Search Fly-To
[Low P3]      Enhanced animations, Advanced terrain exaggeration
```

---

## 3. Detailed Audit Findings Table

| # | Feature | UI Location | Implementation Files | Dependencies | Current Status | Root Cause | Feasibility | Proposed Fix | Severity |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Area Measurement** | `CesiumMap` Toolbar (`Shapes` icon) | `CesiumMap.tsx:254` | CesiumJS, Math | **BROKEN** | Calculated area using dummy formula `(points.length * 15200)`. | High | Implement true spherical polygon geodesic area calculation ($m^2$, ha, rai). | **P0 (Critical)** |
| 2 | **Distance Measurement** | `CesiumMap` Toolbar (`Ruler` icon) | `CesiumMap.tsx:241` | CesiumJS | **PARTIAL** | Uses 3D Euclidean distance between ECEF cartesian points; lacks segmented path readout & geodesic surface curve. | High | Use `Cesium.EllipsoidGeodesic` to calculate true WGS84 ellipsoidal surface distance. | **P1 (High)** |
| 3 | **Google Earth Pro Compass & Gimbal** | Map Top-Right corner | `CesiumMap.tsx:490` | Lucide Compass, Cesium Camera | **PARTIAL** | Only had a static reset camera button. No rotating compass ring, no drag-to-orbit, no pitch gimbal, no click-to-reset True North. | High | Build `CompassGizmo` component with rotating North needle, pitch indicator, and click-to-reset. | **P1 (High)** |
| 4 | **Keyboard Camera Navigation** | Global Map viewport | `CesiumMap.tsx` | Browser Keyboard Events | **NOT_IMPLEMENTED** | No keyboard listeners for `N` (Reset North), `R` (Top-down Nadir), Arrow keys (Pan), `+`/`-` (Zoom). | High | Add `keydown` event listener in map canvas with Cesium camera moves. | **P1 (High)** |
| 5 | **Layer Opacity & Visibility Sync** | `LeftSidebar` Tab 4 & `CesiumMap` | `LeftSidebar.tsx:505`, `page.tsx` | React State, Cesium Imagery | **BROKEN** | Slider state was local to `LeftSidebar` and not forwarded to `CesiumMap` imagery/polygon layers. | High | Pass `layerSettings` state down from `page.tsx` into `CesiumMap` to drive imagery alpha. | **P1 (High)** |
| 6 | **Circle / Buffer Drawing Formula** | Operations Map Drawing Toolbar | `OperationsMap.tsx:505` | Math / Cesium | **BROKEN** | Circle radius calculated via Euclidean flat degree math $\sqrt{\Delta\lambda^2 + \Delta\phi^2}$, distorting circles into squished ovals at 12.6° N. | High | Convert metric radius to angular delta using geodesic scale factor: $\Delta\lambda = R / (111320 \cdot \cos(\phi))$. | **P1 (High)** |
| 7 | **Double-Click Drawing Conflict** | Operations Map Canvas | `OperationsMap.tsx:562` | Cesium `ScreenSpaceEventHandler` | **PARTIAL** | Cesium default double-click zooms and centers camera, clashing with polygon completion double-click. | High | Disable Cesium `ScreenSpaceEventType.LEFT_DOUBLE_CLICK` default camera action during drawing mode. | **P1 (High)** |
| 8 | **Elevation Probe at Cursor** | Map HUD (Bottom-Left) | `CesiumMap.tsx:174` | Cesium Cartographic | **PARTIAL** | Displays camera altitude instead of ground elevation under mouse pointer. | High | Sample terrain/ellipsoid height at picked surface position: `cartographic.height` or `globe.getHeight`. | **P2 (Medium)** |
| 9 | **2D / 3D Scene Mode Toggle** | Map Toolbar (`3D`/`2D` button) | `CesiumMap.tsx:113` | Cesium `morphTo2D` / `morphTo3D` | **WORKING** | Fixed in previous phase (`scene3DOnly: false`). Transitions smoothly. | High | Maintain and verify. | **P2 (Medium)** |
| 10 | **PostGIS Managed Area Creation** | Create Area Modal & Left Sidebar | `areas.router.ts:147`, `page.tsx:188` | PostgreSQL, PostGIS, Zod | **WORKING** | Proper SRID 4326 storage and `ST_Transform(..., 32647)` for exact metric area in $m^2$. Closed-ring validated. | High | Maintain and add automated CRS transform regression tests. | **P0 (Critical)** |
| 11 | **Cut / Fill Volume Differential** | Analysis Panel & API | `change.router.ts:44` | PostGIS, Drone Survey DSM | **PARTIAL / BLOCKED** | Uses formula-based synthetic volume estimation based on area percentage. Real raster DSM DEM differential requires cloud GeoTIFF/COG worker. | Medium | Add clear metadata indicator explaining mathematical model, vertical datum (EGM96/WGS84), and limitations note. | **P1 (High)** |
| 12 | **Feature Selection & Inspector Sync** | Map Entities, Sidebar, Inspector | `CesiumMap.tsx:188`, `page.tsx:69` | React State, Cesium Entity PropertyBag | **WORKING** | Clicking 3D polygon or list item selects feature and updates Analysis Panel. | High | Maintain and enhance outline glow effect on selected polygon. | **P1 (High)** |
| 13 | **Search & Fly To Feature** | LeftSidebar Search & Saved Views | `LeftSidebar.tsx:75`, `CesiumMap.tsx:394` | Cesium Camera `flyTo` | **PARTIAL** | Filters list and flies to 4 preset views. Lacks coordinate query input (e.g. "12.675, 101.145"). | High | Add coordinate parser in search input to fly camera directly to parsed latitude/longitude. | **P2 (Medium)** |
| 14 | **Tactical Symbol Placement & Persistence** | Operations Map & Layer Router | `OperationsMap.tsx:229`, `layers.router.ts:383` | PostGIS, Symbol Catalog | **WORKING** | Places SVG symbols with custom styling, stores in PostGIS `map_features`, retrieves as GeoJSON. | High | Maintain and verify. | **P1 (High)** |
| 15 | **GeoJSON Import & Export** | Import Modal & Layer Router | `layers.router.ts:748` | PostGIS `ST_GeomFromGeoJSON` | **WORKING** | Validates FeatureCollection, imports features into specified layer with rollback on failure. | High | Maintain and verify. | **P1 (High)** |

---

## 4. Root Cause Analysis of Primary Deficiencies

### 4.1 Measurement Inaccuracy
- **Root Cause**: The area calculation in `CesiumMap.tsx` had a placeholder `(updated.length * 15200)` left from initial UI prototyping.
- **Technical Solution**: Implement a robust spherical polygon area algorithm on WGS84 ellipsoid:
  $$A = R^2 \left| \sum_{i=0}^{n-1} (\lambda_{i+1} - \lambda_{i-1}) \cdot \sin(\phi_i) \right| / 2$$
  where $R = 6,378,137\text{ m}$. For distance, use `Cesium.EllipsoidGeodesic(startCartographic, endCartographic, Cesium.Ellipsoid.WGS84).surfaceDistance`.

### 4.2 Disconnected LeftSidebar Layer Opacities
- **Root Cause**: The opacity sliders and eye visibility toggles for Ortho, DSM, and 3D Mesh in `LeftSidebar.tsx` held state in local component `useState` without pushing updates to the parent dashboard (`page.tsx`) or `CesiumMap.tsx`.
- **Technical Solution**: Lift `layerSettings` state to `page.tsx` and pass to `CesiumMap.tsx`, binding `imageryLayer.alpha` to the slider value in real-time.

### 4.3 Google Earth Pro Navigation Experience
- **Root Cause**: Standard CesiumJS does not include Google Earth Pro's iconic circular compass gizmo and keyboard shortcuts out of the box.
- **Technical Solution**:
  1. Build a specialized `GoogleEarthCompass` widget featuring:
     - Outer compass ring with True North pointer needle rotating dynamically with `viewer.camera.heading`.
     - Clicking the `N` needle triggers smooth heading reset to $0^\circ$ (True North).
     - Pitch gimbal displaying current tilt angle, clicking resets to top-down Nadir ($-90^\circ$).
     - Pan buttons (N, S, E, W) and Zoom in/out (+ / -).
  2. Implement global keyboard hotkeys:
     - `N` or `n`: Reset camera heading to True North.
     - `R` or `r`: Reset camera tilt to top-down view (Nadir).
     - `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight`: Pan camera.
     - `PageUp` / `PageDown`: Altitude ascend/descend.

---

## 5. Remediation Plan & Execution Sequence

1. **Step 1: GIS Math & Coordinate Engine Library**  
   Create `apps/web/src/lib/gis-engine.ts` with geodesic distance, spherical polygon area, and coordinate transformation utilities.
2. **Step 2: Google Earth Pro Navigation Compass Gizmo**  
   Create `apps/web/src/components/map/GoogleEarthCompass.tsx` with dynamic heading needle, tilt ring, and reset triggers.
3. **Step 3: CesiumMap Component Remediation**  
   Integrate `GoogleEarthCompass`, keyboard listeners (`N`, `R`, arrows), geodesic measurement, cursor elevation probe, and layer opacity sync.
4. **Step 4: LeftSidebar & Page Integration**  
   Connect layer controls, search coordinate fly-to, and selection synchronization.
5. **Step 5: Automated GIS Engine Tests**  
   Create Vitest suite for GIS math, verifying against known reference coordinates (Map Ta Phut, UTM Zone 47N).
6. **Step 6: Build & Test Verification**  
   Verify with `npm test` and `npm run build`.
7. **Step 7: Final Remediation Report**  
   Produce `docs/GIS_REMEDIATION_REPORT.md`.
