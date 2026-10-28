'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Button,
  Badge,
  Card,
  FormField,
  Select,
  cn,
} from '@/components/ui/primitives';
import {
  TrendingDown,
  TrendingUp,
  Play,
  CheckCircle,
  AlertTriangle,
  Sliders,
  ArrowRight,
  MapPin,
  Plus,
  Scale,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatAreaThai, formatVolumeThai } from '@geomonitor/shared';

export default function AnalysisPage() {
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [surveys, setSurveys] = useState<any[]>([]);
  const [baselineSurveyId, setBaselineSurveyId] = useState<string>('');
  const [comparisonSurveyId, setComparisonSurveyId] = useState<string>('');
  const [analysisType, setAnalysisType] = useState<'level1_image' | 'level2_elevation' | 'combined'>('combined');
  const [isRunning, setIsRunning] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<any>(null);

  useEffect(() => {
    async function loadAreas() {
      try {
        const res = await apiFetch<any>('/areas');
        const items = res.items || res || [];
        setAreas(Array.isArray(items) ? items : []);
        if (items.length > 0) {
          setSelectedAreaId(items[0].id);
        }
      } catch (err) {
        console.warn('[Analysis Load Error]', err);
      }
    }
    loadAreas();
  }, []);

  useEffect(() => {
    if (!selectedAreaId) {
      setSurveys([]);
      setBaselineSurveyId('');
      setComparisonSurveyId('');
      return;
    }

    async function loadSurveysAndAnalyses() {
      try {
        const sRes = await apiFetch<any[]>(`/areas/${selectedAreaId}/surveys`);
        const surveyList = Array.isArray(sRes) ? sRes : [];
        setSurveys(surveyList);
        if (surveyList.length >= 2) {
          setBaselineSurveyId(surveyList[surveyList.length - 1].id);
          setComparisonSurveyId(surveyList[0].id);
        } else if (surveyList.length === 1) {
          setBaselineSurveyId(surveyList[0].id);
          setComparisonSurveyId(surveyList[0].id);
        } else {
          setBaselineSurveyId('');
          setComparisonSurveyId('');
        }

        // Fetch existing analyses for this area
        const aRes = await apiFetch<any[]>(`/areas/${selectedAreaId}/change-analyses`);
        if (Array.isArray(aRes) && aRes.length > 0) {
          setLatestAnalysis(aRes[0]);
        } else {
          setLatestAnalysis(null);
        }
      } catch (err) {
        console.warn('[Analysis Surveys Load Error]', err);
      }
    }
    loadSurveysAndAnalyses();
  }, [selectedAreaId]);

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAreaId || !baselineSurveyId || !comparisonSurveyId) {
      alert('กรุณาเลือกรอบบินอ้างอิงและรอบบินเปรียบเทียบ');
      return;
    }

    setIsRunning(true);
    try {
      const res = await apiFetch<any>(`/areas/${selectedAreaId}/change-analyses`, {
        method: 'POST',
        body: JSON.stringify({
          baselineSurveyId,
          comparisonSurveyId,
          analysisType,
        }),
      });
      setLatestAnalysis(res);
      alert('ประมวลผลการวิเคราะห์การเปลี่ยนแปลงและคำนวณปริมาตรเรียบร้อยแล้ว');
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <DashboardLayout areas={areas} selectedAreaId={selectedAreaId} onSelectArea={setSelectedAreaId}>
      <PageHeader
        title="การวิเคราะห์เปรียบเทียบภาพถ่ายและระดับความสูง 3 มิติ"
        description="เปรียบเทียบความแตกต่างระหว่างสองรอบบินสำรวจ คำนวณปริมาตรงานดินขุดถม (Cut/Fill Volume m³) และสร้างรูปแปลงการเปลี่ยนแปลง"
        icon={TrendingDown}
        breadcrumbs={[
          { label: 'หน้าหลัก', href: '/' },
          { label: 'วิเคราะห์การเปลี่ยนแปลง & ปริมาตร' },
        ]}
      />

      {areas.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-border bg-card/50 text-center space-y-4 max-w-xl mx-auto mt-6">
          <MapPin className="w-10 h-10 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-base font-bold text-foreground">ยังไม่มีพื้นที่ในการดูแล</h3>
            <p className="text-xs text-muted-foreground mt-1">
              กรุณาสร้างพื้นที่ในการดูแลและเพิ่มรอบการบินสำรวจโดรนก่อน จึงจะสามารถทำการวิเคราะห์การเปลี่ยนแปลงได้
            </p>
          </div>
          <Link
            href="/areas"
            className="px-4 py-2.5 bg-primary text-white font-bold rounded-xl text-xs inline-flex items-center gap-2 shadow-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            <span>ไปที่หน้าจัดการพื้นที่ (Create Area)</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Run Analysis Form Card */}
          <Card className="p-6 space-y-5">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <Sliders className="w-4 h-4 text-primary" />
              กำหนดค่าการวิเคราะห์เปรียบเทียบ (Analysis Parameters)
            </h2>

            <form onSubmit={handleRunAnalysis} className="space-y-4">
              <FormField label="เลือกพื้นที่สำรวจเป้าหมาย" required>
                <Select
                  value={selectedAreaId}
                  onChange={(e) => setSelectedAreaId(e.target.value)}
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatAreaThai(a.areaSqm)})
                    </option>
                  ))}
                </Select>
              </FormField>

              {surveys.length < 2 ? (
                <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 text-warning text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    <span>ต้องมีรอบบินสำรวจอย่างน้อย 2 รอบ</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    พื้นที่นี้มีรอบบินสำรวจเพียง {surveys.length} รอบ การเปรียบเทียบการเปลี่ยนแปลง (Change Detection) จำเป็นต้องมีอย่างน้อย 2 รอบเวลา (Baseline และ Comparison)
                  </p>
                  <Link
                    href="/surveys"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-warning text-slate-950 font-bold rounded-lg text-[11px] hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มรอบบินสำรวจในหน้ารอบสำรวจโดรน
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="1. รอบบินอ้างอิง (Baseline)" required>
                      <Select
                        value={baselineSurveyId}
                        onChange={(e) => setBaselineSurveyId(e.target.value)}
                      >
                        {surveys.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.surveyCode} ({new Date(s.surveyDate).toLocaleDateString('th-TH')})
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField label="2. รอบบินเปรียบเทียบ (Comparison)" required>
                      <Select
                        value={comparisonSurveyId}
                        onChange={(e) => setComparisonSurveyId(e.target.value)}
                      >
                        {surveys.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.surveyCode} ({new Date(s.surveyDate).toLocaleDateString('th-TH')})
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>

                  <div>
                    <label className="block text-foreground text-xs font-semibold mb-2">
                      ขั้นตอนและระดับการวิเคราะห์ (Analysis Pipeline Type) *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setAnalysisType('level1_image')}
                        className={cn(
                          'p-3 rounded-xl border text-left transition-all cursor-pointer',
                          analysisType === 'level1_image'
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                            : 'bg-card border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <div className="font-bold text-xs">ระดับ 1 (ภาพถ่าย)</div>
                        <div className="text-[10px] opacity-75">2D Orthomosaic Diff</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAnalysisType('level2_elevation')}
                        className={cn(
                          'p-3 rounded-xl border text-left transition-all cursor-pointer',
                          analysisType === 'level2_elevation'
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                            : 'bg-card border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <div className="font-bold text-xs">ระดับ 2 (ความสูง)</div>
                        <div className="text-[10px] opacity-75">DSM Elevation Cut/Fill</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAnalysisType('combined')}
                        className={cn(
                          'p-3 rounded-xl border text-left transition-all cursor-pointer',
                          analysisType === 'combined'
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                            : 'bg-card border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <div className="font-bold text-xs">วิเคราะห์ผสาน</div>
                        <div className="text-[10px] opacity-75">Combined AI Pipeline</div>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isRunning}
                      isLoading={isRunning}
                      variant="primary"
                      className="w-full gap-2 font-bold"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>เริ่มการประมวลผลการวิเคราะห์ทันที (Run Analysis)</span>
                    </Button>
                  </div>
                </>
              )}
            </form>
          </Card>

          {/* Latest Analysis Results View */}
          <Card className="p-6 space-y-5">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <CheckCircle className="w-4 h-4 text-success" />
              ผลการวิเคราะห์และการคำนวณปริมาตรงานดิน (Calculated Results)
            </h2>

            {latestAnalysis ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20 space-y-1">
                    <div className="text-destructive flex items-center gap-1 font-bold">
                      <TrendingDown className="w-3.5 h-3.5" /> ปริมาตรงานขุดดิน (Cut)
                    </div>
                    <div className="text-xl font-bold text-destructive font-mono">
                      -{formatVolumeThai(latestAnalysis.cutVolumeM3 || 0)}
                    </div>
                  </div>

                  <div className="p-4 bg-success/10 rounded-xl border border-success/20 space-y-1">
                    <div className="text-success flex items-center gap-1 font-bold">
                      <TrendingUp className="w-3.5 h-3.5" /> ปริมาตรงานถมดิน (Fill)
                    </div>
                    <div className="text-xl font-bold text-success font-mono">
                      +{formatVolumeThai(latestAnalysis.fillVolumeM3 || 0)}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-card-secondary rounded-xl border border-border space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">พื้นที่เกิดการเปลี่ยนแปลง:</span>
                    <span className="text-foreground font-bold">{formatAreaThai(latestAnalysis.totalChangeAreaSqm || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ปริมาตรสุทธิ (Net Volume):</span>
                    <span className="text-primary font-mono font-bold">
                      {formatVolumeThai((latestAnalysis.fillVolumeM3 || 0) - (latestAnalysis.cutVolumeM3 || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">สถานะการประมวลผล:</span>
                    <Badge variant="success" className="text-[10px]">
                      {latestAnalysis.status || 'COMPLETED'}
                    </Badge>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Link
                    href={`/?areaId=${selectedAreaId}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-90 transition-all"
                  >
                    <span>ดูรูปแปลง 3D บนแผนที่ (Open 3D Map)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl space-y-2">
                <Scale className="w-8 h-8 mx-auto text-muted-foreground" />
                <div className="font-semibold text-foreground">ยังไม่มีประวัติการวิเคราะห์สำหรับพื้นที่นี้</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  เมื่อมีรอบบินสำรวจอย่างน้อย 2 รอบ ให้เลือกพารามิเตอร์ด้านซ้ายแล้วกดปุ่ม &quot;เริ่มการประมวลผลการวิเคราะห์ทันที&quot;
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
