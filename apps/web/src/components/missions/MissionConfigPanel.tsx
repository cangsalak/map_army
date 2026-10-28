'use client';

import React from 'react';
import {
  Settings2,
  Camera,
  Plane,
  MapPin,
  Compass,
  Sliders,
  ChevronDown,
  ChevronUp,
  RotateCw,
  PlusCircle,
  Home,
  AlertTriangle,
  Info,
  Maximize2,
  Trash2,
  LocateFixed,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  BatteryCharging,
  Zap,
  Layers,
  Activity,
  FileDown,
  Save,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Radio,
  Box,
} from 'lucide-react';
import { CAMERA_PRESETS } from '@/lib/drone-route-generator';
import { DroneInteractionMode } from '../map/CesiumMap';
import {
  PlatformId,
  MissionWorkflowState,
  ValidationStatus,
  ValidationIssue,
  DroneWaypointDTO,
} from '@geomonitor/shared';
import { PLATFORM_REGISTRY } from '@/lib/drone-platform-registry';

interface MissionConfigPanelProps {
  currentStep?: number;
  onStepChange?: (step: number) => void;
  onOpenImportKml?: () => void;
  name: string;
  onNameChange: (val: string) => void;
  description: string;
  onDescriptionChange: (val: string) => void;
  targetPlatform: PlatformId;
  onTargetPlatformChange: (val: PlatformId) => void;
  droneModel: string;
  onDroneModelChange: (val: string) => void;
  cameraModel: string;
  onCameraModelChange: (val: string) => void;
  missionType: string;
  onMissionTypeChange: (val: string) => void;
  flightSpeedMps: number;
  onFlightSpeedChange: (val: number) => void;
  targetAltitudeM: number;
  onTargetAltitudeChange: (val: number) => void;
  altitudeReference: 'relative_to_home' | 'agl' | 'amsl';
  onAltitudeReferenceChange: (val: 'relative_to_home' | 'agl' | 'amsl') => void;
  rthAltitudeM: number;
  onRthAltitudeChange: (val: number) => void;
  finishAction: string;
  onFinishActionChange: (val: string) => void;
  forwardOverlap: number;
  onForwardOverlapChange: (val: number) => void;
  sideOverlap: number;
  onSideOverlapChange: (val: number) => void;
  gridAngleDeg: number;
  onGridAngleDegChange: (val: number) => void;
  turnStrategy: 'to_point_and_stop' | 'curve_through';
  onTurnStrategyChange: (val: 'to_point_and_stop' | 'curve_through') => void;
  gimbalPitchDeg?: number;
  onGimbalPitchDegChange?: (val: number) => void;
  orbitRadiusM?: number;
  onOrbitRadiusChange?: (val: number) => void;
  corridorWidthM?: number;
  onCorridorWidthChange?: (val: number) => void;
  captureMode?: 'distance_interval' | 'time_interval' | 'stop_and_shoot';
  onCaptureModeChange?: (val: 'distance_interval' | 'time_interval' | 'stop_and_shoot') => void;
  photogrammetryInfo: {
    gsdCmPerPixel: number;
    flightLineSpacingMeters: number;
    photoTriggerDistanceMeters: number;
    photoIntervalSeconds: number;
    groundCoverageWidthMeters: number;
  };
  areas: any[];
  onSelectProjectArea: (areaId: string) => void;
  interactionMode: DroneInteractionMode;
  onSetInteractionMode: (mode: DroneInteractionMode) => void;
  polygonVertexCount: number;
  onClearPolygon: () => void;
  workflowState?: MissionWorkflowState;
  onCalculateFlightPlan?: () => void;

  // Step 4 & 5 Integration
  validationResult?: { status: ValidationStatus; issues: ValidationIssue[] };
  totalDistanceM?: number;
  flightTimeSec?: number;
  photoCount?: number;
  surveyAreaM2?: number;
  batteryCount?: number;
  batteryMinutes?: number;
  waypoints?: DroneWaypointDTO[];
  flightLinesCount?: number;
  detailedEstimates?: any;
  onOpenExportModal?: () => void;
  onSaveMission?: () => void;
  isSaving?: boolean;
  isBridgeConnected?: boolean;
  onToggleBridge?: () => void;
}

