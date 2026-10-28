# GeoMonitor 3D — Component Inventory

This document outlines the UI component hierarchy, responsibilities, and design system tokens implemented for the **GeoMonitor 3D** GIS command center.

---

## 1. Design System Tokens (Dark Navy + Cyan Accent)

| Token | Hex / Value | Usage |
|---|---|---|
| `navy-950` | `#070c18` | Deep space canvas, root background |
| `navy-900` | `#0b132b` | Primary command center panels, navigation bars |
| `navy-850` | `#0f1a38` | Card backgrounds, elevated surfaces |
| `navy-800` | `#142247` | Borders, subtle dividers, pill containers |
| `cyan-400` | `#22d3ee` | Primary neon highlight, active states, Cesium pins |
| `cyan-500` | `#06b6d4` | Interactive buttons, glow shadows |
| `cut` (Rose) | `#f43f5e` | Excavation / Cut earthwork ($-\Delta Z$) |
| `fill` (Emerald) | `#10b981` | Accretion / Fill earthwork ($+\Delta Z$) |
| `amber` | `#f59e0b` | Unverified candidates, warning indicators, demo badge |

---

## 2. Reusable Component Inventory

### A. Core Layout & Navigation
| Component | File Path | Props & Description |
|---|---|---|
| `Navbar` | `apps/web/src/components/layout/Navbar.tsx` | **Props:** `areas`, `selectedAreaId`, `onSelectArea`, `swipeMode`, `onToggleSwipe`<br>• Top command center bar with brand logo, project selector, global search (`⌘K`), notifications bell, and user profile pill with role badge. |
| `LeftSidebar` | `apps/web/src/components/layout/LeftSidebar.tsx` | **Props:** `areas`, `selectedAreaId`, `onSelectArea`, `onSelectSavedView`, `onOpenCreateArea`<br>• 4-tab panel: 📁 Project Folders, 📍 Managed Areas, 👁️ Saved Views (LNG Terminal, Cut Basin, Reclamation Fill, 3D Overview), and 🗺️ Layer Navigation (Orthomosaic, DSM, 3D Tiles opacity sliders). |
| `RightInspector` / `AnalysisPanel` | `apps/web/src/components/analysis/AnalysisPanel.tsx` | **Props:** `areaName`, `areaSqm`, `cutVolumeM3`, `fillVolumeM3`, `netVolumeM3`, `confidenceScore`, `features`, `onReviewFeature`, `onGenerateReport`<br>• Collapsible 3-tab inspector: Cut/Fill Volume breakdown with Recharts bar chart, Change Features list with Analyst review buttons (`✓ Confirm`, `✗ False Positive`), and Technical metadata (PostGIS CRS, area in rai/sqm). |
| `SurveyTimeline` | `apps/web/src/components/timeline/SurveyTimeline.tsx` | **Props:** `surveys`, `baselineSurveyId`, `comparisonSurveyId`, `onSelectBaseline`, `onSelectComparison`, `swipeMode`, `swipePosition`, `onSwipeChange`<br>• Historical survey timeline with date chips, baseline/comparison selectors, and interactive swipe slider (0% to 100%). |

### B. Map & Geospatial Visualization
| Component | File Path | Props & Description |
|---|---|---|
| `CesiumMap` | `apps/web/src/components/map/CesiumMap.tsx` | **Props:** `areas`, `selectedAreaId`, `changeFeatures`, `swipeMode`, `swipePosition`, `savedViewKey`<br>• Interactive CesiumJS 3D Globe with satellite imagery, terrain, PostGIS polygon rendering with labels, 3D extruded Cut/Fill models, real-time coordinate inspection HUD, distance/area measurement tools, and split-screen comparison slider. |
| `ChangeLegend` | `apps/web/src/components/map/ChangeLegend.tsx` | **Props:** `visibleLayers`, `onToggleLayer`<br>• Floating legend on the map canvas with toggleable eye icons for Cut, Fill, New Structures, and PostGIS Boundaries. |

### C. Dashboard & Processing Feedback
| Component | File Path | Props & Description |
|---|---|---|
| `MetricHUD` | `apps/web/src/components/dashboard/MetricHUD.tsx` | **Props:** `metrics` (totalAreas, completedSurveys, totalCutVolumeM3, totalFillVolumeM3)<br>• Floating, collapsible glassmorphic HUD bar at top center of 3D canvas displaying core GIS intelligence metrics. |
| `ProcessingIndicator` | `apps/web/src/components/processing/ProcessingIndicator.tsx` | **Props:** `job`, `onClose`<br>• Real-time BullMQ background pipeline tracker showing stage progress (Georeferencing -> SfM -> Tiling -> DSM -> Volume Calc) with worker logs viewer. |
| `DemoNoticeBadge` | `apps/web/src/components/common/StateViews.tsx` | • Fixed disclaimer pill: "⚠️ ข้อมูลจำลองสำหรับสาธิต (Simulated Demo Data) — ไม่ใช่ข้อมูลโทรมาตรการบินจริง". |
| `EmptyState` | `apps/web/src/components/common/StateViews.tsx` | • Displayed when no areas or surveys exist, prompting user to create a new managed area. |
| `LoadingState` | `apps/web/src/components/common/StateViews.tsx` | • Polished spinner with cyan glow for asynchronous fetching. |
| `ErrorState` | `apps/web/src/components/common/StateViews.tsx` | • Graceful error panel with retry button when backend connection fails. |

### D. shadcn-Inspired Primitives
| Component | File Path | Variants |
|---|---|---|
| `Button` | `apps/web/src/components/ui/primitives.tsx` | `primary`, `cyan`, `secondary`, `outline`, `ghost`, `danger` |
| `Badge` | `apps/web/src/components/ui/primitives.tsx` | `cyan`, `emerald`, `amber`, `rose`, `slate`, `outline` |
| `Card` | `apps/web/src/components/ui/primitives.tsx` | Standard glassmorphic navy panel with cyan border glow |
