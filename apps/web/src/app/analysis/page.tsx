'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import {
  TrendingDown,
  TrendingUp,
  Play,
  CheckCircle,
  AlertTriangle,
  Sliders,
  Calendar,
  Layers,
  ArrowRight,
  Info,
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

  const selectedArea = areas.find((a) => a.id === selectedAreaId);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-navy-950 font-sans">
      <Navbar areas={areas} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar areas={areas} />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <div className="text-xs text-cyan-400 font-mono font-bold uppercase tracking-wider">
              เครื่องมือประมวลผลการเปลี่ยนแปลง (Geospatial Change Detection Engine)
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              การวิเคราะห์เปรียบเทียบภาพถ่ายและระดับความสูง 3 มิติ
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              เปรียบเทียบความแตกต่างระหว่างสองรอบบินสำรวจ คำนวณปริมาตรงานดินขุดถม (Cut/Fill Volume m³) และสร้างรูปแปลงการเปลี่ยนแปลง
            </p>
          </div>

          {areas.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-slate-800 bg-navy-900/40 text-center space-y-4 max-w-xl mx-auto mt-6">
              <MapPin className="w-10 h-10 text-slate-500 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-white">ยังไม่มีพื้นที่ในการดูแล</h3>
                <p className="text-xs text-slate-400 mt-1">
                  กรุณาสร้างพื้นที่ในการดูแลและเพิ่มรอบการบินสำรวจโดรนก่อน จึงจะสามารถทำการวิเคราะห์การเปลี่ยนแปลงได้
                </p>
              </div>
              <Link
                href="/areas"
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-navy-950 font-bold rounded-xl text-xs inline-flex items-center gap-2 shadow-glow-cyan"
              >
                <Plus className="w-4 h-4" />
                ไปที่หน้าจัดการพื้นที่ (Create Area)
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Run Analysis Form */}
              <div className="gis-panel rounded-xl p-6 border border-slate-800 space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  กำหนดค่าการวิเคราะห์เปรียบเทียบ (Analysis Parameters)
                </h2>

                <form onSubmit={handleRunAnalysis} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">เลือกพื้นที่สำรวจเป้าหมาย *</label>
                    <select
                      value={selectedAreaId}
                      onChange={(e) => setSelectedAreaId(e.target.value)}
                      className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatAreaThai(a.areaSqm)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {surveys.length < 2 ? (
                    <div className="p-4 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>ต้องมีรอบบินสำรวจอย่างน้อย 2 รอบ</span>
                      </div>
                      <p className="text-[11px] text-amber-200/80 leading-relaxed">
                        พื้นที่นี้มีรอบบินสำรวจเพียง {surveys.length} รอบ การเปรียบเทียบการเปลี่ยนแปลง (Change Detection) จำเป็นต้องมีอย่างน้อย 2 รอบเวลา (Baseline และ Comparison)
                      </p>
                      <Link
                        href="/surveys"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-navy-950 font-bold rounded text-[11px] hover:bg-amber-400 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> เพิ่มรอบบินสำรวจในหน้ารอบสำรวจโดรน
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-medium mb-1">
                            1. รอบบินอ้างอิง (Baseline) *
                          </label>
                          <select
                            value={baselineSurveyId}
                            onChange={(e) => setBaselineSurveyId(e.target.value)}
                            className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:border-cyan-400 cursor-pointer"
                          >
                            {surveys.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.surveyCode} ({new Date(s.surveyDate).toLocaleDateString('th-TH')})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-300 font-medium mb-1">
                            2. รอบบินเปรียบเทียบ (Comparison) *
                          </label>
                          <select
                            value={comparisonSurveyId}
                            onChange={(e) => setComparisonSurveyId(e.target.value)}
                            className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:border-cyan-400 cursor-pointer"
                          >
                            {surveys.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.surveyCode} ({new Date(s.surveyDate).toLocaleDateString('th-TH')})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">
                          ขั้นตอนและระดับการวิเคราะห์ (Analysis Pipeline Type) *
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setAnalysisType('level1_image')}
                            className={`p-2.5 rounded-lg border text-left transition-all ${
                              analysisType === 'level1_image'
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                                : 'bg-navy-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            <div className="font-bold">ระดับ 1 (ภาพถ่าย)</div>
                            <div className="text-[10px] text-slate-500">2D Orthomosaic Diff</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAnalysisType('level2_elevation')}
                            className={`p-2.5 rounded-lg border text-left transition-all ${
                              analysisType === 'level2_elevation'
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                                : 'bg-navy-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            <div className="font-bold">ระดับ 2 (ความสูง)</div>
                            <div className="text-[10px] text-slate-500">DSM Elevation Cut/Fill</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAnalysisType('combined')}
                            className={`p-2.5 rounded-lg border text-left transition-all ${
                              analysisType === 'combined'
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                                : 'bg-navy-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            <div className="font-bold">วิเคราะห์ผสาน (แนะนำ)</div>
                            <div className="text-[10px] text-slate-500">Combined AI Pipeline</div>
                          </button>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isRunning}
                          className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-navy-950 font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-glow-cyan transition-all disabled:opacity-50"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          {isRunning ? 'กำลังคำนวณและประมวลผลการวิเคราะห์...' : 'เริ่มการประมวลผลการวิเคราะห์ทันที (Run Analysis)'}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              </div>

              {/* Latest Analysis Results View */}
              <div className="gis-panel rounded-xl p-6 border border-slate-800 space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ผลการวิเคราะห์และการคำนวณปริมาตรงานดิน (Calculated Results)
                </h2>

                {latestAnalysis ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-navy-950/80 rounded-lg border border-rose-500/30">
                        <div className="text-rose-400 flex items-center gap-1 font-bold">
                          <TrendingDown className="w-3.5 h-3.5" /> ปริมาตรงานขุดดิน (Cut)
                        </div>
                        <div className="text-lg font-bold text-white font-mono mt-1">
                          -{formatVolumeThai(latestAnalysis.cutVolumeM3 || 0)}
                        </div>
                      </div>

                      <div className="p-3 bg-navy-950/80 rounded-lg border border-emerald-500/30">
                        <div className="text-emerald-400 flex items-center gap-1 font-bold">
                          <TrendingUp className="w-3.5 h-3.5" /> ปริมาตรงานถมดิน (Fill)
                        </div>
                        <div className="text-lg font-bold text-white font-mono mt-1">
                          +{formatVolumeThai(latestAnalysis.fillVolumeM3 || 0)}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-navy-950/80 rounded-lg border border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">พื้นที่เกิดการเปลี่ยนแปลง:</span>
                        <span className="text-white font-bold">{formatAreaThai(latestAnalysis.totalChangeAreaSqm || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ปริมาตรสุทธิ (Net Volume):</span>
                        <span className="text-cyan-400 font-mono font-bold">
                          {formatVolumeThai((latestAnalysis.fillVolumeM3 || 0) - (latestAnalysis.cutVolumeM3 || 0))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">สถานะการประมวลผล:</span>
                        <span className="text-emerald-400 font-bold uppercase">{latestAnalysis.status || 'COMPLETED'}</span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Link
                        href="/"
                        className="px-4 py-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold hover:bg-cyan-500/30 transition-all flex items-center gap-1.5"
                      >
                        ดูรูปแปลง 3D บนแผนที่ (Open 3D Map) <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="p-10 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg space-y-2">
                    <Scale className="w-8 h-8 mx-auto text-slate-600" />
                    <div>ยังไม่มีประวัติการวิเคราะห์สำหรับพื้นที่นี้</div>
                    <p className="text-[11px] text-slate-500">
                      เมื่อมีรอบบินสำรวจอย่างน้อย 2 รอบ ให้เลือกพารามิเตอร์ด้านซ้ายแล้วกดปุ่ม &quot;เริ่มการประมวลผลการวิเคราะห์ทันที&quot;
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
