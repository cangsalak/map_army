'use client';

import React, { useState } from 'react';
import { Loader2, CheckCircle2, Clock, Terminal, ChevronDown, ChevronUp, Cpu } from 'lucide-react';

interface ProcessingIndicatorProps {
  job?: {
    id: string;
    jobType: string;
    status: string;
    progressPercent: number;
    logs?: Array<{ timestamp: string; message: string }>;
  } | null;
  onClose?: () => void;
}

export default function ProcessingIndicator({ job, onClose }: ProcessingIndicatorProps) {
  const [showLogs, setShowLogs] = useState(false);

  if (!job) return null;

  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  return (
    <div className="absolute top-16 right-4 z-30 gis-panel rounded-xl p-4 border border-cyan-500/40 shadow-2xl backdrop-blur-md select-none text-xs w-80 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2 font-bold text-slate-200">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span>สถานะการประมวลผลพื้นหลัง (BullMQ)</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs">
            ✕
          </button>
        )}
      </div>

      {/* Progress & Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300 font-semibold">โฟโตแกรมเมตรี & สร้างราสเตอร์ COG</span>
          <span className="font-mono text-cyan-400 font-bold">{job.progressPercent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isCompleted
                ? 'bg-emerald-400'
                : isFailed
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-cyan-500 to-blue-500 animate-pulse'
            }`}
            style={{ width: `${job.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Current Stage */}
      <div className="p-2.5 bg-navy-950/80 rounded-lg border border-slate-800/80 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
          )}
          <span className="text-slate-300">
            {isCompleted
              ? 'การประมวลผลโมเดล 3D และ DSM สำเร็จ'
              : job.progressPercent > 70
              ? 'กำลังสกัดระดับความสูง DSM & วิเคราะห์ Cut/Fill'
              : job.progressPercent > 40
              ? 'กำลังแปลงไฟล์เป็น Cloud Optimized GeoTIFF'
              : 'กำลังตรวจสอบพิกัด Georeferencing & GCP'}
          </span>
        </div>
      </div>

      {/* Toggle Logs Button */}
      <div
        className="flex items-center justify-between text-[11px] text-slate-400 hover:text-cyan-300 cursor-pointer pt-1"
        onClick={() => setShowLogs(!showLogs)}
      >
        <span className="flex items-center gap-1.5 font-mono">
          <Terminal className="w-3.5 h-3.5" />
          บันทึกการทำงาน (Worker Logs)
        </span>
        {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </div>

      {/* Logs Window */}
      {showLogs && (
        <div className="p-2.5 bg-navy-950 border border-slate-800 rounded-lg font-mono text-[10px] text-slate-400 space-y-1 max-h-36 overflow-y-auto">
          <div>[INFO] รับข้อมูลรอบบินสำรวจโดรนเข้าสู่คิวงาน</div>
          <div>[INFO] ตรวจสอบระบบพิกัด WGS84 EPSG:4326... ผ่าน</div>
          <div>[INFO] เรียกใช้โมดูล GDAL สร้าง Overviews & Tiling...</div>
          <div>[INFO] คำนวณความต่างระดับความสูง ΔZ เสร็จสมบูรณ์</div>
        </div>
      )}
    </div>
  );
}
