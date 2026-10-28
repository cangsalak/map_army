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
} from 'lucide-react';
import { cn } from '../ui/primitives';

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
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 min-h-[36px] bg-card/90 hover:bg-card-secondary rounded-full px-4 py-1.5 flex items-center gap-2 text-xs font-mono text-primary border border-border shadow-xl backdrop-blur-md transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        title="คลิกเพื่อเปิดดูแผงสถิติภาพรวม (HUD Metrics)"
        aria-label="แสดงแผงตัวชี้วัดภารกิจ"
      >
        <Activity className="w-3.5 h-3.5 text-primary" />
        <span className="font-sans font-semibold text-xs text-foreground">สถิติภารกิจ</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-card/95 rounded-2xl p-2.5 flex items-center gap-2.5 border border-border shadow-2xl backdrop-blur-md select-none transition-all max-w-[95vw] overflow-x-auto text-foreground"
      role="region"
      aria-label="แผงตัวชี้วัดภาพรวม"
    >
      {/* Metric 1: Total Areas */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-card-secondary rounded-xl border border-border">
        <div className="w-8 h-8 rounded-lg bg-info/15 text-info flex items-center justify-center shrink-0">
          <FolderKanban className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground font-medium">พื้นที่ในการดูแล</div>
          <div className="text-sm font-bold text-foreground font-mono leading-none mt-0.5">
            {metrics.totalAreas} <span className="text-[10px] font-sans font-normal text-muted-foreground">โซน</span>
          </div>
        </div>
      </div>

      {/* Metric 2: Completed Surveys */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-card-secondary rounded-xl border border-border">
        <div className="w-8 h-8 rounded-lg bg-success/15 text-success flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground font-medium">รอบบินสำรวจสำเร็จ</div>
          <div className="text-sm font-bold text-success font-mono leading-none mt-0.5">
            {metrics.completedSurveys} <span className="text-[10px] font-sans font-normal text-muted-foreground">รอบ</span>
          </div>
        </div>
      </div>

      {/* Metric 3: Cut Volume */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-card-secondary rounded-xl border border-destructive/30">
        <div className="w-8 h-8 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
          <TrendingDown className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-destructive font-medium">ขุดดินรวม (Cut)</div>
          <div className="text-sm font-bold text-destructive font-mono leading-none mt-0.5">
            -{(metrics.totalCutVolumeM3 || 0).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">m³</span>
          </div>
        </div>
      </div>

      {/* Metric 4: Fill Volume */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-card-secondary rounded-xl border border-success/30">
        <div className="w-8 h-8 rounded-lg bg-success/15 text-success flex items-center justify-center shrink-0">
          <TrendingUp className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-success font-medium">ถมดินรวม (Fill)</div>
          <div className="text-sm font-bold text-success font-mono leading-none mt-0.5">
            +{(metrics.totalFillVolumeM3 || 0).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">m³</span>
          </div>
        </div>
      </div>

      {/* Metric 5: Net Earthwork */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-card-secondary rounded-xl border border-border">
        <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Scale className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground font-medium">งานดินสุทธิ (Net)</div>
          <div
            className={cn(
              'text-sm font-bold font-mono leading-none mt-0.5',
              netVolume < 0 ? 'text-destructive' : 'text-success'
            )}
          >
            {netVolume > 0 ? `+${netVolume.toLocaleString()}` : netVolume.toLocaleString()}{' '}
            <span className="text-[10px] font-normal text-muted-foreground">m³</span>
          </div>
        </div>
      </div>

      {/* Collapse toggle button */}
      <button
        onClick={() => setIsCollapsed(true)}
        title="ซ่อนแผงตัวชี้วัดเพื่อขยายมุมมองแผนที่ 3D"
        aria-label="ซ่อนแผงตัวชี้วัด"
        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-xl hover:bg-card-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  );
}