export default function MissionConfigPanel({
  currentStep = 1,
  onStepChange,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  targetPlatform = 'dji_mini_4_pro',
  onTargetPlatformChange,
  droneModel,
  onDroneModelChange,
  cameraModel,
  onCameraModelChange,
  missionType,
  onMissionTypeChange,
  flightSpeedMps,
  onFlightSpeedChange,
  targetAltitudeM,
  onTargetAltitudeChange,
  altitudeReference,
  onAltitudeReferenceChange,
  rthAltitudeM,
  onRthAltitudeChange,
  finishAction,
  onFinishActionChange,
  forwardOverlap,
  onForwardOverlapChange,
  sideOverlap,
  onSideOverlapChange,
  gridAngleDeg,
  onGridAngleDegChange,
  turnStrategy,
  onTurnStrategyChange,
  gimbalPitchDeg = -90,
  onGimbalPitchDegChange,
  orbitRadiusM = 50,
  onOrbitRadiusChange,
  corridorWidthM = 80,
  onCorridorWidthChange,
  captureMode = 'distance_interval',
  onCaptureModeChange,
  photogrammetryInfo,
  areas,
  onSelectProjectArea,
  interactionMode,
  onSetInteractionMode,
  polygonVertexCount,
  onClearPolygon,
  workflowState = 'EMPTY',
  onCalculateFlightPlan,
  onOpenImportKml,
  validationResult = { status: 'BLOCKED', issues: [] },
  totalDistanceM = 0,
  flightTimeSec = 0,
  photoCount = 0,
  surveyAreaM2 = 0,
  batteryCount = 1,
  batteryMinutes = 22,
  waypoints = [],
  flightLinesCount = 0,
  detailedEstimates,
  onOpenExportModal,
  onSaveMission,
  isSaving = false,
  isBridgeConnected = false,
  onToggleBridge,
}: MissionConfigPanelProps) {
  const selectedCaps = PLATFORM_REGISTRY[targetPlatform] || PLATFORM_REGISTRY.dji_mini_4_pro;

  // Thai Area formatting
  const rai = Math.floor(surveyAreaM2 / 1600);
  const ngan = Math.floor((surveyAreaM2 % 1600) / 400);
  const wah = Math.round(((surveyAreaM2 % 1600) % 400) / 4);

  const durationMin = Math.floor(flightTimeSec / 60);
  const durationSec = Math.round(flightTimeSec % 60);

  const errors = validationResult.issues.filter((i) => i.level === 'error');
  const warnings = validationResult.issues.filter((i) => i.level === 'warning');

  const setStep = (step: number) => {
    if (onStepChange) onStepChange(step);
  };

  return (
    <div className="flex flex-col h-full bg-card/95 border-r border-border text-foreground select-none backdrop-blur-md">
      {/* Panel Header */}
      <div className="h-12 px-4 border-b border-border bg-card-secondary/70 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/40 text-primary flex items-center justify-center shadow-sm">
            <Plane className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">ขั้นตอนการวางแผนการบิน</h3>
            <p className="text-[10px] text-muted-foreground">Step-by-Step Drone Flight Planning</p>
          </div>
        </div>
        <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-bold">
          Step {currentStep} / 5
        </div>
      </div>

      {/* 5 Step Navigation Sub-tabs */}
      <div className="grid grid-cols-5 p-1.5 gap-1 bg-muted/80 border-b border-border text-[10px] font-medium shrink-0">
        <button
          onClick={() => setStep(1)}
          className={`py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentStep === 1
              ? 'bg-card text-primary font-bold shadow-xs border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 mb-0.5" />
          <span>1. พื้นที่</span>
        </button>

        <button
          onClick={() => setStep(2)}
          className={`py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentStep === 2
              ? 'bg-card text-primary font-bold shadow-xs border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5 mb-0.5" />
          <span>2. ตั้งค่า</span>
        </button>

        <button
          onClick={() => setStep(3)}
          className={`py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentStep === 3
              ? 'bg-card text-primary font-bold shadow-xs border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 mb-0.5" />
          <span>3. คำนวณ</span>
        </button>

        <button
          onClick={() => setStep(4)}
          className={`py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentStep === 4
              ? 'bg-card text-primary font-bold shadow-xs border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
          }`}
        >
          <Activity className="w-3.5 h-3.5 mb-0.5" />
          <span>4. ตรวจสอบ</span>
        </button>

        <button
          onClick={() => setStep(5)}
          className={`py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentStep === 5
              ? 'bg-card text-primary font-bold shadow-xs border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
          }`}
        >
          <FileDown className="w-3.5 h-3.5 mb-0.5" />
          <span>5. ส่งออก</span>
        </button>
      </div>

      {/* Main Step Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* ========================================================================= */}
        {/* STEP 1: SURVEY AREA & BOUNDARIES */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl space-y-1">
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">1</span>
                <span>ขั้นตอนที่ 1: กำหนดพื้นที่บินสำรวจ (Survey Area)</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                กำหนดขอบเขตแปลงสำรวจบนแผนที่ 3D ด้วยการวาด Polygon, นำเข้าไฟล์ KML/KMZ หรือเลือกจากโครงการ
              </p>
            </div>

            {/* Area Actions */}
            <div className="space-y-2">
              <label className="block text-foreground font-semibold">เครื่องมือวาดแปลงและจุดอ้างอิง</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    onSetInteractionMode(interactionMode === 'draw_polygon' ? 'none' : 'draw_polygon')
                  }
                  className={`p-2.5 rounded-xl border flex items-center gap-2 font-medium transition-all cursor-pointer ${
                    interactionMode === 'draw_polygon'
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-card-secondary border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <PlusCircle className="w-4 h-4 text-cyan-400" />
                  <span>{interactionMode === 'draw_polygon' ? 'กำลังวาดแปลง...' : 'วาดพื้นที่บิน'}</span>
                </button>

                <button
                  onClick={() => onOpenImportKml && onOpenImportKml()}
                  className="p-2.5 rounded-xl border border-border bg-card-secondary hover:bg-muted text-foreground flex items-center gap-2 font-medium transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-primary" />
                  <span>นำเข้า KML/KMZ</span>
                </button>
              </div>

              {/* Waypoint markers quick placement */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  onClick={() => onSetInteractionMode(interactionMode === 'set_home' ? 'none' : 'set_home')}
                  className={`p-2 rounded-lg border text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    interactionMode === 'set_home'
                      ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                      : 'bg-card-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                  title="คลิกแผนที่เพื่อวางจุด Home"
                >
                  <Home className="w-3.5 h-3.5 text-emerald-500" />
                  <span>จุด Home</span>
                </button>

                <button
                  onClick={() => onSetInteractionMode(interactionMode === 'set_takeoff' ? 'none' : 'set_takeoff')}
                  className={`p-2 rounded-lg border text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    interactionMode === 'set_takeoff'
                      ? 'bg-cyan-600 text-white border-cyan-500 font-bold'
                      : 'bg-card-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                  title="คลิกแผนที่เพื่อวางจุดขึ้นบิน (Takeoff)"
                >
                  <Plane className="w-3.5 h-3.5 text-cyan-400" />
                  <span>จุดขึ้นบิน</span>
                </button>

                <button
                  onClick={() => onSetInteractionMode(interactionMode === 'set_landing' ? 'none' : 'set_landing')}
                  className={`p-2 rounded-lg border text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    interactionMode === 'set_landing'
                      ? 'bg-amber-600 text-white border-amber-500 font-bold'
                      : 'bg-card-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                  title="คลิกแผนที่เพื่อวางจุดลงจอด (Landing)"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  <span>จุดลงจอด</span>
                </button>
              </div>
            </div>

            {/* Select from project areas */}
            {areas.length > 0 && (
              <div>
                <label className="block text-foreground font-semibold mb-1">หรือเลือกแปลงจากโครงการ</label>
                <select
                  onChange={(e) => onSelectProjectArea(e.target.value)}
                  defaultValue=""
                  className="w-full px-3 py-2 bg-card-secondary border border-border rounded-xl text-foreground font-medium focus:outline-none focus:border-primary"
                >
                  <option value="" disabled>
                    -- เลือกแปลงพื้นที่โครงการ --
                  </option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Area Status & Details Card */}
            <div className="p-3 bg-card-secondary rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-primary" />
                  สถานะขอบเขตแปลง
                </span>
                <span className="font-mono text-muted-foreground text-[11px]">
                  {polygonVertexCount} หมุดพิกัด
                </span>
              </div>

              {polygonVertexCount >= 3 ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">ขนาดพื้นที่:</span>
                    <span className="font-bold text-primary">
                      {surveyAreaM2.toLocaleString()} ตร.ม.
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">หน่วยไทย:</span>
                    <span className="font-semibold text-foreground">
                      {rai} ไร่ {ngan} งาน {wah} วา²
                    </span>
                  </div>
                  <button
                    onClick={onClearPolygon}
                    className="w-full mt-2 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ล้างแปลงพื้นที่</span>
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  ยังไม่ได้วาดแปลงสำรวจ กรุณาคลิกปุ่ม &quot;วาดพื้นที่บิน&quot; ด้านบนเพื่อกำหนดอย่างน้อย 3 จุด
                </p>
              )}
            </div>

            {/* Step 1 Navigation Button */}
            <div className="pt-2">
              <button
                onClick={() => setStep(2)}
                disabled={polygonVertexCount < 3}
                className={`w-full py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  polygonVertexCount >= 3
                    ? 'bg-primary text-white shadow-md hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed border border-border'
                }`}
              >
                <span>ขั้นตอนถัดไป: ตั้งค่าภารกิจ & กล้อง (Step 2)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: MISSION & DRONE CONFIG */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl space-y-1">
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">2</span>
                <span>ขั้นตอนที่ 2: ตั้งค่าภารกิจและโดรน (Mission & Drone Config)</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ระบุชื่อภารกิจ เลือกรุ่นอากาศยาน รูปแบบการบิน ความสูง และความเร็วในการสำรวจ
              </p>
            </div>

            {/* Mission Name */}
            <div>
              <label className="block text-foreground font-semibold mb-1">ชื่อภารกิจ (Mission Name)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="เช่น แผนการบินสำรวจพื้นที่ A"
                className="w-full px-3 py-2 bg-card-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Target Platform Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-foreground font-semibold">แพลตฟอร์มเป้าหมาย (Target Platform)</label>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                  selectedCaps.verificationStatus === 'VERIFIED'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                }`}>
                  {selectedCaps.verificationStatus}
                </span>
              </div>
              <select
                value={targetPlatform}
                onChange={(e) => {
                  const newPlatform = e.target.value as PlatformId;
                  onTargetPlatformChange(newPlatform);
                  if (newPlatform === 'dji_mini_4_pro') {
                    onDroneModelChange('DJI Mini 4 Pro');
                    onCameraModelChange('DJI Mini 4 Pro (Wide 24mm - 48MP)');
                  } else if (newPlatform === 'dji_enterprise_wpml') {
                    onDroneModelChange('DJI Matrice 350 RTK');
                    onCameraModelChange('DJI Zenmuse P1 (35mm)');
                  } else if (newPlatform === 'px4_mavlink' || newPlatform === 'ardupilot_mavlink') {
                    onDroneModelChange('PX4 / ArduPilot Multirotor');
                    onCameraModelChange('Sony A7R IV (35mm)');
                  }
                }}
                className="w-full px-3 py-2 bg-card-secondary border border-border rounded-xl text-foreground font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="dji_mini_4_pro">DJI Mini 4 Pro (MSDK V5 Android Bridge)</option>
                <option value="dji_enterprise_wpml">DJI Enterprise (M350 RTK, M300, M3E - Pilot 2 WPML)</option>
                <option value="px4_mavlink">PX4 Autopilot (MAVLink v2 / QGroundControl .plan)</option>
                <option value="ardupilot_mavlink">ArduPilot (ArduCopter / Mission Planner .waypoints)</option>
              </select>
            </div>

            {/* Camera Model Preset */}
            <div>
              <label className="block text-foreground font-semibold mb-1">เซนเซอร์และกล้อง (Camera Preset)</label>
              <select
                value={cameraModel}
                onChange={(e) => onCameraModelChange(e.target.value)}
                className="w-full px-3 py-2 bg-card-secondary border border-border rounded-xl text-foreground font-medium focus:outline-none focus:border-primary"
              >
                {Object.keys(CAMERA_PRESETS).map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>

            {/* Mission Type */}
            <div>
              <label className="block text-foreground font-semibold mb-1">รูปแบบแนวบิน (Mission Pattern)</label>
              <select
                value={missionType}
                onChange={(e) => onMissionTypeChange(e.target.value)}
                className="w-full px-3 py-2 bg-card-secondary border border-border rounded-xl text-foreground font-medium focus:outline-none focus:border-primary"
              >
                <option value="grid_survey">Grid Survey (สำรวจตารางขนาน Orthomosaic)</option>
                <option value="crosshatch_3d">Double Grid / Crosshatch (แนวตัดขวาง แบบจำลอง 3D)</option>
                <option value="corridor_mapping">Corridor Mapping (แนวเส้นทาง ถนน เสาไฟ ท่อส่ง)</option>
              </select>
            </div>

            {/* Flight Altitude & Speed */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-foreground font-semibold mb-1">
                  ความสูงบิน: <span className="text-primary font-mono">{targetAltitudeM}m</span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="120"
                  step="5"
                  value={targetAltitudeM}
                  onChange={(e) => onTargetAltitudeChange(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">
                  ความเร็ว: <span className="text-primary font-mono">{flightSpeedMps} m/s</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="15"
                  step="0.5"
                  value={flightSpeedMps}
                  onChange={(e) => onFlightSpeedChange(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            {/* Altitude Reference */}
            <div>
              <label className="block text-foreground font-semibold mb-1">ระบบอ้างอิงความสูง (Altitude Datum)</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => onAltitudeReferenceChange('relative_to_home')}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                    altitudeReference === 'relative_to_home'
                      ? 'bg-primary text-white border-primary shadow-xs font-bold'
                      : 'bg-card-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Relative Home
                </button>
                <button
                  type="button"
                  onClick={() => onAltitudeReferenceChange('agl')}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                    altitudeReference === 'agl'
                      ? 'bg-primary text-white border-primary shadow-xs font-bold'
                      : 'bg-card-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  AGL (พื้นดิน)
                </button>
                <button
                  type="button"
                  onClick={() => onAltitudeReferenceChange('amsl')}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                    altitudeReference === 'amsl'
                      ? 'bg-primary text-white border-primary shadow-xs font-bold'
                      : 'bg-card-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  AMSL (ทะเล)
                </button>
              </div>
            </div>

            {/* Overlap Sliders */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-foreground font-semibold mb-1">
                  Front Overlap: <span className="text-primary font-mono">{forwardOverlap}%</span>
                </label>
                <input
                  type="range"
                  min="60"
                  max="90"
                  step="5"
                  value={forwardOverlap}
                  onChange={(e) => onForwardOverlapChange(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">
                  Side Overlap: <span className="text-primary font-mono">{sideOverlap}%</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="85"
                  step="5"
                  value={sideOverlap}
                  onChange={(e) => onSideOverlapChange(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            {/* Step 2 Navigation Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-border bg-card-secondary hover:bg-muted font-semibold flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ย้อนกลับ</span>
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-1.5 shadow-md hover:bg-primary/90"
              >
                <span>ถัดไป: คำนวณ (Step 3)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: FLIGHT CALCULATION & PHOTOGRAMMETRY */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl space-y-1">
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">3</span>
                <span>ขั้นตอนที่ 3: คำนวณแนวบิน (Calculate Flight Plan)</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                คลิกปุ่มด้านล่างเพื่อคำนวณแนวบิน พิกัด Waypoints และจุดกดถ่ายภาพจริงตามสมการโฟโตแกรมเมตรี
              </p>
            </div>

            {/* Calculate Button */}
            <div className="p-3 rounded-2xl bg-card-secondary border border-border space-y-2.5">
              <button
                onClick={onCalculateFlightPlan}
                disabled={workflowState === 'CALCULATING' || polygonVertexCount < 3}
                className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition-all cursor-pointer ${
                  workflowState === 'CALCULATING'
                    ? 'bg-amber-600 text-white animate-pulse'
                    : polygonVertexCount < 3
                    ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border'
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                {workflowState === 'CALCULATING' ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>กำลังคำนวณแนวบินโฟโตแกรมเมตรี...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>คำนวณแผนการบิน (Calculate Flight Plan)</span>
                  </>
                )}
              </button>

              {workflowState === 'OUTDATED' && (
                <div className="text-[11px] text-warning flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>พารามิเตอร์เปลี่ยนไป: กดคำนวณใหม่เพื่อปรับปรุงเส้นทางบิน</span>
                </div>
              )}
            </div>

            {/* Grid Angle Slider & Presets */}
            <div className="space-y-2 p-3 bg-card-secondary/70 border border-border rounded-xl">
              <div className="flex justify-between items-center">
                <label className="text-foreground font-semibold flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-primary" />
                  มุมแนวบิน (Flight Heading)
                </label>
                <span className="font-mono text-primary font-bold text-xs">{gridAngleDeg}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={gridAngleDeg}
                onChange={(e) => onGridAngleDegChange(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="grid grid-cols-4 gap-1 pt-1">
                {[0, 45, 90, 135].map((ang) => (
                  <button
                    key={ang}
                    onClick={() => onGridAngleDegChange(ang)}
                    className={`py-1 text-[10px] rounded-lg border font-mono transition-colors ${
                      gridAngleDeg === ang
                        ? 'bg-primary text-white border-primary font-bold'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {ang}°
                  </button>
                ))}
              </div>
            </div>

            {/* Photogrammetry HUD */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-primary" />
                <span>ผลการคำนวณทางทัศนศาสตร์ (Photogrammetry HUD)</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-card-secondary rounded-xl border border-border">
                  <div className="text-[10px] text-muted-foreground">ความละเอียดภาพ (GSD)</div>
                  <div className="text-sm font-bold text-primary mt-1">
                    {photogrammetryInfo.gsdCmPerPixel.toFixed(2)}{' '}
                    <span className="text-[10px] font-normal text-muted-foreground">cm/px</span>
                  </div>
                </div>

                <div className="p-2.5 bg-card-secondary rounded-xl border border-border">
                  <div className="text-[10px] text-muted-foreground">ระยะกดชัตเตอร์</div>
                  <div className="text-sm font-bold text-foreground mt-1">
                    {photogrammetryInfo.photoTriggerDistanceMeters.toFixed(1)}{' '}
                    <span className="text-[10px] font-normal text-muted-foreground">ม.</span>
                  </div>
                </div>

                <div className="p-2.5 bg-card-secondary rounded-xl border border-border">
                  <div className="text-[10px] text-muted-foreground">ระยะห่างแนวบิน</div>
                  <div className="text-sm font-bold text-foreground mt-1">
                    {photogrammetryInfo.flightLineSpacingMeters.toFixed(1)}{' '}
                    <span className="text-[10px] font-normal text-muted-foreground">ม.</span>
                  </div>
                </div>

                <div className="p-2.5 bg-card-secondary rounded-xl border border-border">
                  <div className="text-[10px] text-muted-foreground">ขนาดครอบคลุมต่อภาพ</div>
                  <div className="text-sm font-bold text-foreground mt-1">
                    {photogrammetryInfo.groundCoverageWidthMeters.toFixed(0)}{' '}
                    <span className="text-[10px] font-normal text-muted-foreground">ม.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 Navigation Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-border bg-card-secondary hover:bg-muted font-semibold flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ย้อนกลับ</span>
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={waypoints.length === 0}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  waypoints.length > 0
                    ? 'bg-primary text-white shadow-md hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground border border-border cursor-not-allowed'
                }`}
              >
                <span>ถัดไป: ตรวจสอบ (Step 4)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: VALIDATION & STATISTICS */}
        {/* ========================================================================= */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl space-y-1">
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">4</span>
                <span>ขั้นตอนที่ 4: ตรวจสอบความปลอดภัยและสถิติ (Validation)</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ตรวจสอบความถูกต้อง ความพร้อมในการบิน และสถิติการใช้พลังงานก่อนทำการส่งออก
              </p>
            </div>

            {/* Feasibility Status Badge */}
            <div
              className={`p-3 rounded-xl border flex items-center gap-3 ${
                validationResult.status === 'PASS'
                  ? 'bg-success/10 border-success/40 text-success'
                  : validationResult.status === 'WARNING'
                  ? 'bg-warning/10 border-warning/40 text-warning'
                  : 'bg-destructive/10 border-destructive/40 text-destructive'
              }`}
            >
              {validationResult.status === 'PASS' && <CheckCircle2 className="w-6 h-6 text-success shrink-0" />}
              {validationResult.status === 'WARNING' && <AlertTriangle className="w-6 h-6 text-warning shrink-0" />}
              {validationResult.status === 'BLOCKED' && <XCircle className="w-6 h-6 text-destructive shrink-0" />}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {validationResult.status === 'PASS' && 'ผ่านการตรวจสอบความปลอดภัย'}
                  {validationResult.status === 'WARNING' && 'ผ่านแบบมีข้อควรระวัง'}
                  {validationResult.status === 'BLOCKED' && 'ไม่อนุญาตให้ทำการบิน'}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  {validationResult.status === 'PASS' && 'พารามิเตอร์และการกระจายจุดบินสอดคล้องตามเกณฑ์'}
                  {validationResult.status === 'WARNING' && 'มีประเด็นควรพิจารณาเพิ่มเติมก่อนทำการบิน'}
                  {validationResult.status === 'BLOCKED' && 'พบข้อผิดพลาดหรือขาดจุดขึ้นบิน/ขอบเขต'}
                </div>
              </div>
            </div>

            {/* Flight Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-card-secondary rounded-xl border border-border">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Compass className="w-3 h-3 text-primary" />
                  <span>ระยะทางบินรวม</span>
                </div>
                <div className="text-sm font-bold text-foreground mt-1">
                  {(totalDistanceM / 1000).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">กม.</span>
                </div>
              </div>

              <div className="p-2.5 bg-card-secondary rounded-xl border border-border">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3 text-primary" />
                  <span>เวลาบินโดยประมาณ</span>
                </div>
                <div className="text-sm font-bold text-primary mt-1">
                  {durationMin}:{durationSec.toString().padStart(2, '0')}{' '}
                  <span className="text-xs font-normal text-muted-foreground">นาที</span>
                </div>
              </div>

              <div className="p-2.5 bg-card-secondary rounded-xl border border-border">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <BatteryCharging className="w-3 h-3 text-success" />
                  <span>แบตเตอรี่ที่ต้องใช้</span>
                </div>
                <div className="text-sm font-bold text-success mt-1">
                  {batteryCount} <span className="text-xs font-normal text-muted-foreground">ก้อน ({batteryMinutes} น./ก้อน)</span>
                </div>
              </div>

              <div className="p-2.5 bg-card-secondary rounded-xl border border-border">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>ภาพถ่ายโดยประมาณ</span>
                </div>
                <div className="text-sm font-bold text-amber-500 mt-1">
                  {photoCount} <span className="text-xs font-normal text-muted-foreground">รูป</span>
                </div>
              </div>
            </div>

            {/* Altitude Profile SVG Preview */}
            <div className="p-3 bg-card-secondary rounded-xl border border-border space-y-2">
              <div className="flex justify-between items-center text-[11px] font-bold">
                <span>โปรไฟล์ความสูง (Altitude Profile)</span>
                <span className="font-mono text-primary">{targetAltitudeM}m ({altitudeReference})</span>
              </div>
              <div className="h-16 w-full bg-card rounded-lg border border-border p-2 flex items-end gap-1 overflow-x-auto">
                {waypoints.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                    ยังไม่มีข้อมูล Waypoint
                  </div>
                ) : (
                  waypoints.slice(0, 24).map((wp, idx) => {
                    const heightPct = Math.min(Math.max((wp.altitudeMeters / 150) * 100, 10), 100);
                    return (
                      <div
                        key={idx}
                        title={`WP #${wp.sequence || idx + 1}: ${wp.altitudeMeters}m`}
                        className="flex-1 min-w-[6px] bg-primary rounded-t-sm hover:opacity-80 transition-opacity"
                        style={{ height: `${heightPct}%` }}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* Validation Issues breakdown */}
            {errors.length > 0 && (
              <div className="space-y-1.5">
                {errors.map((e, idx) => (
                  <div key={idx} className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-[11px] text-destructive flex items-center gap-2">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{e.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Step 4 Navigation Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-border bg-card-secondary hover:bg-muted font-semibold flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ย้อนกลับ</span>
              </button>
              <button
                onClick={() => setStep(5)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-1.5 shadow-md hover:bg-primary/90"
              >
                <span>ถัดไป: ส่งออก (Step 5)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 5: EXPORT & SAVE MISSION */}
        {/* ========================================================================= */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl space-y-1">
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">5</span>
                <span>ขั้นตอนที่ 5: ส่งออกและบันทึกภารกิจ (Export & Execution)</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ส่งออกไฟล์ภารกิจสำหรับการบินอัตโนมัติ และบันทึกเข้าสู่ฐานข้อมูลโครงการ
              </p>
            </div>

            {/* Export Quick Action Card */}
            <div className="p-3 bg-card-secondary rounded-xl border border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <FileDown className="w-4 h-4 text-primary" />
                  ส่งออกไฟล์สำหรับอุปกรณ์โดรน
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-semibold border border-success/30">
                  {waypoints.length} Waypoints พร้อมส่งออก
                </span>
              </div>

              <button
                onClick={() => onOpenExportModal && onOpenExportModal()}
                disabled={waypoints.length === 0}
                className={`w-full py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  waypoints.length > 0
                    ? 'bg-primary text-white hover:bg-primary/90 shadow-md'
                    : 'bg-muted text-muted-foreground border border-border cursor-not-allowed'
                }`}
              >
                <FileDown className="w-4 h-4" />
                <span>เปิดหน้าต่างส่งออกไฟล์ (DJI WPML, QGC, MAVLink)</span>
              </button>
            </div>

            {/* Save to Project Database Card */}
            <div className="p-3 bg-card-secondary rounded-xl border border-border space-y-2.5">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Save className="w-4 h-4 text-emerald-500" />
                บันทึกภารกิจลงฐานข้อมูล (Database)
              </span>
              <button
                onClick={() => onSaveMission && onSaveMission()}
                disabled={isSaving || waypoints.length === 0}
                className={`w-full py-2 px-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  waypoints.length > 0
                    ? 'bg-card border-border hover:bg-muted text-foreground'
                    : 'bg-muted text-muted-foreground border-border cursor-not-allowed'
                }`}
              >
                {isSaving ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังบันทึกข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-emerald-500" />
                    <span>บันทึกภารกิจ (Save Mission)</span>
                  </>
                )}
              </button>
            </div>

            {/* Drone Bridge Mobile Bridge Card */}
            <div className="p-3 bg-card-secondary rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-cyan-500" />
                  GeoMonitor Drone Bridge
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  isBridgeConnected ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                }`}>
                  {isBridgeConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>
              <button
                onClick={() => onToggleBridge && onToggleBridge()}
                className="w-full py-1.5 px-3 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-all cursor-pointer"
              >
                {isBridgeConnected ? 'ตัดการเชื่อมต่อ Drone Bridge' : 'เชื่อมต่อ Drone Bridge (Android MSDK V5)'}
              </button>
            </div>

            {/* Step 5 Navigation Buttons */}
            <div className="pt-2">
              <button
                onClick={() => setStep(4)}
                className="w-full py-2.5 px-3 rounded-xl border border-border bg-card-secondary hover:bg-muted font-semibold flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ย้อนกลับไปขั้นตอนตรวจสอบ (Step 4)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
