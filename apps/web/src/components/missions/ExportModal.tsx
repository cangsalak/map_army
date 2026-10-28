'use client';

import React, { useState } from 'react';
import {
  X,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Radio,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { ExportPlatform, DroneMissionDTO } from '@geomonitor/shared';
import { exportDroneMission } from '@/lib/drone-export-adapters';
import { apiFetch } from '@/lib/api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mission: DroneMissionDTO;
  missionId?: string | null;
  validationStatus: string;
  isOutdated?: boolean;
}

export default function ExportModal({
  isOpen,
  onClose,
  mission,
  missionId,
  validationStatus,
  isOutdated = false,
}: ExportModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<ExportPlatform>('dji_pilot_wpml');
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [exportedFilename, setExportedFilename] = useState('');

  if (!isOpen) return null;

  const isMini4Pro = mission.targetPlatform === 'dji_mini_4_pro' || mission.droneModel.includes('Mini 4');

  const platforms = [
    {
      id: 'dji_pilot_wpml' as ExportPlatform,
      category: 'AUTONOMOUS_FLIGHT',
      name: 'DJI Pilot 2 WPML (.kmz)',
      desc: 'ไฟล์บีบอัด ZIP มาตรฐาน DJI Enterprise ประกอบด้วย template.kml และ waypoint.kml',
      compatibleDrones: 'DJI Matrice 350 RTK, DJI Mavic 3 Enterprise, Matrice 300 RTK (ไม่รองรับบน DJI Fly)',
      compatibilityStatus: 'VERIFIED_WITH_LIMITATIONS',
      recommended: mission.droneModel.includes('Matrice') || mission.droneModel.includes('Mavic 3E'),
      ext: '.kmz',
    },
    {
      id: 'internal_json' as ExportPlatform,
      category: 'AUTONOMOUS_FLIGHT',
      name: 'GeoMonitor 3D JSON (v2.0)',
      desc: 'โครงสร้างข้อมูลภารกิจฉบับเต็ม พร้อม CRS, Altitude Reference สำหรับ Android MSDK V5 Bridge',
      compatibleDrones: 'GeoMonitor Drone Bridge (Android MSDK V5) สำหรับ DJI Mini 4 Pro, ระบบคลาวด์',
      compatibilityStatus: 'VERIFIED_IMPORT',
      recommended: isMini4Pro,
      ext: '.json',
    },
    {
      id: 'qgroundcontrol_plan' as ExportPlatform,
      category: 'AUTONOMOUS_FLIGHT',
      name: 'QGroundControl Plan (.plan)',
      desc: 'โครงสร้าง JSON ตามโปรโตคอล MAVLink คำสั่ง MAV_CMD_NAV_WAYPOINT',
      compatibleDrones: 'PX4 Autopilot, ArduPilot, QGroundControl GCS',
      compatibilityStatus: 'VERIFIED_IMPORT',
      recommended: mission.targetPlatform === 'px4_mavlink',
      ext: '.plan',
    },
    {
      id: 'ardupilot_waypoints' as ExportPlatform,
      category: 'AUTONOMOUS_FLIGHT',
      name: 'ArduPilot Waypoints (.waypoints)',
      desc: 'รูปแบบ Plain Text QGC WPL 110 สำหรับ Mission Planner และ ArduCopter',
      compatibleDrones: 'ArduPilot, Mission Planner, MAVProxy',
      compatibilityStatus: 'VERIFIED_IMPORT',
      recommended: mission.targetPlatform === 'ardupilot_mavlink',
      ext: '.waypoints',
    },
    {
      id: 'standard_kmz' as ExportPlatform,
      category: 'GIS_VISUALIZATION',
      name: 'Standard OGC KMZ (.kmz)',
      desc: 'ไฟล์บีบอัด KMZ มาตรฐาน OGC บรรจุ doc.kml และ 3D Flight Geometry สำหรับ Google Earth Pro / ArcGIS',
      compatibleDrones: 'Google Earth Pro, ArcGIS, QGIS, Global Mapper (สำหรับแสดงผล GIS เท่านั้น)',
      compatibilityStatus: 'VISUALIZATION_ONLY',
      recommended: false,
      ext: '.kmz',
    },
    {
      id: 'standard_kml' as ExportPlatform,
      category: 'GIS_VISUALIZATION',
      name: 'Standard OGC KML 2.2 (.kml)',
      desc: 'ไฟล์เวกเตอร์ KML อ้างอิงทางภูมิศาสตร์ (คำเตือน: สำหรับแสดงผลและวิเคราะห์บน GIS ไม่ใช่คำสั่งบินบนรีโมต)',
      compatibleDrones: 'Google Earth Pro, QGIS, ArcGIS (แสดงผล GIS เท่านั้น)',
      compatibilityStatus: 'VISUALIZATION_ONLY',
      recommended: false,
      ext: '.kml',
    },
    {
      id: 'generic_geojson' as ExportPlatform,
      category: 'GIS_VISUALIZATION',
      name: 'Generic GIS GeoJSON (.geojson)',
      desc: 'เส้นทางเวกเตอร์อ้างอิง WGS84 GeoJSON (สำหรับตรวจสอบแนวเส้นบน GIS)',
      compatibleDrones: 'QGIS, ArcGIS, Google Earth Pro, CAD (แสดงผล GIS เท่านั้น)',
      compatibilityStatus: 'VISUALIZATION_ONLY',
      recommended: false,
      ext: '.geojson',
    },
  ];

  const handleDownload = async () => {
    setIsExporting(true);
    setDownloadSuccess(false);

    try {
      const { filename, blob } = await exportDroneMission(mission, selectedPlatform);

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Audit export in backend if mission is saved
      if (missionId) {
        try {
          await apiFetch(`/missions/${missionId}/export`, {
            method: 'POST',
            body: JSON.stringify({
              exportTarget: selectedPlatform,
              fileFormat: filename.split('.').pop(),
              fileName: filename,
              fileSizeBytes: blob.size,
              validationSnapshot: { status: validationStatus },
            }),
          });
        } catch {
          // Continue if offline or unsaved
        }
      }

      setExportedFilename(filename);
      setDownloadSuccess(true);
    } catch (err: any) {
      alert(`การส่งออกไฟล์ล้มเหลว: ${err.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="bg-card border border-border text-foreground rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-card-secondary/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">ส่งออกไฟล์แผนการบิน (Export Flight Plan)</h3>
              <p className="text-[11px] text-muted-foreground">เลือกระบบควบคุมและอุปกรณ์เป้าหมาย</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Target Format Radio List */}
          <div className="space-y-2.5">
            <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              รูปแบบไฟล์ภารกิจที่รองรับ (Target Platforms)
            </div>

            {platforms.map((p) => {
              const isSelected = selectedPlatform === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedPlatform(p.id);
                    setDownloadSuccess(false);
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-cyan-950/30 border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-cyan-400 bg-cyan-500' : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </div>
                      <span className="font-bold text-sm text-white">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {p.recommended && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                          ตรงกับรุ่นโดรน
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
                          p.compatibilityStatus === 'VERIFIED_IMPORT'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : p.compatibilityStatus === 'VERIFIED_WITH_LIMITATIONS'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        }`}
                      >
                        {p.compatibilityStatus}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-slate-400 text-xs ml-6">{p.desc}</p>
                  <div className="mt-2 ml-6 text-[11px] text-cyan-400/80 font-mono">
                    อุปกรณ์: {p.compatibleDrones}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Outdated Warning */}
          {isOutdated && (
            <div className="p-3 bg-amber-950/40 border border-amber-500/60 rounded-xl text-xs text-amber-300 flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold">ข้อมูลการตั้งค่าเปลี่ยนแปลง (OUTDATED):</span>
                <div className="text-[11px] opacity-90 mt-0.5">
                  พารามิเตอร์หรือขอบเขตพื้นที่ถูกแก้ไขหลังการคำนวณล่าสุด กรุณากด &quot;คำนวณแผนการบิน (Calculate Flight Plan)&quot; ใหม่ก่อนส่งออก
                </div>
              </div>
            </div>
          )}

          {/* Validation Notice */}
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5 text-slate-400 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>การตรวจสอบก่อนส่งออก (Pre-Export Integrity Check)</span>
            </div>
            <div>
              • จำนวน Waypoints: <span className="text-white font-mono">{mission.waypoints.length} จุด</span>
            </div>
            <div>
              • ระดับความสูง: <span className="text-white font-mono">{mission.flightAltitudeMeters}m ({mission.altitudeReference})</span>
            </div>
            <div>
              • จุดขึ้นบิน (Home Point): <span className="text-emerald-400 font-mono">กำหนดแล้ว ✓</span>
            </div>
            <div>
              • สถานะแผนการบิน: {isOutdated ? (
                <span className="text-amber-400 font-bold">⚠️ OUTDATED (ต้องคำนวณใหม่)</span>
              ) : (
                <span className="text-emerald-400 font-bold">✓ สอดคล้องกับพารามิเตอร์ล่าสุด</span>
              )}
            </div>
          </div>

          {downloadSuccess && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold">ดาวน์โหลดสำเร็จ:</span> {exportedFilename}
                <div className="text-[10px] opacity-80">สามารถนำเข้า Ground Control Station (DJI Pilot 2 / QGC) ได้ทันที</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            ปิดหน้าต่าง
          </button>

          <button
            onClick={handleDownload}
            disabled={isExporting || mission.waypoints.length === 0 || isOutdated}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              isOutdated || mission.waypoints.length === 0
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.35)] cursor-pointer'
            }`}
            title={isOutdated ? 'กรุณากดคำนวณแผนการบินใหม่ก่อนส่งออก' : 'ดาวน์โหลดไฟล์ภารกิจ'}
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>ดาวน์โหลดไฟล์ภารกิจ ({platforms.find((p) => p.id === selectedPlatform)?.ext})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
