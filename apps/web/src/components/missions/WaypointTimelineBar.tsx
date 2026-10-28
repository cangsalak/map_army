'use client';

import React, { useState } from 'react';
import {
  Play,
  Save,
  Download,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  MapPin,
  CheckCircle2,
  Trash2,
  Radio,
  FileCheck,
} from 'lucide-react';
import { DroneWaypointDTO, MissionWorkflowState } from '@geomonitor/shared';
import { FlightLineSegment } from '@/lib/drone-route-generator';

interface WaypointTimelineBarProps {
  waypoints: DroneWaypointDTO[];
  flightLines?: FlightLineSegment[];
  finishAction?: string;
  selectedWaypointIndex?: number | null;
  onSelectWaypoint: (idx: number | null) => void;
  onGenerateRoute: () => void;
  onSaveMission: () => void;
  onOpenExportModal: () => void;
  onOpenSavedMissions: () => void;
  onClearRoute: () => void;
  isSaving?: boolean;
  isBridgeConnected?: boolean;
  onToggleBridge?: () => void;
  onUploadMission?: () => void;
  isUploading?: boolean;
  uploadState?: string;
  onEmergencyStop?: () => void;
  onPauseMission?: () => void;
  workflowState?: MissionWorkflowState;
  polygonVertexCount?: number;
}

