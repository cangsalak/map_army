'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { CAMERA_PRESETS } from '@/lib/drone-route-generator';
import { DroneInteractionMode } from '../map/CesiumMap';
import { PlatformId, MissionWorkflowState } from '@geomonitor/shared';
import { PLATFORM_REGISTRY } from '@/lib/drone-platform-registry';
import { Sparkles } from 'lucide-react';

interface MissionConfigPanelProps {
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
}

export default function MissionConfigPanel({
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
}: MissionConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<'mission' | 'camera' | 'flight' | 'area'>('mission');
  const selectedCaps = PLATFORM_REGISTRY[targetPlatform] || PLATFORM_REGISTRY.dji_mini_4_pro;

  return (
    <div className="flex flex-col h-full bg-[#101A2D]/95 border-r border-[rgba(148,163,184,0.20)] text-[#CBD5E1] select-none backdrop-blur-md">
      {/* Panel Header */}
      <div className="h-12 px-4 border-b border-[rgba(148,163,184,0.15)] bg-[#162238]/70 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#06B6D4]/15 border border-[#06B6D4]/40 text-[#06B6D4] flex items-center justify-center shadow-sm">
            <Plane className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider">ตั้งค่าภารกิจการบิน</h3>
            <p className="text-[10px] text-[#94A3B8]">Multi-Platform Drone Planner</p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-tabs */}
      <div className="grid grid-cols-4 p-1.5 gap-1 bg-[#080F20]/50 border-b border-[rgba(148,163,184,0.15)] text-[11px] font-medium shrink-0">
        <button
          onClick={() => setActiveTab('mission')}
          className={`py-2 px-1 rounded-lg flex flex-col items-center justify-center transition-all ${
            activeTab === 'mission'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5 mb-1" />
          <span>ภารกิจ</span>
        </button>

        <button
          onClick={() => setActiveTab('camera')}
          className={`py-2 px-1 rounded-lg flex flex-col items-center justify-center transition-all ${
            activeTab === 'camera'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Camera className="w-3.5 h-3.5 mb-1" />
          <span>กล้อง</span>
        </button>

        <button
          onClick={() => setActiveTab('flight')}
          className={`py-2 px-1 rounded-lg flex flex-col items-center justify-center transition-all ${
            activeTab === 'flight'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 mb-1" />
          <span>การบิน</span>
        </button>

        <button
          onClick={() => setActiveTab('area')}
          className={`py-2 px-1 rounded-lg flex flex-col items-center justify-center transition-all ${
            activeTab === 'area'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 mb-1" />
          <span>พื้นที่</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* TAB 1: MISSION */}
        {activeTab === 'mission' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">ชื่อภารกิจ (Mission Name)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="เช่น แผนการบินสำรวจพื้นที่ A"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Target Platform Selector (Multi-Platform Architecture) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold">แพลตฟอร์มเป้าหมาย (Target Platform)</label>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  selectedCaps.verificationStatus === 'VERIFIED'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                    : selectedCaps.verificationStatus === 'VERIFIED_WITH_LIMITATIONS'
                    ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                    : 'bg-rose-950 text-rose-400 border border-rose-500/40'
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
                className="w-full px-3 py-2 bg-slate-900 border border-cyan-500/50 rounded-lg text-white font-medium focus:outline-none focus:border-cyan-400"
              >
                <option value="dji_mini_4_pro">DJI Mini 4 Pro (MSDK V5 Android Bridge)</option>
                <option value="dji_enterprise_wpml">DJI Enterprise (M350 RTK, M300, M3E - Pilot 2 WPML)</option>
                <option value="px4_mavlink">PX4 Autopilot (MAVLink v2 / QGroundControl .plan)</option>
                <option value="ardupilot_mavlink">ArduPilot (ArduCopter / Mission Planner .waypoints)</option>
              </select>

              {/* Platform Capability Summary Card */}
              <div className="mt-2 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-slate-300">
                  <span>ขีดจำกัด Waypoint:</span>
                  <span className="font-mono text-cyan-400 font-bold">{selectedCaps.maxWaypoints} จุด</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>ระยะทางบินสูงสุด:</span>
                  <span className="font-mono text-cyan-400 font-bold">{(selectedCaps.maxFlightDistanceMeters / 1000).toFixed(0)} km</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>รีโมทที่ต้องใช้:</span>
                  <span className="text-slate-400 font-mono text-[10px]">{selectedCaps.requiredController}</span>
                </div>

                {/* Important Platform Limitations Warning */}
                {targetPlatform === 'dji_mini_4_pro' && (
                  <div className="mt-2 p-2 rounded bg-amber-950/40 border border-amber-600/40 text-amber-300 text-[10px] leading-relaxed">
                    <p className="font-bold flex items-center gap-1 text-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      ข้อจำกัดจริงของ DJI Mini 4 Pro:
                    </p>
                    <p className="mt-0.5">
                      • DJI Fly ไม่มีฟังก์ชัน Import ไฟล์ภารกิจภายนอก (.kmz/.kml)
                    </p>
                    <p>
                      • การบินอัตโนมัติต้องเชื่อมต่อผ่าน <strong>GeoMonitor Drone Bridge (Android)</strong> ที่เสียบสาย USB กับรีโมท RC-N2
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">คำอธิบาย (Description)</label>
              <textarea
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                rows={2}
                placeholder="รายละเอียดเพิ่มเติมของภารกิจ..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">รุ่นอากาศยาน (Drone Model)</label>
              <input
                type="text"
                value={droneModel}
                onChange={(e) => onDroneModelChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">ประเภทภารกิจ (Mission Type)</label>
              <select
                value={missionType}
                onChange={(e) => onMissionTypeChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="grid_survey">Grid Survey (สำรวจตารางขนาน Orthomosaic)</option>
                <option value="crosshatch_survey">Crosshatch Survey (ตารางตัดขวาง 3D Mesh)</option>
                <option value="corridor_mapping">Corridor Mapping (แนวเส้นทาง ถนน คลอง)</option>
                <option value="waypoint_mission">Waypoint Mission (ตรวจการณ์ตามจุด)</option>
                <option value="orbit_poi">Orbit POI (บินวนรอบวัตถุตรวจสอบ 360°)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">พฤติกรรมเมื่อจบภารกิจ (Finish Action)</label>
              <select
                value={finishAction}
                onChange={(e) => onFinishActionChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="return_to_home">บินกลับจุดขึ้นบิน (Return to Home - RTH)</option>
                <option value="hover">ลอยลำค้างที่จุดสุดท้าย (Hover at Final Waypoint)</option>
                <option value="land_at_last_waypoint">ลงจอดอัตโนมัติที่จุดสุดท้าย (Auto Land)</option>
              </select>
            </div>
          </div>
        )}

        {/* TAB 2: CAMERA & PHOTOGRAMMETRY */}
        {activeTab === 'camera' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">กล้องและเซนเซอร์ (Camera Preset)</label>
              <select
                value={cameraModel}
                onChange={(e) => onCameraModelChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              >
                {Object.keys(CAMERA_PRESETS).map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>

              {/* Real Camera Hardware Specifications */}
              {CAMERA_PRESETS[cameraModel] && (
                <div className="mt-2 p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-[11px] space-y-1">
                  <div className="font-semibold text-slate-300">สเปกฮาร์ดแวร์เซนเซอร์จริง:</div>
                  <div className="grid grid-cols-2 gap-1 text-slate-400">
                    <div>• เซนเซอร์: <span className="text-white font-mono">{CAMERA_PRESETS[cameraModel].sensorWidthMm} × {CAMERA_PRESETS[cameraModel].sensorHeightMm} mm</span></div>
                    <div>• ทางยาวโฟกัส: <span className="text-white font-mono">{CAMERA_PRESETS[cameraModel].focalLengthMm} mm</span></div>
                    <div className="col-span-2">• ขนาดภาพ: <span className="text-white font-mono">{CAMERA_PRESETS[cameraModel].imageWidthPx} × {CAMERA_PRESETS[cameraModel].imageHeightPx} px</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Overlap Sliders */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-semibold">Front Overlap (ส่วนซ้อนหน้า)</span>
                  <span className="font-bold text-cyan-400">{forwardOverlap}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="85"
                  step="1"
                  value={forwardOverlap}
                  onChange={(e) => onForwardOverlapChange(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-semibold">Side Overlap (ส่วนซ้อนข้าง)</span>
                  <span className="font-bold text-cyan-400">{sideOverlap}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="80"
                  step="1"
                  value={sideOverlap}
                  onChange={(e) => onSideOverlapChange(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>

            {/* Gimbal Pitch Slider */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-semibold">มุมก้มกล้อง (Gimbal Pitch)</span>
                <span className="font-bold text-cyan-400">
                  {gimbalPitchDeg}° {gimbalPitchDeg === -90 ? '(Nadir 2D)' : '(Oblique 3D)'}
                </span>
              </div>
              <input
                type="range"
                min="-90"
                max="-45"
                step="5"
                value={gimbalPitchDeg}
                onChange={(e) => onGimbalPitchDegChange && onGimbalPitchDegChange(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => onGimbalPitchDegChange && onGimbalPitchDegChange(-90)}
                  className={`py-1 text-[10px] rounded font-semibold transition-all ${
                    gimbalPitchDeg === -90
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  -90° Nadir (2D Mapping)
                </button>
                <button
                  type="button"
                  onClick={() => onGimbalPitchDegChange && onGimbalPitchDegChange(-65)}
                  className={`py-1 text-[10px] rounded font-semibold transition-all ${
                    gimbalPitchDeg === -65
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  -65° Oblique (3D Mesh)
                </button>
              </div>
            </div>

            {/* Shutter Capture Mode */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">โหมดการลั่นชัตเตอร์ (Capture Mode)</label>
              <select
                value={captureMode}
                onChange={(e) => onCaptureModeChange && onCaptureModeChange(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="distance_interval">Distance Interval (ถ่ายตามระยะห่างเมตร)</option>
                <option value="time_interval">Time Interval (ถ่ายตามช่วงเวลารอบวินาที)</option>
                <option value="stop_and_shoot">Stop & Shoot (หยุดถ่ายที่จุด - ชัดเจนสูงสุด)</option>
              </select>
            </div>

            {/* Live Photogrammetry HUD Output */}
            <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>ผลการคำนวณ Photogrammetry</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">ค่า GSD เป้าหมาย</div>
                  <div className="font-bold text-cyan-300 text-sm">{photogrammetryInfo.gsdCmPerPixel} cm/px</div>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">ระยะห่างแนวบิน (Line Spacing)</div>
                  <div className="font-bold text-white text-sm">{photogrammetryInfo.flightLineSpacingMeters} m</div>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">ระยะกดชัตเตอร์ (Photo Spacing)</div>
                  <div className="font-bold text-white text-sm">{photogrammetryInfo.photoTriggerDistanceMeters} m</div>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">ช่วงเวลากดชัตเตอร์ (Interval)</div>
                  <div className="font-bold text-amber-400 text-sm">{photogrammetryInfo.photoIntervalSeconds} s</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FLIGHT PARAMETERS */}
        {activeTab === 'flight' && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-300 font-semibold">ความสูงการบินเป้าหมาย (Flight Altitude)</label>
                <span className={`font-bold ${targetAltitudeM > 120 ? 'text-rose-400' : 'text-cyan-400'}`}>
                  {targetAltitudeM} เมตร
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="150"
                step="5"
                value={targetAltitudeM}
                onChange={(e) => onTargetAltitudeChange(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              {targetAltitudeM > 120 && (
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-rose-400 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>เกินเพดานบินตามกฎหมาย CAAT (120m AGL) ต้องขออนุญาตพิเศษ</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">ระบบอ้างอิงความสูง (Altitude Reference)</label>
              <select
                value={altitudeReference}
                onChange={(e) => onAltitudeReferenceChange(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="relative_to_home">Relative to Home (เทียบจุดขึ้นบิน - ปลอดภัยสูงสุด)</option>
                <option value="agl">AGL Terrain Following (รักษาระดับเหนือผิวดิน)</option>
                <option value="amsl">AMSL (เทียบระดับน้ำทะเลปานกลาง WGS84)</option>
              </select>
              {altitudeReference === 'agl' && (
                <p className="mt-1 text-[10px] text-amber-400/90 leading-tight">
                  ⚠️ โหมด AGL ต้องใช้เซนเซอร์เรดาร์วัดความสูงผิวดินจริง หรือ DEM ที่ตรวจสอบแล้ว
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-300 font-semibold">ความเร็วบินสำรวจ (Cruise Speed)</label>
                <span className="font-bold text-cyan-400">{flightSpeedMps} m/s</span>
              </div>
              <input
                type="range"
                min="3"
                max="18"
                step="0.5"
                value={flightSpeedMps}
                onChange={(e) => onFlightSpeedChange(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">ความสูงบินกลับฉุกเฉิน (RTH Altitude)</label>
              <input
                type="number"
                value={rthAltitudeM}
                onChange={(e) => onRthAltitudeChange(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Grid Angle Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-300 font-semibold">ทิศทางแนวบิน (Grid Angle Direction)</label>
                <span className="font-bold text-amber-400">{gridAngleDeg}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={gridAngleDeg}
                onChange={(e) => onGridAngleDegChange(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              <div className="grid grid-cols-4 gap-1 mt-1.5">
                {[0, 45, 90, 135].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => onGridAngleDegChange(deg)}
                    className="py-1 px-1.5 rounded bg-slate-800 text-[10px] hover:bg-slate-700 text-slate-300 font-mono"
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">รูปแบบการเลี้ยว (Turn Strategy)</label>
              <select
                value={turnStrategy}
                onChange={(e) => onTurnStrategyChange(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="to_point_and_stop">To Point & Stop (หยุดหมุนที่หัวเลี้ยว - แม่นยำ)</option>
                <option value="curve_through">Curve Through (เลี้ยวโค้งต่อเนื่อง - ประหยัดเวลา)</option>
              </select>
            </div>

            {/* Orbit Specific Settings */}
            {missionType === 'orbit_poi' && (
              <div className="p-3 bg-amber-950/20 border border-amber-600/40 rounded-xl space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-amber-300 font-semibold">รัศมีวงโคจร (Orbit Radius)</span>
                  <span className="font-bold text-amber-400">{orbitRadiusM} เมตร</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="150"
                  step="5"
                  value={orbitRadiusM}
                  onChange={(e) => onOrbitRadiusChange && onOrbitRadiusChange(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <p className="text-[10px] text-slate-400">
                  กล้องจะปรับมุมและหันหน้าเข้าหาจุดศูนย์กลาง (Center POI) อัตโนมัติทุกองศา
                </p>
              </div>
            )}

            {/* Corridor Specific Settings */}
            {missionType === 'corridor_mapping' && (
              <div className="p-3 bg-cyan-950/20 border border-cyan-600/40 rounded-xl space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-cyan-300 font-semibold">ความกว้างแนวสำรวจ (Corridor Width)</span>
                  <span className="font-bold text-cyan-400">{corridorWidthM} เมตร</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="250"
                  step="10"
                  value={corridorWidthM}
                  onChange={(e) => onCorridorWidthChange && onCorridorWidthChange(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
                <p className="text-[10px] text-slate-400">
                  สร้างแนวบินขนานกึ่งกลางถนน/คลองตามค่า Side Overlap
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: AREA DEFINITION */}
        {activeTab === 'area' && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">เลือกพื้นที่จากโครงการ (Project Area)</label>
              <select
                onChange={(e) => onSelectProjectArea(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">-- เลือกพื้นที่ที่บันทึกไว้ --</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">จำนวนจุดยอดขอบเขต:</span>
                <span className="font-bold text-cyan-400">{polygonVertexCount} จุด</span>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => onSetInteractionMode(interactionMode === 'draw_polygon' ? 'none' : 'draw_polygon')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    interactionMode === 'draw_polygon'
                      ? 'bg-amber-500 text-slate-950 shadow-lg'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{interactionMode === 'draw_polygon' ? 'กำลังวาด...' : 'วาดพื้นที่บิน'}</span>
                </button>

                <button
                  onClick={onClearPolygon}
                  className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-rose-950/50 hover:text-rose-400 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-slate-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ล้างขอบเขต</span>
                </button>

                {onOpenImportKml && (
                  <button
                    type="button"
                    onClick={onOpenImportKml}
                    className="col-span-2 py-2 px-3 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center gap-2 border border-indigo-500/40 transition-all cursor-pointer"
                    title="นำเข้าขอบเขตจากไฟล์ .kml หรือ .kmz"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>นำเข้า KML/KMZ เป็นพื้นที่สำรวจ</span>
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                จุดอ้างอิงการบิน (Reference Points)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onSetInteractionMode(interactionMode === 'set_home' ? 'none' : 'set_home')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    interactionMode === 'set_home'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>{interactionMode === 'set_home' ? 'กำลังเลือก...' : 'ตั้ง Home Point'}</span>
                </button>

                <button
                  onClick={() => onSetInteractionMode(interactionMode === 'set_takeoff' ? 'none' : 'set_takeoff')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    interactionMode === 'set_takeoff'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30'
                  }`}
                >
                  <Plane className="w-3.5 h-3.5" />
                  <span>{interactionMode === 'set_takeoff' ? 'กำลังเลือก...' : 'จุด Takeoff'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Bottom Action / Calculate Button */}
      <div className="p-3.5 bg-[#162238]/90 border-t border-[rgba(148,163,184,0.20)] space-y-2 shrink-0">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#94A3B8] font-medium">สถานะภารกิจ:</span>
          {workflowState === 'EMPTY' && (
            <span className="px-2 py-0.5 rounded bg-[#101A2D] text-slate-400 font-medium border border-[rgba(148,163,184,0.20)]">
              ยังไม่ได้กำหนดพื้นที่
            </span>
          )}
          {(workflowState === 'AREA_DEFINED' || workflowState === 'READY_TO_CALCULATE') && (
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 font-semibold border border-cyan-500/40">
              พร้อมคำนวณ ({polygonVertexCount} จุด)
            </span>
          )}
          {workflowState === 'CALCULATING' && (
            <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 font-semibold border border-amber-500/40 animate-pulse">
              กำลังคำนวณ...
            </span>
          )}
          {(workflowState === 'CALCULATED' || workflowState === 'EXPORT_READY') && (
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-semibold border border-emerald-500/40">
              ✓ คำนวณสำเร็จ
            </span>
          )}
          {workflowState === 'OUTDATED' && (
            <span className="px-2 py-0.5 rounded bg-amber-950/90 text-amber-300 font-semibold border border-amber-500/60 animate-pulse">
              ⚠️ OUTDATED
            </span>
          )}
          {workflowState === 'VALIDATION_FAILED' && (
            <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 font-semibold border border-rose-500/40">
              ❌ ตรวจสอบไม่ผ่าน
            </span>
          )}
        </div>

        <button
          onClick={onCalculateFlightPlan}
          disabled={polygonVertexCount < 3 && missionType !== 'orbit_poi'}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            polygonVertexCount < 3 && missionType !== 'orbit_poi'
              ? 'bg-[#101A2D] text-slate-500 border border-[rgba(148,163,184,0.15)] cursor-not-allowed opacity-50'
              : workflowState === 'OUTDATED'
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.45)] animate-pulse'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-slate-950" />
          <span>
            {workflowState === 'CALCULATING'
              ? 'กำลังคำนวณ Photogrammetry...'
              : workflowState === 'OUTDATED'
              ? '⚠️ คำนวณใหม่ (Recalculate Flight Plan)'
              : 'คำนวณแผนการบิน (Calculate Flight Plan)'}
          </span>
        </button>
      </div>
    </div>
  );
}
