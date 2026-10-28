'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Modal, Button } from '@/components/ui/primitives';
import MissionConfigPanel from '@/components/missions/MissionConfigPanel';
import MissionValidationPanel from '@/components/missions/MissionValidationPanel';
import WaypointTimelineBar from '@/components/missions/WaypointTimelineBar';
import MapLayerControl from '@/components/missions/MapLayerControl';
import ExportModal from '@/components/missions/ExportModal';
import ImportKmlModal from '@/components/operations/ImportKmlModal';
import { LoadingState } from '@/components/common/StateViews';
import {
  calculatePhotogrammetry,
  generatePhotogrammetryMission,
  FlightLineSegment,
  PhotoCapturePosition,
  CameraFootprintBox,
  validateDroneMission,
  CAMERA_PRESETS,
} from '@/lib/drone-route-generator';
import { DroneMissionDTO, DroneWaypointDTO, ValidationStatus, ValidationIssue, PlatformId, MissionWorkflowState } from '@geomonitor/shared';
import { apiFetch } from '@/lib/api';
import {
  FolderOpen,
  X,
  Plus,
  Plane,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { DroneInteractionMode, DroneMapLayerVisibility } from '@/components/map/CesiumMap';
import { useDeviceLocation, generateDefaultSurveyPolygon } from '@/lib/geolocation';

// Dynamically import the unified CesiumMap with SSR disabled
const CesiumMap = dynamic(() => import('@/components/map/CesiumMap'), {
  ssr: false,
  loading: () => <LoadingState message="กำลังเริ่มต้น CesiumJS 3D Globe & WebGL Engine..." />,
});

export default function DroneMissionPlannerPage() {
  // Mission basic info
  const [missionId, setMissionId] = useState<string | null>(null);
  const [name, setName] = useState('ภารกิจสำรวจภาพถ่ายทางอากาศ 3D');
  const [description, setDescription] = useState('วางแผนแนวบินสำรวจภูมิประเทศและจัดทำแบบจำลองความสูง');
  const [targetPlatform, setTargetPlatform] = useState<PlatformId>('dji_mini_4_pro');
  const [droneModel, setDroneModel] = useState('DJI Mini 4 Pro');
  const [cameraModel, setCameraModel] = useState('DJI Mini 4 Pro (Wide 24mm - 48MP)');
  const [missionType, setMissionType] = useState('grid_survey');
  const [finishAction, setFinishAction] = useState('return_to_home');

  // Flight parameters
  const [flightSpeedMps, setFlightSpeedMps] = useState(8.0);
  const [targetAltitudeM, setTargetAltitudeM] = useState(80.0);
  const [altitudeReference, setAltitudeReference] = useState<'relative_to_home' | 'agl' | 'amsl'>('relative_to_home');
  const [rthAltitudeM, setRthAltitudeM] = useState(60.0);
  const [turnStrategy, setTurnStrategy] = useState<'to_point_and_stop' | 'curve_through'>('to_point_and_stop');

  // Device Bridge & Upload states
  const [isBridgeConnected, setIsBridgeConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadState, setUploadState] = useState<string>('IDLE');

  // Photogrammetry & Grid settings
  const [forwardOverlap, setForwardOverlap] = useState(80);
  const [sideOverlap, setSideOverlap] = useState(70);
  const [gridAngleDeg, setGridAngleDeg] = useState(45);

  // Device GPS Location from Geolocation Lib (Immediate auto-detection on entering system)
  const { location: deviceLocation, status: gpsStatus } = useDeviceLocation({ autoDetect: true });

  // Geometry
  const [polygon, setPolygon] = useState<[number, number][]>([]);
  const [homePoint, setHomePoint] = useState<[number, number, number] | null>(null);
  const [takeoffPoint, setTakeoffPoint] = useState<[number, number, number] | null>(null);
  const [landingPoint, setLandingPoint] = useState<[number, number, number] | null>(null);

  // Workflow State Machine (EMPTY -> AREA_DEFINED -> READY_TO_CALCULATE -> CALCULATING -> CALCULATED / EXPORT_READY -> OUTDATED)
  const [workflowState, setWorkflowState] = useState<MissionWorkflowState>('EMPTY');

  // Generated Flight Plan & Photogrammetry Elements
  const [waypoints, setWaypoints] = useState<DroneWaypointDTO[]>([]);
  const [flightLines, setFlightLines] = useState<FlightLineSegment[]>([]);
  const [photoPositions, setPhotoPositions] = useState<PhotoCapturePosition[]>([]);
  const [sampleFootprints, setSampleFootprints] = useState<CameraFootprintBox[]>([]);
  const [gimbalPitchDeg, setGimbalPitchDeg] = useState<number>(-90);
  const [orbitRadiusM, setOrbitRadiusM] = useState<number>(50);
  const [corridorWidthM, setCorridorWidthM] = useState<number>(80);
  const [captureMode, setCaptureMode] = useState<'distance_interval' | 'time_interval' | 'stop_and_shoot'>('distance_interval');
  const [detailedEstimates, setDetailedEstimates] = useState<any>(null);
  const [totalDistanceM, setTotalDistanceM] = useState(0);
  const [flightLinesCount, setFlightLinesCount] = useState(0);
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number | null>(null);

  // GPS Location Handlers
  const handleUserLocationDetected = useCallback((coords: { longitude: number; latitude: number; accuracy: number }) => {
    setHomePoint((prev) => prev ?? [coords.longitude, coords.latitude, targetAltitudeM]);
    setTakeoffPoint((prev) => prev ?? [coords.longitude, coords.latitude, targetAltitudeM]);
  }, [targetAltitudeM]);

  // Device GPS Location sets initial home/takeoff point coordinates only (NO automatic mission or polygon generation)
  useEffect(() => {
    if (deviceLocation) {
      setHomePoint((prev) => prev ?? [deviceLocation.longitude, deviceLocation.latitude, targetAltitudeM]);
      setTakeoffPoint((prev) => prev ?? [deviceLocation.longitude, deviceLocation.latitude, targetAltitudeM]);
    }
  }, [deviceLocation, targetAltitudeM]);

  // Rule 3: User input controls result - Parameter changes transition state to OUTDATED until recalculated
  const isInitialMount = React.useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setWorkflowState((prev) => (prev === 'CALCULATED' || prev === 'EXPORT_READY' ? 'OUTDATED' : prev));
  }, [
    targetAltitudeM,
    flightSpeedMps,
    gridAngleDeg,
    forwardOverlap,
    sideOverlap,
    cameraModel,
    missionType,
    gimbalPitchDeg,
    orbitRadiusM,
    corridorWidthM,
    turnStrategy,
    captureMode,
    targetPlatform,
  ]);

  // Panels collapse states - Right panel collapsed by default for spacious 3D map
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  // Active Planning Step (1: พื้นที่ -> 2: ตั้งค่า -> 3: คำนวณ -> 4: ตรวจสอบ -> 5: ส่งออก)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Separate Map Layers Visibility State
  const [mapLayerVisibility, setMapLayerVisibility] = useState<DroneMapLayerVisibility>({
    surveyArea: true,
    flightLines: true,
    waypoints: true,
    photoPositions: true,
    footprints: true,
    markers: true,
    managedAreas: true,
  });

  // Interaction Mode
  const [interactionMode, setInteractionMode] = useState<DroneInteractionMode>('none');

  // Backend Integration
  const [areas, setAreas] = useState<any[]>([]);
  const [savedMissions, setSavedMissions] = useState<any[]>([]);
  const [isSavedMissionsOpen, setIsSavedMissionsOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isKmlSurveyModalOpen, setIsKmlSurveyModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load existing areas and missions on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [areasRes, missionsRes] = await Promise.all([
          apiFetch<any>('/areas').catch(() => ({ data: [] })),
          apiFetch<any>('/missions').catch(() => ({ data: [] })),
        ]);
        if (Array.isArray(areasRes?.data)) setAreas(areasRes.data);
        if (Array.isArray(missionsRes?.data)) setSavedMissions(missionsRes.data);
      } catch {
        // Fallback gracefully
      }
    }
    loadData();
  }, []);

  // Compute Photogrammetry live info
  const photogrammetryInfo = useMemo(() => {
    const preset = CAMERA_PRESETS[cameraModel] || CAMERA_PRESETS['DJI Zenmuse P1 (35mm)'];
    const customCamera = {
      ...preset,
      forwardOverlapPercent: forwardOverlap,
      sideOverlapPercent: sideOverlap,
    };
    return calculatePhotogrammetry(targetAltitudeM, customCamera, flightSpeedMps);
  }, [cameraModel, forwardOverlap, sideOverlap, targetAltitudeM, flightSpeedMps]);

  // Polygon change handler - tracks workflow transition
  const handlePolygonChange = useCallback((newPoly: [number, number][]) => {
    setPolygon(newPoly);
    if (newPoly.length < 3 && missionType !== 'orbit_poi') {
      setWorkflowState('EMPTY');
      setWaypoints([]);
      setFlightLines([]);
      setPhotoPositions([]);
      setSampleFootprints([]);
      setTotalDistanceM(0);
      setFlightLinesCount(0);
      setDetailedEstimates(null);
    } else {
      setWorkflowState((prev) => {
        if (prev === 'CALCULATED' || prev === 'EXPORT_READY') {
          return 'OUTDATED';
        }
        return 'READY_TO_CALCULATE';
      });
    }
  }, [missionType]);

  // Explicit Flight Plan Calculation (STEP 3) - Triggered ONLY upon clicking Calculate button
  const handleCalculateFlightPlan = useCallback(() => {
    if (polygon.length < 3 && missionType !== 'orbit_poi') {
      setWorkflowState('VALIDATION_FAILED');
      setNotification({
        type: 'error',
        message: 'กรุณากำหนดขอบเขตพื้นที่สำรวจ (Draw Survey Area) อย่างน้อย 3 จุดก่อนคำนวณ',
      });
      return;
    }

    if (targetAltitudeM < 10 || targetAltitudeM > 120) {
      setWorkflowState('VALIDATION_FAILED');
      setNotification({
        type: 'error',
        message: 'ระดับความสูงบินต้องอยู่ระหว่าง 10 ถึง 120 เมตร AGL ตามเกณฑ์ความปลอดภัย',
      });
      return;
    }

    setWorkflowState('CALCULATING');

    try {
      const preset = CAMERA_PRESETS[cameraModel] || CAMERA_PRESETS['DJI Mini 4 Pro (Wide 24mm - 48MP)'];
      const customCamera = {
        ...preset,
        forwardOverlapPercent: forwardOverlap,
        sideOverlapPercent: sideOverlap,
      };

      const result = generatePhotogrammetryMission({
        missionType: missionType as any,
        polygon,
        orbitConfig: {
          centerPoi: [
            polygon.length > 0 ? polygon[0][0] : (deviceLocation?.longitude ?? 100.5018),
            polygon.length > 0 ? polygon[0][1] : (deviceLocation?.latitude ?? 13.7563),
            targetAltitudeM,
          ],
          radiusMeters: orbitRadiusM,
          altitudeTiers: [targetAltitudeM],
          photosPerCircle: 24,
        },
        corridorConfig: {
          centerline: polygon,
          corridorWidthMeters: corridorWidthM,
          altitudeMeters: targetAltitudeM,
        },
        camera: customCamera,
        gridAngleDeg,
        altitudeMeters: targetAltitudeM,
        speedMps: flightSpeedMps,
        turnStrategy: turnStrategy === 'to_point_and_stop' ? 'stop_and_turn' : 'adaptive_curve',
        homePoint: homePoint ? [homePoint[0], homePoint[1], homePoint[2]] : undefined,
        gimbalPitchDeg,
        targetPlatform,
      });

      setWaypoints(result.waypoints);
      setFlightLines(result.flightLines);
      setPhotoPositions(result.photoCapturePositions);
      setSampleFootprints(result.sampleFootprints || []);
      setTotalDistanceM(result.estimates.estimatedFlightDistanceMeters);
      setFlightLinesCount(result.flightLines.length);
      setDetailedEstimates(result.estimates);
      setInteractionMode('none');
      setWorkflowState('EXPORT_READY');

      setNotification({
        type: 'success',
        message: `คำนวณแผนการบิน Photogrammetry สำเร็จ! ${result.flightLines.length} แนวบิน, ${result.photoCapturePositions.length} จุดถ่ายภาพ, ระยะทาง ${(result.estimates.estimatedFlightDistanceMeters / 1000).toFixed(2)} km`,
      });
    } catch (err: any) {
      setWorkflowState('VALIDATION_FAILED');
      setNotification({
        type: 'error',
        message: `การคำนวณผิดพลาด: ${err.message || err}`,
      });
    }
  }, [
    polygon,
    missionType,
    cameraModel,
    forwardOverlap,
    sideOverlap,
    orbitRadiusM,
    corridorWidthM,
    targetAltitudeM,
    gridAngleDeg,
    flightSpeedMps,
    turnStrategy,
    homePoint,
    gimbalPitchDeg,
    targetPlatform,
  ]);

  // Mark plan OUTDATED immediately whenever any parameter changes after a calculation
  useEffect(() => {
    if (workflowState === 'EXPORT_READY') {
      setWorkflowState('OUTDATED');
    }
  }, [
    missionType,
    targetAltitudeM,
    forwardOverlap,
    sideOverlap,
    gridAngleDeg,
    flightSpeedMps,
    turnStrategy,
    cameraModel,
    gimbalPitchDeg,
    orbitRadiusM,
    corridorWidthM,
    targetPlatform,
    altitudeReference,
  ]);

  // Compute live validation results
  const validationResult = useMemo(() => {
    return validateDroneMission({
      name,
      waypoints,
      surveyArea: { coordinates: [polygon] },
      homePoint: homePoint ? [homePoint[0], homePoint[1], homePoint[2]] : undefined,
      altitudeReference,
      flightAltitudeMeters: targetAltitudeM,
      maxAltitudeMeters: 120,
      droneModel,
      targetPlatform,
      totalDistanceMeters: totalDistanceM,
    });
  }, [name, waypoints, polygon, homePoint, altitudeReference, targetAltitudeM, droneModel, targetPlatform, totalDistanceM]);

  // Mission DTO model for Exporters
  const currentMissionDTO: DroneMissionDTO = useMemo(
    () => ({
      id: missionId || 'unsaved-mission',
      projectId: 'default-project',
      name,
      description,
      version: '2.0.0',
      targetPlatform,
      missionType: missionType as any,
      droneModel,
      crs: {
        horizontalCrs: 'EPSG:4326 (WGS84)',
        verticalDatum: 'EGM96',
        coordinateUnits: 'degrees',
      },
      cameraParams: {
        ...(CAMERA_PRESETS[cameraModel] || CAMERA_PRESETS['DJI Mini 4 Pro (Wide 24mm - 48MP)']),
        forwardOverlapPercent: forwardOverlap,
        sideOverlapPercent: sideOverlap,
      },
      altitudeReference,
      flightAltitudeMeters: targetAltitudeM,
      flightSpeedMps,
      maxAltitudeMeters: 120,
      returnToHomeAltitudeMeters: rthAltitudeM,
      surveyArea: {
        type: 'Polygon',
        coordinates: [polygon],
      },
      homePoint: homePoint || [101.1415, 12.6725, targetAltitudeM],
      takeoffPoint: takeoffPoint || undefined,
      landingPoint: landingPoint || undefined,
      gridAngleDeg,
      turnStrategy: turnStrategy === 'to_point_and_stop' ? 'stop_and_turn' : 'adaptive_curve',
      finishAction: finishAction as any,
      signalLossAction: 'return_to_home',
      waypoints,
      validationStatus: validationResult.status,
      validationIssues: validationResult.issues,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    [
      missionId,
      name,
      description,
      targetPlatform,
      droneModel,
      cameraModel,
      missionType,
      flightSpeedMps,
      targetAltitudeM,
      altitudeReference,
      rthAltitudeM,
      finishAction,
      homePoint,
      takeoffPoint,
      landingPoint,
      gridAngleDeg,
      turnStrategy,
      polygon,
      waypoints,
      validationResult,
      forwardOverlap,
      sideOverlap,
    ]
  );

  // Estimates
  const flightTimeSec = useMemo(() => {
    if (detailedEstimates?.estimatedFlightTimeSeconds) return detailedEstimates.estimatedFlightTimeSeconds;
    if (flightSpeedMps <= 0) return 0;
    return totalDistanceM / flightSpeedMps + (waypoints.length * 2);
  }, [detailedEstimates, totalDistanceM, flightSpeedMps, waypoints.length]);

  const surveyAreaM2 = useMemo(() => {
    if (detailedEstimates?.surveyAreaM2) return detailedEstimates.surveyAreaM2;
    if (polygon.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      area += polygon[i][0] * polygon[j][1];
      area -= polygon[j][0] * polygon[i][1];
    }
    const centerLat = polygon[0][1];
    const mPerDegLat = 111132.954;
    const mPerDegLon = 111412.84 * Math.cos((centerLat * Math.PI) / 180);
    return Math.round(Math.abs(area * 0.5) * mPerDegLat * mPerDegLon);
  }, [detailedEstimates, polygon]);

  const photoCount = useMemo(() => {
    if (photoPositions.length > 0) return photoPositions.length;
    return waypoints.filter((w) => w.action === 'take_photo' || !w.action).length;
  }, [photoPositions, waypoints]);

  const batteryCount = useMemo(() => {
    if (detailedEstimates?.batteryCountNeeded) return detailedEstimates.batteryCountNeeded;
    const flightMinutes = flightTimeSec / 60;
    return Math.max(1, Math.ceil(flightMinutes / 22));
  }, [detailedEstimates, flightTimeSec]);

  // Save Mission to Backend
  const handleSaveMission = async (): Promise<any> => {
    setIsSaving(true);
    try {
      const payload = {
        name,
        description,
        droneModel,
        cameraModel,
        missionType,
        flightSpeedMs: flightSpeedMps,
        targetAltitudeM,
        altitudeReference,
        rthAltitudeM,
        surveyBoundary: { type: 'Polygon', coordinates: [polygon] },
        homePoint: homePoint ? { longitude: homePoint[0], latitude: homePoint[1], altitudeM: homePoint[2] } : null,
        takeoffPoint: takeoffPoint ? { longitude: takeoffPoint[0], latitude: takeoffPoint[1], altitudeM: takeoffPoint[2] } : null,
        landingPoint: landingPoint ? { longitude: landingPoint[0], latitude: landingPoint[1], altitudeM: landingPoint[2] } : null,
        finishAction,
        photogrammetryConfig: {
          frontOverlapPercent: forwardOverlap,
          sideOverlapPercent: sideOverlap,
          gsdCmPerPixel: photogrammetryInfo.gsdCmPerPixel,
          flightLineSpacingMeters: photogrammetryInfo.flightLineSpacingMeters,
        },
        gridConfig: {
          directionDeg: gridAngleDeg,
          turnMode: turnStrategy,
        },
        waypoints: waypoints.map((w) => ({
          latitude: w.latitude,
          longitude: w.longitude,
          altitudeM: w.altitudeMeters,
          speedMs: w.speedMps,
          turnMode: w.turnMode,
        })),
        statistics: {
          totalDistanceM,
          flightTimeSec,
          photoCount,
          surveyAreaM2,
        },
        validationResult,
      };

      let resultData: any = null;
      if (missionId) {
        const updateRes = await apiFetch<any>(`/missions/${missionId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        resultData = updateRes?.data || { id: missionId };
        setNotification({ type: 'success', message: 'อัปเดตภารกิจเรียบร้อยแล้ว (New Version Created)' });
      } else {
        const res = await apiFetch<any>('/missions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        resultData = res?.data;
        if (res?.data?.id) {
          setMissionId(res.data.id);
        }
        setNotification({ type: 'success', message: 'บันทึกภารกิจใหม่เรียบร้อยแล้ว' });
      }

      // Refresh saved list
      const updated = await apiFetch<any>('/missions');
      if (Array.isArray(updated?.data)) setSavedMissions(updated.data);
      return resultData;
    } catch (err: any) {
      setNotification({ type: 'error', message: `บันทึกไม่สำเร็จ: ${err.message || err}` });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Mission Upload to Drone via Companion Bridge
  const handleUploadMission = async () => {
    if (validationResult.status === 'BLOCKED') {
      setNotification({
        type: 'error',
        message: 'ไม่สามารถอัปโหลดได้: แผนการบินไม่ผ่านเกณฑ์ความปลอดภัย (มีข้อผิดพลาดระดับ Error)',
      });
      return;
    }
    if (!isBridgeConnected) {
      setNotification({
        type: 'error',
        message: 'กรุณาเชื่อมต่อ GeoMonitor Drone Bridge (Android MSDK V5) ก่อนทำการอัปโหลด',
      });
      return;
    }

    const confirmUpload = window.confirm(
      `ยืนยันการอัปโหลดภารกิจ "${name}" ไปยังอากาศยาน ${droneModel} (${targetPlatform}) หรือไม่?\n\n` +
      `• จำนวนจุดบิน: ${waypoints.length} จุด\n` +
      `• ระยะทางบินรวม: ${(totalDistanceM / 1000).toFixed(2)} km\n\n` +
      `คำเตือนความปลอดภัย: หลังอัปโหลดสำเร็จ โดรนจะยังไม่เริ่มบินอัตโนมัติจนกว่าจะได้รับคำสั่งยืนยันจากนักบินหน้างาน`
    );
    if (!confirmUpload) return;

    setIsUploading(true);
    setUploadState('PREPARING');

    try {
      let currentId = missionId;
      if (!currentId) {
        setUploadState('SAVING_DATABASE');
        const saveRes = await handleSaveMission();
        currentId = saveRes?.id || missionId;
      }

      setUploadState('PUSHING_TO_AIRCRAFT');
      await apiFetch<any>(`/missions/${currentId || 'current'}/upload`, {
        method: 'POST',
        body: JSON.stringify({ targetPlatform }),
      });

      setUploadState('MISSION_READY');
      setNotification({
        type: 'success',
        message: `อัปโหลดภารกิจเข้าหน่วยความจำ ${droneModel} สำเร็จ! สถานะ: MISSION_READY (นักบินหน้างานสามารถสั่งบินได้)`,
      });
    } catch (err: any) {
      setUploadState('FAILED');
      setNotification({
        type: 'error',
        message: `อัปโหลดภารกิจไม่สำเร็จ: ${err.message || err}`,
      });
    } finally {
      setIsUploading(false);
    }
  };


  // Select project area
  const handleSelectProjectArea = (areaId: string) => {
    const area = areas.find((a) => a.id === areaId);
    if (area && area.boundary?.coordinates?.[0]) {
      const ring = area.boundary.coordinates[0];
      setPolygon(ring);
      if (ring[0]) {
        setHomePoint([ring[0][0] - 0.0005, ring[0][1] - 0.0005, targetAltitudeM]);
      }
      setNotification({ type: 'success', message: `นำเข้าขอบเขตพื้นที่ "${area.name}" เรียบร้อยแล้ว` });
    }
  };

  // Handle KML/KMZ Polygon selected as Mission Survey Area
  const handleKmlMissionAreaSelected = useCallback((coords: [number, number][], featureName?: string) => {
    if (!coords || coords.length < 3) return;
    setPolygon(coords);
    // Explicitly reset generated flight plan - do NOT auto-calculate flight plan
    setWaypoints([]);
    setFlightLines([]);
    setPhotoPositions([]);
    setSampleFootprints([]);
    setDetailedEstimates(null);
    setTotalDistanceM(0);
    setFlightLinesCount(0);
    setSelectedWaypointIndex(null);

    if (coords[0]) {
      setHomePoint([coords[0][0] - 0.0005, coords[0][1] - 0.0005, targetAltitudeM]);
      setTakeoffPoint([coords[0][0] - 0.0005, coords[0][1] - 0.0005, targetAltitudeM]);
    }
    if (featureName) {
      setName(`ภารกิจสำรวจ - ${featureName}`);
    }
    setWorkflowState('AREA_DEFINED');
    setNotification({
      type: 'success',
      message: `นำเข้าพื้นที่สำรวจ "${featureName || 'KML Polygon'}" สำเร็จแล้ว กรุณาตรวจสอบพารามิเตอร์และกด "คำนวณแนวบิน" เพื่อสร้างแผนการบิน`,
    });
  }, [targetAltitudeM]);

  // Load a saved mission
  const handleLoadSavedMission = async (id: string) => {
    try {
      const res = await apiFetch<any>(`/missions/${id}`);
      if (res?.data) {
        const m = res.data;
        setMissionId(m.id);
        setName(m.name || '');
        setDescription(m.description || '');
        setDroneModel(m.droneModel || 'DJI Matrice 350 RTK');
        setCameraModel(m.cameraModel || 'DJI Zenmuse P1 (35mm)');
        setMissionType(m.missionType || 'grid_survey');
        setFlightSpeedMps(Number(m.flightSpeedMs) || 10);
        setTargetAltitudeM(Number(m.targetAltitudeM) || 80);
        setAltitudeReference(m.altitudeReference || 'relative_to_home');
        setRthAltitudeM(Number(m.rthAltitudeM) || 100);
        setFinishAction(m.finishAction || 'return_to_home');

        if (m.surveyBoundary?.coordinates?.[0]) {
          setPolygon(m.surveyBoundary.coordinates[0]);
        }
        if (m.homePoint) {
          setHomePoint([m.homePoint.longitude, m.homePoint.latitude, m.homePoint.altitudeM || 80]);
        }
        if (Array.isArray(m.waypoints)) {
          setWaypoints(
            m.waypoints.map((w: any, idx: number) => ({
              sequence: w.sequenceNumber || idx + 1,
              longitude: w.longitude,
              latitude: w.latitude,
              altitudeMeters: Number(w.altitudeM),
              speedMps: Number(w.speedMs) || 10,
              turnMode: w.turnMode || 'to_point_and_stop',
              gimbalPitchDeg: Number(w.gimbalPitchDeg) || -90,
              action: 'take_photo',
            }))
          );
        }
        setIsSavedMissionsOpen(false);
        setNotification({ type: 'success', message: `โหลดภารกิจ "${m.name}" เรียบร้อยแล้ว` });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `โหลดภารกิจไม่สำเร็จ: ${err.message || err}` });
    }
  };

  // Clear all flight plan and boundary data
  const handleClearAll = useCallback(() => {
    setPolygon([]);
    setWaypoints([]);
    setFlightLines([]);
    setPhotoPositions([]);
    setSampleFootprints([]);
    setTotalDistanceM(0);
    setFlightLinesCount(0);
    setDetailedEstimates(null);
    setWorkflowState('EMPTY');
    setNotification({ type: 'success', message: 'ล้างพื้นที่และเส้นทางบินทั้งหมดเรียบร้อย' });
  }, []);

  return (
    <DashboardLayout noPadding>
      {/* 1.5. Interactive Workflow Stepper Sub-toolbar (NextAdmin Style) */}
      <div className="h-11 bg-card border-b border-border px-4 flex items-center justify-between gap-3 text-xs z-30 shadow-xs shrink-0 overflow-x-auto scrollbar-none select-none">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* STEP 1 */}
          <button
            onClick={() => setCurrentStep(1)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
              currentStep === 1
                ? 'bg-primary text-white font-bold shadow-xs border border-primary'
                : polygon.length >= 3
                ? 'bg-card-secondary text-foreground border border-border hover:bg-muted'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                polygon.length >= 3
                  ? currentStep === 1
                    ? 'bg-white text-primary font-bold'
                    : 'bg-emerald-500 text-white font-bold'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {polygon.length >= 3 ? '✓' : '1'}
            </span>
            <span>1. วาดพื้นที่ (Draw Area)</span>
          </button>

          <span className="text-muted-foreground">→</span>

          {/* STEP 2 */}
          <button
            onClick={() => setCurrentStep(2)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
              currentStep === 2
                ? 'bg-primary text-white font-bold shadow-xs border border-primary'
                : workflowState === 'CONFIGURING' || (polygon.length >= 3 && workflowState === 'READY_TO_CALCULATE')
                ? 'bg-card-secondary text-foreground border border-border hover:bg-muted'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                currentStep === 2 ? 'bg-white text-primary font-bold' : 'bg-muted text-muted-foreground'
              }`}
            >
              2
            </span>
            <span>2. ตั้งค่าภารกิจ (Configure)</span>
          </button>

          <span className="text-muted-foreground">→</span>

          {/* STEP 3 */}
          <button
            onClick={() => setCurrentStep(3)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
              currentStep === 3
                ? 'bg-primary text-white font-bold shadow-xs border border-primary'
                : workflowState === 'READY_TO_CALCULATE' || workflowState === 'CALCULATING' || workflowState === 'OUTDATED'
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30'
                : waypoints.length > 0
                ? 'bg-card-secondary text-foreground border border-border hover:bg-muted'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                waypoints.length > 0 && workflowState !== 'OUTDATED'
                  ? currentStep === 3
                    ? 'bg-white text-primary font-bold'
                    : 'bg-emerald-500 text-white font-bold'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {waypoints.length > 0 && workflowState !== 'OUTDATED' ? '✓' : '3'}
            </span>
            <span>3. คำนวณ (Calculate)</span>
          </button>

          <span className="text-muted-foreground">→</span>

          {/* STEP 4 */}
          <button
            onClick={() => setCurrentStep(4)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
              currentStep === 4
                ? 'bg-primary text-white font-bold shadow-xs border border-primary'
                : workflowState === 'CALCULATED' || workflowState === 'EXPORT_READY'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                currentStep === 4 ? 'bg-white text-primary font-bold' : 'bg-muted text-muted-foreground'
              }`}
            >
              4
            </span>
            <span>4. ตรวจสอบ (Review)</span>
          </button>

          <span className="text-muted-foreground">→</span>

          {/* STEP 5 */}
          <button
            onClick={() => setCurrentStep(5)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
              currentStep === 5
                ? 'bg-primary text-white font-bold shadow-xs border border-primary'
                : workflowState === 'EXPORT_READY'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                currentStep === 5 ? 'bg-white text-primary font-bold' : 'bg-muted text-muted-foreground'
              }`}
            >
              5
            </span>
            <span>5. ส่งออก (Export)</span>
          </button>
        </div>

        {/* Current State Indicator Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">สถานะ:</span>
          {workflowState === 'EMPTY' && (
            <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border font-semibold text-[11px]">
              EMPTY (ยังไม่มีขอบเขตพื้นที่)
            </span>
          )}
          {(workflowState === 'AREA_DEFINED' || workflowState === 'READY_TO_CALCULATE') && (
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 font-semibold text-[11px]">
              READY_TO_CALCULATE (พร้อมคำนวณ)
            </span>
          )}
          {workflowState === 'CALCULATING' && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/40 font-semibold text-[11px] animate-pulse">
              CALCULATING (กำลังคำนวณ...)
            </span>
          )}
          {(workflowState === 'CALCULATED' || workflowState === 'EXPORT_READY') && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold text-[11px]">
              EXPORT_READY (พร้อมส่งออก)
            </span>
          )}
          {workflowState === 'OUTDATED' && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/50 font-semibold text-[11px] animate-pulse">
              ⚠️ OUTDATED (ต้องการคำนวณใหม่)
            </span>
          )}
          {workflowState === 'VALIDATION_FAILED' && (
            <span className="px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30 font-semibold text-[11px]">
              VALIDATION_FAILED (ผิดพลาด)
            </span>
          )}
        </div>
      </div>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Collapsible Panel: Mission Configuration */}
        <div
          className={`relative z-20 transition-all duration-300 flex ${
            isLeftPanelOpen ? 'w-84 2xl:w-96' : 'w-0'
          }`}
        >
          {isLeftPanelOpen && (
            <div className="w-84 2xl:w-96 h-full">
              <MissionConfigPanel
                currentStep={currentStep}
                onStepChange={setCurrentStep}
                name={name}
                onNameChange={setName}
                description={description}
                onDescriptionChange={setDescription}
                targetPlatform={targetPlatform}
                onTargetPlatformChange={setTargetPlatform}
                droneModel={droneModel}
                onDroneModelChange={setDroneModel}
                cameraModel={cameraModel}
                onCameraModelChange={setCameraModel}
                missionType={missionType}
                onMissionTypeChange={setMissionType}
                flightSpeedMps={flightSpeedMps}
                onFlightSpeedChange={setFlightSpeedMps}
                targetAltitudeM={targetAltitudeM}
                onTargetAltitudeChange={setTargetAltitudeM}
                altitudeReference={altitudeReference}
                onAltitudeReferenceChange={setAltitudeReference}
                rthAltitudeM={rthAltitudeM}
                onRthAltitudeChange={setRthAltitudeM}
                finishAction={finishAction}
                onFinishActionChange={setFinishAction}
                forwardOverlap={forwardOverlap}
                onForwardOverlapChange={setForwardOverlap}
                sideOverlap={sideOverlap}
                onSideOverlapChange={setSideOverlap}
                gridAngleDeg={gridAngleDeg}
                onGridAngleDegChange={setGridAngleDeg}
                turnStrategy={turnStrategy}
                onTurnStrategyChange={setTurnStrategy}
                gimbalPitchDeg={gimbalPitchDeg}
                onGimbalPitchDegChange={setGimbalPitchDeg}
                orbitRadiusM={orbitRadiusM}
                onOrbitRadiusChange={setOrbitRadiusM}
                corridorWidthM={corridorWidthM}
                onCorridorWidthChange={setCorridorWidthM}
                captureMode={captureMode}
                onCaptureModeChange={setCaptureMode}
                photogrammetryInfo={photogrammetryInfo}
                areas={areas}
                onSelectProjectArea={handleSelectProjectArea}
                interactionMode={interactionMode}
                onSetInteractionMode={setInteractionMode}
                polygonVertexCount={polygon.length}
                onClearPolygon={handleClearAll}
                workflowState={workflowState}
                onCalculateFlightPlan={handleCalculateFlightPlan}
                onOpenImportKml={() => setIsKmlSurveyModalOpen(true)}
                validationResult={validationResult}
                totalDistanceM={totalDistanceM}
                flightTimeSec={flightTimeSec}
                photoCount={photoCount}
                surveyAreaM2={surveyAreaM2}
                batteryCount={batteryCount}
                batteryMinutes={22}
                waypoints={waypoints}
                flightLinesCount={flightLinesCount}
                detailedEstimates={detailedEstimates}
                onOpenExportModal={() => setIsExportModalOpen(true)}
                onSaveMission={handleSaveMission}
                isSaving={isSaving}
                isBridgeConnected={isBridgeConnected}
                onToggleBridge={() => {
                  const next = !isBridgeConnected;
                  setIsBridgeConnected(next);
                  setNotification({
                    type: 'success',
                    message: next
                      ? 'เชื่อมต่อ GeoMonitor Drone Bridge (Android MSDK V5) สำเร็จ'
                      : 'ตัดการเชื่อมต่อ Drone Bridge เรียบร้อย',
                  });
                }}
              />
            </div>
          )}

          {/* Toggle Left Button */}
          <button
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            className="absolute -right-3.5 top-3 z-30 w-7 h-7 rounded-full bg-card border border-border text-foreground hover:bg-muted hover:text-primary flex items-center justify-center shadow-md transition-all"
            title={isLeftPanelOpen ? 'ยุบแผงตั้งค่า' : 'ขยายแผงตั้งค่า'}
          >
            {isLeftPanelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Center: 3D Flight Planner Canvas & HUD */}
        <div className="flex-1 flex flex-col relative h-full overflow-hidden">
          {/* Notification Banner */}
          {notification && (
            <div
              className={`absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 ${
                notification.type === 'success'
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
                  : 'bg-rose-950/90 text-rose-300 border border-rose-500/50'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{notification.message}</span>
              <button
                onClick={() => setNotification(null)}
                className="ml-2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Outdated Notice Floating Banner */}
          {workflowState === 'OUTDATED' && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-2xl flex items-center gap-3 backdrop-blur-md bg-amber-950/95 text-amber-200 border border-amber-500/70 animate-in fade-in slide-in-from-top-2 duration-150">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>การตั้งค่าเปลี่ยนแปลง: แผนการบินเดิมไม่ตรงกับพารามิเตอร์ปัจจุบัน (OUTDATED)</span>
              <button
                onClick={handleCalculateFlightPlan}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-all cursor-pointer shadow-md"
              >
                คำนวณใหม่เดี๋ยวนี้
              </button>
            </div>
          )}

          {/* Empty State Onboarding Overlay */}
          {polygon.length === 0 && currentStep === 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2.5 rounded-2xl bg-card/95 backdrop-blur-md border border-border text-foreground shadow-2xl flex items-center gap-3 text-xs animate-in fade-in zoom-in-95 duration-200">
              <div className="w-7 h-7 rounded-xl bg-primary/15 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <div>
                <div className="font-bold text-foreground">ขั้นตอนที่ 1: กำหนดพื้นที่บิน (Draw Survey Area)</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  คลิกปุ่ม <span className="text-primary font-semibold">&quot;วาดพื้นที่บิน&quot;</span> ในแผงซ้าย เพื่อกำหนดขอบเขตแปลงสำรวจบนแผนที่ 3D
                </div>
              </div>
              <button
                onClick={() => setInteractionMode('draw_polygon')}
                className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-all shadow-md ml-2 cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เริ่มวาด Polygon</span>
              </button>
            </div>
          )}

          {/* 3D Map Canvas - Using unified CesiumMap across the entire project */}
          <div className="flex-1 relative">
            {/* Dedicated Map Layers Controller */}
            <div className="absolute top-4 left-12 z-20">
              <MapLayerControl
                visibility={mapLayerVisibility}
                onChange={setMapLayerVisibility}
                flightLinesCount={flightLinesCount}
                photoCount={photoCount}
                waypointsCount={waypoints.length}
                hasPolygon={polygon.length >= 3}
              />
            </div>

            <CesiumMap
              areas={areas}
              dronePolygon={polygon}
              droneWaypoints={waypoints}
              droneFlightLines={flightLines}
              dronePhotoPositions={photoPositions}
              droneSampleFootprints={sampleFootprints}
              droneHomePoint={homePoint}
              droneTakeoffPoint={takeoffPoint}
              droneLandingPoint={landingPoint}
              droneAltitudeReference={altitudeReference}
              droneTargetAltitudeM={targetAltitudeM}
              droneInteractionMode={interactionMode}
              droneLayerVisibility={mapLayerVisibility}
              onDronePolygonChange={handlePolygonChange}
              onDroneHomePointChange={setHomePoint}
              onDroneTakeoffPointChange={setTakeoffPoint}
              onDroneLandingPointChange={setLandingPoint}
              selectedDroneWaypointIndex={selectedWaypointIndex}
              onSelectDroneWaypoint={setSelectedWaypointIndex}
              onUserLocationDetected={handleUserLocationDetected}
            />
          </div>

          {/* Bottom Panel: Waypoint Timeline & Action Bar */}
          <div className="relative z-20">
            <WaypointTimelineBar
              waypoints={waypoints}
              flightLines={flightLines}
              selectedWaypointIndex={selectedWaypointIndex}
              onSelectWaypoint={setSelectedWaypointIndex}
              onGenerateRoute={handleCalculateFlightPlan}
              onSaveMission={handleSaveMission}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenSavedMissions={() => setIsSavedMissionsOpen(true)}
              onClearRoute={handleClearAll}
              isSaving={isSaving}
              isBridgeConnected={isBridgeConnected}
              onToggleBridge={() => {
                const next = !isBridgeConnected;
                setIsBridgeConnected(next);
                setNotification({
                  type: 'success',
                  message: next
                    ? 'เชื่อมต่อ GeoMonitor Drone Bridge (Android MSDK V5) สำเร็จ พร้อมรับคำสั่งอัปโหลด'
                    : 'ตัดการเชื่อมต่อ Drone Bridge เรียบร้อย',
                });
              }}
              onUploadMission={handleUploadMission}
              isUploading={isUploading}
              uploadState={uploadState}
              workflowState={workflowState}
              polygonVertexCount={polygon.length}
            />
          </div>
        </div>

        {/* Right Collapsible Panel: Validation & Statistics HUD */}
        <div
          className={`relative z-20 transition-all duration-300 flex ${
            isRightPanelOpen ? 'w-84 2xl:w-96' : 'w-0'
          }`}
        >
          {/* Toggle Right Button */}
          <button
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className="absolute -left-3.5 top-3 z-30 w-7 h-7 rounded-full bg-card border border-border text-foreground hover:bg-muted hover:text-primary flex items-center justify-center shadow-md transition-all"
            title={isRightPanelOpen ? 'ยุบแผงตรวจสอบ' : 'ขยายแผงตรวจสอบ'}
          >
            {isRightPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {isRightPanelOpen && (
            <div className="w-84 2xl:w-96 h-full">
              <MissionValidationPanel
                status={validationResult.status}
                issues={validationResult.issues}
                totalDistanceM={totalDistanceM}
                flightTimeSec={flightTimeSec}
                photoCount={photoCount}
                surveyAreaM2={surveyAreaM2}
                batteryCount={batteryCount}
                batteryMinutes={22}
                waypoints={waypoints}
                targetAltitudeM={targetAltitudeM}
                altitudeReference={altitudeReference}
                flightLinesCount={flightLinesCount}
                gsdCmPerPixel={photogrammetryInfo.gsdCmPerPixel}
                forwardOverlap={forwardOverlap}
                sideOverlap={sideOverlap}
                passACount={detailedEstimates?.passACount}
                passBCount={detailedEstimates?.passBCount}
                assumptions={detailedEstimates?.assumptions || []}
                workflowState={workflowState}
              />
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        mission={currentMissionDTO}
        missionId={missionId}
        validationStatus={validationResult.status}
        isOutdated={workflowState === 'OUTDATED'}
      />

      {/* KML/KMZ Import Modal for Survey Mission Area */}
      <ImportKmlModal
        isOpen={isKmlSurveyModalOpen}
        onClose={() => setIsKmlSurveyModalOpen(false)}
        currentProjectId="default-project"
        defaultIntent="mission_area"
        onSelectMissionArea={(coords, featureName) => {
          handleKmlMissionAreaSelected(coords, featureName);
          setIsKmlSurveyModalOpen(false);
        }}
      />

      {/* Saved Missions Modal */}
      {isSavedMissionsOpen && (
        <Modal
          isOpen={isSavedMissionsOpen}
          onClose={() => setIsSavedMissionsOpen(false)}
          title={`ภารกิจการบินที่บันทึกไว้ (${savedMissions.length})`}
          description="รายการภารกิจสำรวจที่ผ่านการบันทึกลงฐานข้อมูลแล้ว"
          maxWidth="lg"
        >
          <div className="max-h-96 overflow-y-auto space-y-2 text-xs">
            {savedMissions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                ยังไม่มีภารกิจที่บันทึกในระบบ
              </div>
            ) : (
              savedMissions.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleLoadSavedMission(m.id)}
                  className="p-3 bg-card-secondary hover:bg-muted border border-border rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                      {m.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {m.droneModel} • {m.targetAltitudeM}m ({m.altitudeReference}) • {m.waypointCount} จุด
                    </div>
                    <div className="text-[10px] text-muted-foreground/80 font-mono mt-1">
                      เวอร์ชัน v{m.version || 1} • {new Date(m.updatedAt || m.createdAt).toLocaleString('th-TH')}
                    </div>
                  </div>
                  <Button variant="primary" size="sm">
                    โหลด
                  </Button>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