export default function WaypointTimelineBar({
  waypoints,
  flightLines = [],
  finishAction = 'return_to_home',
  selectedWaypointIndex,
  onSelectWaypoint,
  onGenerateRoute,
  onSaveMission,
  onOpenExportModal,
  onOpenSavedMissions,
  onClearRoute,
  isSaving = false,
  isBridgeConnected = false,
  onToggleBridge,
  onUploadMission,
  isUploading = false,
  uploadState = 'IDLE',
  onEmergencyStop,
  onPauseMission,
  workflowState = 'EMPTY',
  polygonVertexCount = 0,
}: WaypointTimelineBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-[#101A2D]/95 border-t border-[rgba(148,163,184,0.20)] backdrop-blur-md select-none text-[#CBD5E1] shadow-2xl flex flex-col z-20">
      {/* 1. Flight Sequence Step Strip (Visible when flight lines exist) */}
      {flightLines.length > 0 && (
        <div className="px-4 py-1.5 bg-[#080F20]/80 border-b border-[rgba(148,163,184,0.15)] flex items-center gap-1.5 overflow-x-auto text-[11px] whitespace-nowrap scrollbar-none">
          <span className="text-[10px] uppercase font-bold text-[#94A3B8] mr-1 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] animate-pulse" />
            ลำดับการบิน:
          </span>

          <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono text-[11px]">
            🛫 Takeoff
          </span>

          <span className="text-slate-600">→</span>

          <span className="px-2 py-0.5 rounded bg-[#162238] border border-[rgba(148,163,184,0.20)] text-slate-300 font-mono text-[11px]">
            Transit
          </span>

          {flightLines.map((line, idx) => (
            <React.Fragment key={idx}>
              <span className="text-slate-600">→</span>
              <span
                className={`px-2 py-0.5 rounded border font-mono text-[11px] ${
                  line.passId === 'B'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                }`}
              >
                {line.passId === 'B' ? `Pass B Line ${idx + 1}` : `Line ${idx + 1}`} ({line.photoPositions?.length || 0} 📷)
              </span>
              {idx < flightLines.length - 1 && (
                <>
                  <span className="text-slate-600">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-600/30 text-amber-300 text-[10px] font-mono">
                    Turn
                  </span>
                </>
              )}
            </React.Fragment>
          ))}

          <span className="text-slate-600">→</span>

          <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-rose-300 font-mono text-[11px]">
            {finishAction === 'hover' ? 'Hover' : finishAction === 'land_at_last_waypoint' ? '🛬 Land' : '🏠 RTH'}
          </span>
        </div>
      )}

      {/* 2. Main Action & Control Strip (Fixed height, perfectly aligned, no wrapping) */}
      <div className="h-14 px-4 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
        {/* Left: Waypoints Drawer Toggle & Drone Bridge Status */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#162238] hover:bg-[#1C2940] border border-[rgba(148,163,184,0.20)] text-xs text-[#F1F5F9] font-medium transition-all"
            title="เปิด/ปิดตารางพิกัด Waypoints"
          >
            <MapPin className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span className="font-semibold">
              พิกัด Waypoints ({waypoints.length})
            </span>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {/* Drone Bridge Toggle Indicator */}
          <button
            onClick={onToggleBridge}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all ${
              isBridgeConnected
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                : 'bg-[#162238] text-slate-400 border-[rgba(148,163,184,0.20)] hover:text-slate-200 hover:bg-[#1C2940]'
            }`}
            title={isBridgeConnected ? 'คลิกเพื่อตัดการเชื่อมต่อ Drone Bridge' : 'คลิกเพื่อเชื่อมต่อ GeoMonitor Drone Bridge (Android MSDK V5)'}
          >
            <span className={`w-2 h-2 rounded-full ${isBridgeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <Radio className="w-3.5 h-3.5 text-slate-400" />
            <span>{isBridgeConnected ? 'Bridge: Connected' : 'เชื่อมต่อ Drone Bridge'}</span>
          </button>
        </div>

        {/* Right: Primary Action Buttons Strip */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Recalculate Button (Visible when Outdated) */}
          {workflowState === 'OUTDATED' && (
            <button
              onClick={onGenerateRoute}
              className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.4)] animate-pulse transition-all cursor-pointer"
              title="คำนวณแผนการบินใหม่ตามพารามิเตอร์ปัจจุบัน"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
              <span>คำนวณใหม่ (Recalculate)</span>
            </button>
          )}

          {/* Clear Route */}
          <button
            onClick={onClearRoute}
            disabled={waypoints.length === 0}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#162238] hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 text-xs font-medium flex items-center gap-1.5 border border-[rgba(148,163,184,0.20)] transition-all disabled:opacity-40 cursor-pointer"
            title="ล้างเส้นทางทั้งหมด"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>ล้าง</span>
          </button>

          {/* Saved Missions */}
          <button
            onClick={onOpenSavedMissions}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#162238] hover:bg-[#1C2940] text-[#CBD5E1] hover:text-white text-xs font-medium flex items-center gap-1.5 border border-[rgba(148,163,184,0.20)] transition-all cursor-pointer"
            title="เปิดภารกิจที่บันทึกไว้ในระบบ"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>ภารกิจที่บันทึก</span>
          </button>

          {/* Save Mission */}
          <button
            onClick={onSaveMission}
            disabled={isSaving || waypoints.length === 0}
            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#162238] hover:bg-[#1C2940] text-white text-xs font-semibold flex items-center gap-1.5 border border-[rgba(148,163,184,0.20)] transition-all cursor-pointer disabled:opacity-40"
            title="บันทึกภารกิจลงฐานข้อมูลกลาง"
          >
            <Save className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
          </button>

          {/* Upload to Drone */}
          <button
            onClick={onUploadMission}
            disabled={waypoints.length === 0 || !isBridgeConnected || isUploading || workflowState === 'OUTDATED'}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              isBridgeConnected && waypoints.length > 0 && workflowState !== 'OUTDATED'
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.35)] cursor-pointer'
                : 'bg-[#162238] text-slate-500 border border-[rgba(148,163,184,0.15)] cursor-not-allowed opacity-50'
            }`}
            title={
              workflowState === 'OUTDATED'
                ? 'กรุณากดคำนวณแผนการบินใหม่ก่อนอัปโหลด'
                : !isBridgeConnected
                ? 'ต้องเชื่อมต่อ Drone Bridge ก่อนจึงจะอัปโหลดได้'
                : waypoints.length === 0
                ? 'ต้องสร้างเส้นทางบินก่อน'
                : 'อัปโหลดภารกิจเข้าหน่วยความจำอากาศยาน (Flash Memory)'
            }
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isUploading ? `กำลังส่ง... (${uploadState})` : 'อัปโหลดโดรน'}</span>
          </button>

          {/* Export File Modal Trigger */}
          <button
            onClick={onOpenExportModal}
            disabled={waypoints.length === 0 || workflowState === 'OUTDATED'}
            className={`min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              waypoints.length === 0 || workflowState === 'OUTDATED'
                ? 'bg-[#162238] text-slate-500 border border-[rgba(148,163,184,0.15)] cursor-not-allowed opacity-40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)] cursor-pointer'
            }`}
            title={
              workflowState === 'OUTDATED'
                ? 'ไม่สามารถส่งออกได้เนื่องจากแผนการบินล้าสมัย กรุณากดคำนวณใหม่ก่อน'
                : waypoints.length === 0
                ? 'ต้องคำนวณแผนการบินก่อนส่งออก'
                : 'ส่งออกไฟล์แผนการบิน KML, KMZ, GeoJSON หรือ QGC'
            }
          >
            <Download className="w-3.5 h-3.5" />
            <span>ส่งออก (Export)</span>
          </button>
        </div>
      </div>

      {/* 3. Expanded Waypoint Table Drawer */}
      {isExpanded && (
        <div className="max-h-56 overflow-y-auto p-3 bg-[#080F20]/95 border-t border-[rgba(148,163,184,0.15)] text-xs font-mono">
          {waypoints.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs font-sans">
              ยังไม่มีเส้นทางบิน กำหนดพื้นที่และกด &quot;คำนวณแผนการบิน (Calculate Flight Plan)&quot;
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                  <th className="py-1.5 px-2">#</th>
                  <th className="py-1.5 px-2">Latitude (°N)</th>
                  <th className="py-1.5 px-2">Longitude (°E)</th>
                  <th className="py-1.5 px-2">Altitude (m)</th>
                  <th className="py-1.5 px-2">Speed (m/s)</th>
                  <th className="py-1.5 px-2">Action</th>
                  <th className="py-1.5 px-2 text-right">เลือก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {waypoints.map((wp, idx) => (
                  <tr
                    key={idx}
                    onClick={() => onSelectWaypoint(selectedWaypointIndex === idx ? null : idx)}
                    className={`cursor-pointer transition-colors ${
                      selectedWaypointIndex === idx
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                        : 'hover:bg-slate-800/50 text-slate-300'
                    }`}
                  >
                    <td className="py-1.5 px-2 font-bold text-slate-400">{wp.sequence}</td>
                    <td className="py-1.5 px-2">{wp.latitude.toFixed(6)}</td>
                    <td className="py-1.5 px-2">{wp.longitude.toFixed(6)}</td>
                    <td className="py-1.5 px-2 text-cyan-400">{wp.altitudeMeters}m</td>
                    <td className="py-1.5 px-2">{wp.speedMps} m/s</td>
                    <td className="py-1.5 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        {wp.action === 'take_photo' ? '📷 ถ่ายภาพ' : 'ปกติ'}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      {selectedWaypointIndex === idx && (
                        <span className="text-[10px] text-cyan-400 font-sans">กำลังเลือก</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
