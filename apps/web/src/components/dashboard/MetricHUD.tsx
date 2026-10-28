'use client';

import React, { useState } from 'react';
import {
  FolderKanban,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Scale,
  ChevronUp,
  ChevronDown,
  Activity,
  Layers,
} from 'lucide-react';
import { Badge } from '@/components/ui/primitives';

interface MetricHUDProps {
  metrics: {
    totalAreas: number;
    completedSurveys: number;
    pendingSurveys: number;
    totalCutVolumeM3: number;
    totalFillVolumeM3: number;
    unreviewedCandidates: number;
  };
}

export default function MetricHUD({ metrics }: MetricHUDProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const netVolume = (metrics.totalFillVolumeM3 || 0) - (metrics.totalCutVolumeM3 || 0);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 min-h-[36px] bg-[#101A2D]/90 hover:bg-[#162238] rounded-full px-4 py-1.5 flex items-center gap-2 text-xs font-mono text-[#22D3EE] border border-[#06B6D4]/30 hover:border-[#06B6D4] shadow-2xl backdrop-blur-md transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none"
        title="คลิกเพื่อเปิดดูแผงสถิติภาพรวม (HUD Metrics)"
        aria-label="แสดงแผงตัวชี้วัดภารกิจ"
      >
        <Activity className="w-3.5 h-3.5 text-[#06B6D4]" />
        <span className="font-sans font-semibold text-xs">สถิติภารกิจ</span>
        <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
      </button>
    );
  }

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-[#101A2D]/95 rounded-2xl p-2.5 flex items-center gap-3 border border-[rgba(148,163,184,0.25)] shadow-2xl backdrop-blur-md select-none transition-all max-w-[95vw] overflow-x-auto"
      role="region"
      aria-label="แผงตัวชี้วัดภาพรวม"
    >
      {/* Metric 1: Total Areas */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[#162238] rounded-xl border border-[rgba(148,163,184,0.15)]">
        <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/15 text-[#3B82F6] flex items-center justify-center shrink-0">
          <FolderKanban className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-[#94A3B8] font-medium">พื้นที่ในการดูแล</div>
          <div className="text-sm font-bold text-[#F1F5F9] font-mono leading-none mt-0.5">
            {metrics.totalAreas} <span className="text-[10px] font-sans font-normal text-[#94A3B8]">โซน</span>
          </div>
        </div>
      </div>

      {/* Metric 2: Completed Surveys */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[#162238] rounded-xl border border-[rgba(148,163,184,0.15)]">
        <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-[#94A3B8] font-medium">รอบบินสำรวจสำเร็จ</div>
          <div className="text-sm font-bold text-[#10B981] font-mono leading-none mt-0.5">
            {metrics.completedSurveys} <span className="text-[10px] font-sans font-normal text-[#94A3B8]">รอบ</span>
          </div>
        </div>
      </div>

      {/* Metric 3: Cut Volume */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[#162238] rounded-xl border border-[#F43F5E]/30 shadow-[0_0_10px_rgba(244,63,94,0.15)]">
        <div className="w-8 h-8 rounded-lg bg-[#F43F5E]/15 text-[#F43F5E] flex items-center justify-center shrink-0">
          <TrendingDown className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-[#F43F5E] font-medium">ขุดดินรวม (Cut)</div>
          <div className="text-sm font-bold text-[#F43F5E] font-mono leading-none mt-0.5">
            -{(metrics.totalCutVolumeM3 || 0).toLocaleString()} <span className="text-[10px] font-normal text-[#94A3B8]">m³</span>
          </div>
        </div>
      </div>

      {/* Metric 4: Fill Volume */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[#162238] rounded-xl border border-[#10B981]/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
        <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0">
          <TrendingUp className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-[#10B981] font-medium">ถมดินรวม (Fill)</div>
          <div className="text-sm font-bold text-[#10B981] font-mono leading-none mt-0.5">
            +{(metrics.totalFillVolumeM3 || 0).toLocaleString()} <span className="text-[10px] font-normal text-[#94A3B8]">m³</span>
          </div>
        </div>
      </div>

      {/* Metric 5: Net Earthwork */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[#162238] rounded-xl border border-[rgba(148,163,184,0.15)]">
        <div className="w-8 h-8 rounded-lg bg-[#06B6D4]/15 text-[#06B6D4] flex items-center justify-center shrink-0">
          <Scale className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-[#94A3B8] font-medium">งานดินสุทธิ (Net)</div>
          <div className={`text-sm font-bold font-mono leading-none mt-0.5 ${netVolume < 0 ? 'text-[#F43F5E]' : 'text-[#10B981]'}`}>
            {netVolume > 0 ? `+${netVolume.toLocaleString()}` : netVolume.toLocaleString()}{' '}
            <span className="text-[10px] font-normal text-[#94A3B8]">m³</span>
          </div>
        </div>
      </div>

      {/* Collapse toggle button (Min 44x44px target) */}
      <button
        onClick={() => setIsCollapsed(true)}
        title="ซ่อนแผงตัวชี้วัดเพื่อขยายมุมมองแผนที่ 3D"
        aria-label="ซ่อนแผงตัวชี้วัด"
        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#94A3B8] hover:text-white rounded-xl hover:bg-[#1C2940] transition-colors focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  );
}

