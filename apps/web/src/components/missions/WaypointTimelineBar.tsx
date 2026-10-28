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
    <div className="bg-card/95 border-t border-border backdrop-blur-md select-none text-foreground shadow-2xl flex flex-col z-20">
      {/* 1. Flight Sequence Step Strip (Visible when flight lines exist) */}
      {flightLines.length > 0 && (
        <div className="px-4 py-1.5 bg-card-secondary border-b border-border flex items-center gap-1.5 overflow-x-auto text-[11px] whitespace-nowrap scrollbar-none">
          <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            ลำดับการบิน:
          </span>

          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
            🛫 Takeoff
          </span>

          <span className="text-muted-foreground">→</span>

          <span className="px-2 py-0.5 rounded bg-secondary border border-border text-foreground font-mono text-[11px]">
            Transit
          </span>

          {flightLines.map((line, idx) => (
            <React.Fragment key={idx}>
              <span className="text-muted-foreground">→</span>
              <span
                className={`px-2 py-0.5 rounded border font-mono text-[11px] ${
                  line.passId === 'B'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-primary/10 border-primary/30 text-primary'
                }`}
              >
                {line.passId === 'B' ? `Pass B Line ${idx + 1}` : `Line ${idx + 1}`} ({line.photoPositions?.length || 0} 📷)
              </span>
              {idx < flightLines.length - 1 && (
                <>
                  <span className="text-muted-foreground">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-mono">
                    Turn
                  </span>
                </>
              )}
            </React.Fragment>
          ))}

          <span className="text-muted-foreground">→</span>

          <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-mono text-[11px]">
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted border border-border text-xs text-foreground font-medium transition-all"
            title="เปิด/ปิดตารางพิกัด Waypoints"
          >
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold">
              พิกัด Waypoints ({waypoints.length})
            </span>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>

          {/* Drone Bridge Toggle Indicator */}
          <button
            onClick={onToggleBridge}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all ${
              isBridgeConnected
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 shadow-sm'
                : 'bg-secondary text-muted-foreground border-border hover:text-foreground hover:bg-muted'
            }`}
            title={isBridgeConnected ? 'คลิกเพื่อตัดการเชื่อมต่อ Drone Bridge' : 'คลิกเพื่อเชื่อมต่อ GeoMonitor Drone Bridge (Android MSDK V5)'}
          >
            <span className={`w-2 h-2 rounded-full ${isBridgeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
            <Radio className="w-3.5 h-3.5 text-muted-foreground" />
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
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-secondary hover:bg-destructive/10 hover:text-destructive text-muted-foreground text-xs font-medium flex items-center gap-1.5 border border-border transition-all disabled:opacity-40 cursor-pointer"
            title="ล้างเส้นทางทั้งหมด"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>ล้าง</span>
          </button>

          {/* Saved Missions */}
          <button
            onClick={onOpenSavedMissions}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 border border-border transition-all cursor-pointer"
            title="เปิดภารกิจที่บันทึกไว้ในระบบ"
          >
            <FolderOpen className="w-3.5 h-3.5 text-primary" />
            <span>ภารกิจที่บันทึก</span>
          </button>

          {/* Save Mission */}
          <button
            onClick={onSaveMission}
            disabled={isSaving || waypoints.length === 0}
            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 border border-border transition-all cursor-pointer disabled:opacity-40"
            title="บันทึกภารกิจลงฐานข้อมูลกลาง"
          >
            <Save className="w-3.5 h-3.5 text-primary" />
            <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
          </button>

          {/* Upload to Drone */}
          <button
            onClick={onUploadMission}
            disabled={waypoints.length === 0 || !isBridgeConnected || isUploading || workflowState === 'OUTDATED'}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              isBridgeConnected && waypoints.length > 0 && workflowState !== 'OUTDATED'
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm cursor-pointer'
                : 'bg-secondary text-muted-foreground border border-border cursor-not-allowed opacity-50'
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
                ? 'bg-secondary text-muted-foreground border border-border cursor-not-allowed opacity-40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer'
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
        <div className="max-h-56 overflow-y-auto p-3 bg-card border-t border-border text-xs font-mono">
          {waypoints.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-xs font-sans">
              ยังไม่มีเส้นทางบิน กำหนดพื้นที่และกด &quot;คำนวณแผนการบิน (Calculate Flight Plan)&quot;
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                  <th className="py-1.5 px-2">#</th>
                  <th className="py-1.5 px-2">Latitude (°N)</th>
                  <th className="py-1.5 px-2">Longitude (°E)</th>
                  <th className="py-1.5 px-2">Altitude (m)</th>
                  <th className="py-1.5 px-2">Speed (m/s)</th>
                  <th className="py-1.5 px-2">Action</th>
                  <th className="py-1.5 px-2 text-right">เลือก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {waypoints.map((wp, idx) => (
                  <tr
                    key={idx}
                    onClick={() => onSelectWaypoint(selectedWaypointIndex === idx ? null : idx)}
                    className={`cursor-pointer transition-colors ${
                      selectedWaypointIndex === idx
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <td className="py-1.5 px-2 font-bold text-muted-foreground">{wp.sequence}</td>
                    <td className="py-1.5 px-2">{wp.latitude.toFixed(6)}</td>
                    <td className="py-1.5 px-2">{wp.longitude.toFixed(6)}</td>
                    <td className="py-1.5 px-2 text-primary">{wp.altitudeMeters}m</td>
                    <td className="py-1.5 px-2">{wp.speedMps} m/s</td>
                    <td className="py-1.5 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                        {wp.action === 'take_photo' ? '📷 ถ่ายภาพ' : 'ปกติ'}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      {selectedWaypointIndex === idx && (
                        <span className="text-[10px] text-primary font-sans">กำลังเลือก</span>
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
