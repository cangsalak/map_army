'use client';

import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BatteryCharging,
  Clock,
  Compass,
  Layers,
  Activity,
  Zap,
  Info,
} from 'lucide-react';
import { ValidationStatus, ValidationIssue, DroneWaypointDTO, MissionWorkflowState } from '@geomonitor/shared';

interface MissionValidationPanelProps {
  status: ValidationStatus;
  issues: ValidationIssue[];
  totalDistanceM: number;
  flightTimeSec: number;
  photoCount: number;
  surveyAreaM2: number;
  batteryCount: number;
  batteryMinutes: number;
  waypoints: DroneWaypointDTO[];
  targetAltitudeM: number;
  altitudeReference: string;
  flightLinesCount?: number;
  gsdCmPerPixel?: number;
  forwardOverlap?: number;
  sideOverlap?: number;
  passACount?: { lines: number; photos: number };
  passBCount?: { lines: number; photos: number };
  assumptions?: string[];
  workflowState?: MissionWorkflowState;
}

export default function MissionValidationPanel({
  status,
  issues,
  totalDistanceM,
  flightTimeSec,
  photoCount,
  surveyAreaM2,
  batteryCount,
  batteryMinutes,
  waypoints,
  targetAltitudeM,
  altitudeReference,
  flightLinesCount = 0,
  gsdCmPerPixel = 1.5,
  forwardOverlap = 80,
  sideOverlap = 70,
  passACount,
  passBCount,
  assumptions = [],
  workflowState = 'EMPTY',
}: MissionValidationPanelProps) {
  // Format Thai Area (Rai, Ngan, Tarang Wah)
  const rai = Math.floor(surveyAreaM2 / 1600);
  const ngan = Math.floor((surveyAreaM2 % 1600) / 400);
  const wah = Math.round(((surveyAreaM2 % 1600) % 400) / 4);

  const durationMin = Math.floor(flightTimeSec / 60);
  const durationSec = Math.round(flightTimeSec % 60);

  // Group issues by level
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const infos = issues.filter((i) => i.level === 'info');

  return (
    <div className="flex flex-col h-full bg-card/95 border-l border-border text-foreground select-none backdrop-blur-md">
      {/* Panel Header */}
      <div className="h-12 px-4 border-b border-border bg-card-secondary/70 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-success/15 border border-success/40 text-success flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">ตรวจสอบ & สถิติภารกิจ</h3>
            <p className="text-[10px] text-muted-foreground">Mission Feasibility & Statistics</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Workflow State Guidance & Outdated Warnings */}
        {workflowState === 'EMPTY' && (
          <div className="p-3.5 rounded-xl border border-border bg-card-secondary/70 text-foreground space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-mono text-[10px]">1</span>
              <span>ขั้นตอนที่ 1: วาดพื้นที่สำรวจ (Draw Survey Area)</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              ยังไม่มีขอบเขตพื้นที่สำรวจบนแผนที่ กรุณาเปิดแท็บ &quot;พื้นที่&quot; ในแผงซ้าย แล้วคลิกปุ่ม &quot;วาดพื้นที่บิน&quot; เพื่อกำหนดรูปหลายเหลี่ยม (Polygon) อย่างน้อย 3 จุด
            </p>
          </div>
        )}

        {(workflowState === 'AREA_DEFINED' || workflowState === 'READY_TO_CALCULATE') && (
          <div className="p-3.5 rounded-xl border border-primary/40 bg-primary/10 text-foreground space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono text-[10px]">2</span>
              <span>พร้อมสำหรับการคำนวณ (Ready to Calculate)</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              ขอบเขตพื้นที่สำรวจถูกกำหนดแล้ว กรุณาปรับแต่งการตั้งค่าการบิน/กล้อง แล้วคลิกปุ่ม &quot;คำนวณแผนการบิน (Calculate Flight Plan)&quot; เพื่อสร้างแนวบินและจุดถ่ายภาพจริง
            </p>
          </div>
        )}

        {workflowState === 'OUTDATED' && (
          <div className="p-3.5 rounded-xl border border-warning/50 bg-warning/10 text-warning-foreground space-y-2 animate-pulse">
            <div className="flex items-center gap-2 text-xs font-bold text-warning">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <span>แผนการบินไม่เป็นปัจจุบัน (OUTDATED)</span>
            </div>
            <p className="text-[11px] text-warning/90 leading-relaxed">
              มีการแก้ไขพารามิเตอร์หรือขอบเขตพื้นที่หลังการคำนวณล่าสุด แผนการบินเดิมไม่ตรงกับการตั้งค่าปัจจุบัน กรุณากด &quot;คำนวณแผนการบิน&quot; ใหม่เพื่อปรับปรุงเส้นทาง
            </p>
          </div>
        )}

        {/* Validation Status Badge */}
        {workflowState !== 'EMPTY' && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
              status === 'PASS'
                ? 'bg-success/10 border-success/40 text-success'
                : status === 'WARNING'
                ? 'bg-warning/10 border-warning/40 text-warning'
                : 'bg-destructive/10 border-destructive/40 text-destructive'
            }`}
          >
            {status === 'PASS' && <CheckCircle2 className="w-7 h-7 text-success shrink-0" />}
            {status === 'WARNING' && <AlertTriangle className="w-7 h-7 text-warning shrink-0" />}
            {status === 'BLOCKED' && <XCircle className="w-7 h-7 text-destructive shrink-0" />}

            <div>
              <div className="text-xs font-bold uppercase tracking-wider">
                {status === 'PASS' && 'ผ่านการตรวจสอบ (Ready to Export)'}
                {status === 'WARNING' && 'ผ่านแบบมีข้อควรระวัง (Advisory Required)'}
                {status === 'BLOCKED' && 'ไม่อนุญาตให้ส่งออก (Export Blocked)'}
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {status === 'PASS' && 'พิกัด ความสูง และขอบเขตการบินสอดคล้องตามเกณฑ์ความปลอดภัย'}
                {status === 'WARNING' && 'มีประเด็นควรพิจารณาเพิ่มเติมก่อนทำการบิน'}
                {status === 'BLOCKED' && 'พบข้อผิดพลาดด้านความปลอดภัยหรือขาดจุดขึ้นบิน'}
              </div>
            </div>
          </div>
        )}

        {/* Mission Flight Statistics Grid */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span>ประมาณการการบินและพลังงาน</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-card-secondary/70 rounded-xl border border-border">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Compass className="w-3 h-3 text-primary" />
                <span>ระยะทางบินรวม</span>
              </div>
              <div className="text-sm font-bold text-foreground mt-1">
                {(totalDistanceM / 1000).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">กม.</span>
              </div>
            </div>

            <div className="p-2.5 bg-card-secondary/70 rounded-xl border border-border">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" />
                <span>เวลาบินโดยประมาณ</span>
              </div>
              <div className="text-sm font-bold text-primary mt-1">
                {durationMin}:{durationSec.toString().padStart(2, '0')}{' '}
                <span className="text-xs font-normal text-muted-foreground">นาที</span>
              </div>
            </div>

            <div className="p-2.5 bg-card-secondary/70 rounded-xl border border-border">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <BatteryCharging className="w-3 h-3 text-success" />
                <span>จำนวนแบตเตอรี่</span>
              </div>
              <div className="text-sm font-bold text-success mt-1">
                {batteryCount} <span className="text-xs font-normal text-muted-foreground">ก้อน ({batteryMinutes} น./ก้อน)</span>
              </div>
            </div>

            <div className="p-2.5 bg-card-secondary/70 rounded-xl border border-border">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>ภาพถ่ายโดยประมาณ</span>
              </div>
              <div className="text-sm font-bold text-amber-500 mt-1">
                {photoCount} <span className="text-xs font-normal text-muted-foreground">รูป</span>
              </div>
            </div>
          </div>

            <div className="p-2.5 bg-card-secondary/70 rounded-xl border border-border text-xs">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Layers className="w-3 h-3 text-primary" />
                <span>พื้นที่สำรวจทางอากาศ</span>
              </div>
              <div className="text-sm font-bold text-foreground mt-1">
                {surveyAreaM2.toLocaleString()} ตร.ม.{' '}
                <span className="text-xs font-normal text-primary">
                  ({rai} ไร่ {ngan} งาน {wah} วา²)
                </span>
              </div>
            </div>

            {/* Photogrammetry Accuracy & Geometry Card */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-card-secondary/50 rounded-xl border border-border">
                <div className="text-[10px] text-muted-foreground">จำนวนแนวบิน (Lines)</div>
                <div className="text-sm font-bold text-primary mt-0.5">
                  {flightLinesCount} <span className="text-xs font-normal text-muted-foreground">แนว</span>
                </div>
              </div>
              <div className="p-2 bg-card-secondary/50 rounded-xl border border-border">
                <div className="text-[10px] text-muted-foreground">GSD (ความละเอียดภาพ)</div>
                <div className="text-sm font-bold text-foreground mt-0.5">
                  {gsdCmPerPixel} <span className="text-xs font-normal text-muted-foreground">cm/px</span>
                </div>
              </div>
            </div>

            {/* Overlap Summary */}
            <div className="p-2.5 bg-card-secondary/50 rounded-xl border border-border flex justify-between items-center text-xs">
              <span className="text-muted-foreground text-[11px]">Overlap (ส่วนซ้อน):</span>
              <span className="font-mono text-primary font-bold text-[11px]">
                Front {forwardOverlap}% / Side {sideOverlap}%
              </span>
            </div>

            {/* 3D Crosshatch Pass Breakdown */}
            {passACount && passBCount && (
              <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-xl space-y-1.5 text-xs">
                <div className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  3D Crosshatch Mapping Passes
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-1.5 bg-card-secondary rounded border border-border">
                    <span className="text-primary font-bold">Pass A (หลัก):</span>
                    <div className="text-foreground">{passACount.lines} แนว / {passACount.photos} รูป</div>
                  </div>
                  <div className="p-1.5 bg-card-secondary rounded border border-border">
                    <span className="text-success font-bold">Pass B (ตัดขวาง):</span>
                    <div className="text-foreground">{passBCount.lines} แนว / {passBCount.photos} รูป</div>
                  </div>
                </div>
              </div>
            )}

            {/* Estimator Assumptions Note */}
            {assumptions.length > 0 && (
              <div className="p-2.5 bg-card-secondary/40 rounded-xl border border-border space-y-1 text-[10px] text-muted-foreground">
                <div className="font-semibold text-foreground flex items-center gap-1">
                  <Info className="w-3 h-3 text-primary" />
                  <span>สมมติฐานการประมาณการ:</span>
                </div>
                <ul className="list-disc pl-3.5 space-y-0.5 leading-tight">
                  {assumptions.map((asm, i) => (
                    <li key={i}>{asm}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

        {/* Validation Issues Breakdown */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            รายการตรวจสอบความเข้ากันได้ ({issues.length} รายการ)
          </div>

          {issues.length === 0 ? (
            <div className="p-3 bg-card-secondary/50 border border-border rounded-xl text-xs text-muted-foreground text-center">
              ✓ ไม่พบข้อผิดพลาดหรือข้อควรระวัง
            </div>
          ) : (
            <div className="space-y-1.5">
              {errors.map((e, idx) => (
                <div
                  key={`err-${idx}`}
                  className="p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg text-xs flex items-start gap-2"
                >
                  <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-destructive">{e.message}</div>
                    <div className="text-[10px] text-destructive/80 font-mono">[{e.category.toUpperCase()}] {e.code}</div>
                  </div>
                </div>
              ))}

              {warnings.map((w, idx) => (
                <div
                  key={`warn-${idx}`}
                  className="p-2.5 bg-warning/10 border border-warning/30 rounded-lg text-xs flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-warning">{w.message}</div>
                    <div className="text-[10px] text-warning/80 font-mono">[{w.category.toUpperCase()}] {w.code}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vertical Altitude Profile Cross-Section */}
        <div className="p-3 bg-card-secondary/70 border border-border rounded-xl space-y-2">
          <div className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
            <span>โปรไฟล์ระดับความสูง (Altitude Profile)</span>
            <span className="text-[10px] font-mono text-primary font-bold">{targetAltitudeM}m ({altitudeReference})</span>
          </div>

          <div className="h-20 w-full bg-card rounded-lg border border-border p-2 flex items-end gap-1 overflow-x-auto">
            {waypoints.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                ยังไม่มีข้อมูล Waypoint
              </div>
            ) : (
              waypoints.slice(0, 30).map((wp, idx) => {
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
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>WP #1</span>
            <span>WP #{waypoints.length || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
