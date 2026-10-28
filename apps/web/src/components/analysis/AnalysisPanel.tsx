'use client';

import React, { useState } from 'react';
import {
  TrendingDown,
  TrendingUp,
  FileCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Layers,
  ChevronRight,
  ChevronLeft,
  Info,
  Building,
  Pickaxe,
  Calendar,
  MapPin,
  Scale,
  FileSpreadsheet,
  Loader2,
  Check,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatAreaThai, formatVolumeThai } from '@geomonitor/shared';
import { ChangePolygonFeature } from '../map/CesiumMap';
import { Button, Badge } from '@/components/ui/primitives';

interface AnalysisPanelProps {
  areaName?: string;
  areaSqm?: number;
  baselineDate?: string;
  comparisonDate?: string;
  totalChangeAreaSqm?: number;
  cutVolumeM3?: number;
  fillVolumeM3?: number;
  netVolumeM3?: number;
  confidenceScore?: number;
  limitationsNotes?: string | null;
  features?: ChangePolygonFeature[];
  onReviewFeature?: (featureId: string, status: string) => void;
  onGenerateReport?: (format: 'pdf' | 'csv') => void;
}

export default function AnalysisPanel({
  areaName,
  areaSqm = 0,
  baselineDate,
  comparisonDate,
  totalChangeAreaSqm = 0,
  cutVolumeM3 = 0,
  fillVolumeM3 = 0,
  netVolumeM3 = 0,
  confidenceScore = 0,
  limitationsNotes,
  features = [],
  onReviewFeature,
  onGenerateReport,
}: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<'volumes' | 'features' | 'metadata'>('volumes');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'csv' | null>(null);

  const chartData = [
    { name: 'ขุดดิน (Cut)', volume: cutVolumeM3, color: '#F43F5E' },
    { name: 'ถมดิน (Fill)', volume: fillVolumeM3, color: '#10B981' },
  ];

  const handleExport = async (format: 'pdf' | 'csv') => {
    setExportingFormat(format);
    try {
      if (onGenerateReport) {
        await onGenerateReport(format);
      }
    } finally {
      setTimeout(() => setExportingFormat(null), 1000);
    }
  };

  if (!areaName || isCollapsed) {
    return (
      <aside
        className="w-12 bg-card/95 border-l border-border flex flex-col items-center py-3 justify-between h-full select-none z-20 backdrop-blur-md transition-all shadow-xl text-foreground"
        aria-label="แผงตรวจสอบข้อมูลแบบย่อ"
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-secondary text-primary hover:bg-muted border border-border shadow-sm focus-visible:ring-2 focus-visible:ring-ring transition-all cursor-pointer"
          title={areaName ? 'ขยายแผงตรวจสอบข้อมูล (Inspector)' : 'เลือกพื้นที่บนแผนที่เพื่อดูข้อมูลการวิเคราะห์'}
          aria-label="ขยายแผงตรวจสอบข้อมูล"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="rotate-90 text-[10px] font-mono tracking-widest text-muted-foreground whitespace-nowrap">
          INSPECTOR
        </div>

        <div className="w-2 h-2 rounded-full bg-primary/40" />
      </aside>
    );
  }

  return (
    <aside
      className="w-84 2xl:w-96 bg-card/95 border-l border-border flex flex-col h-full select-none text-foreground z-20 relative backdrop-blur-md shadow-2xl transition-all"
      aria-label="แผงตรวจสอบข้อมูลการวิเคราะห์"
    >
      {/* Header with Title and Collapse Button */}
      <div className="p-4 border-b border-border bg-card-secondary/70 flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-[11px] text-primary font-mono uppercase tracking-wider flex items-center gap-2 font-bold">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            แผงตรวจสอบข้อมูล (Inspector)
          </div>
          <h2 className="text-sm font-bold text-foreground line-clamp-1">{areaName}</h2>
          <div className="text-xs text-muted-foreground flex items-center gap-2 font-mono">
            <span>{formatAreaThai(areaSqm)}</span>
            <span>•</span>
            <span className="text-success font-bold">
              ความเชื่อมั่น {(confidenceScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(true)}
          title="ย่อแผงข้อมูลเพื่อขยายแผนที่ 3D"
          aria-label="ย่อแผงข้อมูล"
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-all cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs (min 44px touch targets) */}
      <div className="grid grid-cols-3 border-b border-border bg-muted/40 text-xs font-medium">
        <button
          onClick={() => setActiveTab('volumes')}
          className={`min-h-[44px] py-2 text-center border-b-2 transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            activeTab === 'volumes'
              ? 'border-primary text-primary bg-primary/10 font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-selected={activeTab === 'volumes'}
        >
          ปริมาตรงานดิน
        </button>
        <button
          onClick={() => setActiveTab('features')}
          className={`min-h-[44px] py-2 text-center border-b-2 transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            activeTab === 'features'
              ? 'border-primary text-primary bg-primary/10 font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-selected={activeTab === 'features'}
        >
          รูปแปลง ({features.length})
        </button>
        <button
          onClick={() => setActiveTab('metadata')}
          className={`min-h-[44px] py-2 text-center border-b-2 transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            activeTab === 'metadata'
              ? 'border-primary text-primary bg-primary/10 font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-selected={activeTab === 'metadata'}
        >
          ข้อมูลทางเทคนิค
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'volumes' && (
          <>
            {/* Cut & Fill Summary Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-card border border-destructive/30 p-3 rounded-xl shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-destructive font-bold">
                  <Pickaxe className="w-4 h-4" />
                  ขุดดิน (Cut)
                </div>
                <div className="text-lg font-bold text-destructive font-mono mt-1">
                  -{cutVolumeM3.toLocaleString('th-TH')}
                </div>
                <div className="text-[11px] text-muted-foreground">ลูกบาศก์เมตร (m³)</div>
              </div>

              <div className="bg-card border border-success/30 p-3 rounded-xl shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-success font-bold">
                  <TrendingUp className="w-4 h-4" />
                  ถมดิน (Fill)
                </div>
                <div className="text-lg font-bold text-success font-mono mt-1">
                  +{fillVolumeM3.toLocaleString('th-TH')}
                </div>
                <div className="text-[11px] text-muted-foreground">ลูกบาศก์เมตร (m³)</div>
              </div>
            </div>

            {/* Net Balance */}
            <div className="bg-card border border-border p-3 rounded-xl flex items-center justify-between text-xs shadow-sm">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Scale className="w-4 h-4 text-primary" />
                ปริมาตรงานดินสุทธิ:
              </span>
              <span
                className={`font-mono font-bold text-sm ${
                  netVolumeM3 < 0 ? 'text-destructive' : 'text-success'
                }`}
              >
                {netVolumeM3 > 0 ? `+${netVolumeM3.toLocaleString()}` : netVolumeM3.toLocaleString()} m³
              </span>
            </div>

            {/* Recharts Volume Bar Chart */}
            <div className="bg-card border border-border p-3.5 rounded-xl shadow-sm">
              <div className="text-xs font-semibold text-foreground mb-2 flex items-center justify-between">
                <span>เปรียบเทียบปริมาตรงานดินขุดถม</span>
                <span className="text-[10px] text-muted-foreground font-mono">หน่วย: ลบ.ม.</span>
              </div>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground" fontSize={11} tickLine={false} />
                    <YAxis stroke="currentColor" className="text-muted-foreground" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: 'var(--foreground)',
                      }}
                      formatter={(val: any) => [`${Number(val).toLocaleString()} ลบ.ม.`, 'ปริมาตร']}
                    />
                    <Bar dataKey="volume" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Limitations Notice */}
            <div className="bg-card-secondary border border-border rounded-xl p-3 text-xs text-foreground space-y-1.5">
              <div className="flex items-center gap-1.5 text-primary font-semibold">
                <Info className="w-4 h-4 shrink-0" />
                ข้อจำกัดและการรับรองโดยนักวิเคราะห์
              </div>
              <p className="leading-relaxed text-[11px] text-muted-foreground">
                {limitationsNotes ||
                  'การคำนวณปริมาตรดำเนินการผ่านแบบจำลอง DSM ความละเอียดสูง 2.45 cm/px บริเวณแนวชายฝั่งทะเลที่มีเงาสะท้อนคลื่นอาจมีความคลาดเคลื่อน ±0.05m และต้องผ่านการตรวจสอบโดยนักวิเคราะห์ก่อนใช้งานจริง'}
              </p>
            </div>
          </>
        )}

        {activeTab === 'features' && (
          <div className="space-y-2.5">
            {features.map((feat, idx) => {
              const isCut = feat.featureType === 'earthwork_cut';
              const isFill = feat.featureType === 'earthwork_fill';

              return (
                <div
                  key={feat.id || idx}
                  className="bg-card-secondary border border-border rounded-xl p-3 text-xs space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-bold flex items-center gap-1.5 text-sm ${
                        isCut ? 'text-destructive' : isFill ? 'text-success' : 'text-warning'
                      }`}
                    >
                      {isCut ? 'พื้นที่ขุดดิน (Cut)' : isFill ? 'พื้นที่ถมดิน (Fill)' : 'สิ่งปลูกสร้างใหม่'}
                    </span>
                    <Badge variant={feat.isConfirmed ? 'emerald' : 'amber'}>
                      {feat.isConfirmed ? 'ยืนยันแล้ว' : 'รอตรวจสอบ'}
                    </Badge>
                  </div>

                  <div className="text-[11px] text-muted-foreground font-mono grid grid-cols-2 gap-1.5 bg-card p-2.5 rounded-lg border border-border">
                    <div>ขนาด: {feat.areaSqm?.toLocaleString()} ตร.ม.</div>
                    <div>ปริมาตร: {feat.estimatedVolumeM3?.toLocaleString() || '-'} m³</div>
                    <div>ΔZ เฉลี่ย: {feat.meanElevationChangeM ? `${feat.meanElevationChangeM} ม.` : '-'}</div>
                    <div>ความมั่นใจ: {(feat.confidence ? feat.confidence * 100 : 92).toFixed(0)}%</div>
                  </div>

                  {onReviewFeature && (
                    <div className="flex items-center gap-2 pt-1">
                      {/* Confirm Button (Min 44px touch target) */}
                      <button
                        onClick={() => onReviewFeature(feat.id, 'confirmed_change')}
                        className="flex-1 min-h-[44px] px-2 py-1.5 bg-success/15 hover:bg-success/25 border border-success/40 text-success rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-success cursor-pointer"
                        aria-label="ยืนยันการเปลี่ยนแปลงจริง"
                      >
                        <Check className="w-4 h-4" /> ยืนยันจริง
                      </button>
                      {/* False Positive Button (Min 44px touch target) */}
                      <button
                        onClick={() => onReviewFeature(feat.id, 'false_positive_shadow')}
                        className="flex-1 min-h-[44px] px-2 py-1.5 bg-destructive/15 hover:bg-destructive/25 border border-destructive/40 text-destructive rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-destructive cursor-pointer"
                        aria-label="ปฏิเสธ ระบุเป็นเงาหรือผลลวง"
                      >
                        <XCircle className="w-4 h-4" /> ผลลวง/เงา
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="space-y-3 text-xs">
            <div className="bg-card-secondary border border-border rounded-xl p-3.5 space-y-2.5">
              <div className="font-bold text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span>คุณสมบัติเชิงพิกัด PostGIS</span>
              </div>
              <div className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Storage CRS:</span>
                  <span className="text-foreground">EPSG:4326 (WGS84)</span>
                </div>
                <div className="flex justify-between">
                  <span>Projected CRS:</span>
                  <span className="text-primary font-bold">EPSG:32647 (UTM 47N)</span>
                </div>
                <div className="flex justify-between">
                  <span>ขนาดพื้นที่รวม:</span>
                  <span className="text-foreground font-bold">{areaSqm.toLocaleString()} ตร.ม.</span>
                </div>
                <div className="flex justify-between">
                  <span>ขนาดหน่วยไทย:</span>
                  <span className="text-success font-bold">{(areaSqm / 1600).toFixed(2)} ไร่</span>
                </div>
              </div>
            </div>

            <div className="bg-card-secondary border border-border rounded-xl p-3.5 space-y-2.5">
              <div className="font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>วันที่สำรวจเปรียบเทียบ</span>
              </div>
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Baseline:</span>
                  <span className="text-foreground font-mono">{baselineDate || '15 ม.ค. 2026'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Comparison:</span>
                  <span className="text-primary font-mono">{comparisonDate || '15 มี.ค. 2026'}</span>
                </div>
                <div className="flex justify-between">
                  <span>ช่วงเวลาห่างกัน:</span>
                  <span className="text-foreground font-medium">59 วัน</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer: Export Report Buttons (Min 44px touch target) */}
      <div className="p-3.5 border-t border-border bg-card-secondary space-y-2.5">
        <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
          <span>ส่งออกเอกสารรับรองผล</span>
          <span className="text-primary font-mono text-[10px] font-bold">CERTIFIED AUDIT REPORT</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => handleExport('pdf')}
            disabled={exportingFormat !== null}
            className="w-full text-xs font-bold"
          >
            {exportingFormat === 'pdf' ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <FileCheck className="w-4 h-4 mr-1" />
            )}
            รายงาน PDF
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={() => handleExport('csv')}
            disabled={exportingFormat !== null}
            className="w-full text-xs font-bold"
          >
            {exportingFormat === 'csv' ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-1 text-primary" />
            )}
            ส่งออก CSV
          </Button>
        </div>
      </div>
    </aside>
  );
}

