'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/layout/Navbar';
import LeftSidebar from '@/components/layout/LeftSidebar';
import SurveyTimeline, { TimelineSurvey } from '@/components/timeline/SurveyTimeline';
import AnalysisPanel from '@/components/analysis/AnalysisPanel';
import MetricHUD from '@/components/dashboard/MetricHUD';
import ProcessingIndicator from '@/components/processing/ProcessingIndicator';
import { AreaFeature, ChangePolygonFeature, LayerSettings } from '@/components/map/CesiumMap';
import { apiFetch, getClientToken } from '@/lib/api';
import { LoadingState, ErrorState } from '@/components/common/StateViews';
import { Plus, Sparkles, MapPin, Layers, Globe, CheckCircle2, TrendingDown, ArrowRight, Loader2, X, AlertCircle } from 'lucide-react';

// Dynamically import CesiumMap with SSR disabled (requires window & WebGL)
const CesiumMap = dynamic(() => import('@/components/map/CesiumMap'), {
  ssr: false,
  loading: () => <LoadingState message="กำลังเริ่มต้น CesiumJS 3D Globe & WebGL Engine..." />,
});

export default function GISCommandCenterDashboard() {
  const [areas, setAreas] = useState<AreaFeature[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<TimelineSurvey[]>([]);
  const [baselineSurveyId, setBaselineSurveyId] = useState<string | null>(null);
  const [comparisonSurveyId, setComparisonSurveyId] = useState<string | null>(null);
  const [changeFeatures, setChangeFeatures] = useState<ChangePolygonFeature[]>([]);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>({
    totalAreas: 0,
    completedSurveys: 0,
    pendingSurveys: 0,
    totalCutVolumeM3: 0,
    totalFillVolumeM3: 0,
    unreviewedCandidates: 0,
  });

  const [savedViewKey, setSavedViewKey] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<any>(null);

  // Global Map Layer Settings (Single Source of Truth)
  const [layerSettings, setLayerSettings] = useState<LayerSettings>({
    orthoVisible: true,
    orthoOpacity: 100,
    dsmVisible: true,
    dsmOpacity: 80,
    meshVisible: true,
    meshOpacity: 90,
  });

  const handleUpdateLayerSettings = (settings: Partial<LayerSettings>) => {
    setLayerSettings((prev) => ({ ...prev, ...settings }));
  };

  const handleSearchCoordinates = ({ lat, lon }: { lat: number; lon: number }) => {
    setSavedViewKey(`coord-${lon}-${lat}-${Date.now()}`);
  };

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Create Area Form State
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCoords, setFormCoords] = useState('');

  // 1. Fetch Areas & Metrics from Express API & PostGIS
  const loadInitialData = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [areasRes, metricsRes] = await Promise.all([
        apiFetch<any>('/areas'),
        apiFetch<any>('/dashboard/metrics'),
      ]);

      const items: AreaFeature[] = areasRes.items || areasRes || [];
      setAreas(items);
      if (items.length > 0) {
        setSelectedAreaId(items[0].id);
      } else {
        setSelectedAreaId(null);
        setSurveys([]);
        setChangeFeatures([]);
        setAnalysisData(null);
      }

      if (metricsRes?.metrics) {
        setMetrics(metricsRes.metrics);
      }
    } catch (err) {
      console.warn('[Dashboard API Warning]', err);
      setHasError(false);
      setAreas([]);
      setSelectedAreaId(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // 2. Fetch Surveys & Changes when Area changes
  useEffect(() => {
    if (!selectedAreaId) {
      setSurveys([]);
      setChangeFeatures([]);
      setAnalysisData(null);
      return;
    }

    async function loadAreaDetails() {
      try {
        const sRes = await apiFetch<TimelineSurvey[]>(`/areas/${selectedAreaId}/surveys`);
        const surveyList = Array.isArray(sRes) ? sRes : [];
        setSurveys(surveyList);

        if (surveyList.length >= 2) {
          setBaselineSurveyId(surveyList[surveyList.length - 1].id);
          setComparisonSurveyId(surveyList[0].id);
        } else if (surveyList.length === 1) {
          setBaselineSurveyId(surveyList[0].id);
          setComparisonSurveyId(null);
        } else {
          setBaselineSurveyId(null);
          setComparisonSurveyId(null);
        }

        // Fetch Change Analyses for this Area
        const changesRes = await apiFetch<any[]>(`/areas/${selectedAreaId}/change-analyses`);
        const analyses = Array.isArray(changesRes) ? changesRes : [];
        if (analyses.length > 0) {
          const latest = analyses[0];
          setAnalysisData({
            totalChangeAreaSqm: latest.totalChangeAreaSqm || 0,
            cutVolumeM3: latest.cutVolumeM3 || 0,
            fillVolumeM3: latest.fillVolumeM3 || 0,
            netVolumeM3: (latest.fillVolumeM3 || 0) - (latest.cutVolumeM3 || 0),
            confidenceScore: latest.confidenceScore || 0.95,
          });

          // Fetch change features for this analysis
          const featRes = await apiFetch<any>(`/change-analyses/${latest.id}/features`);
          const rawFeatures: ChangePolygonFeature[] = Array.isArray(featRes)
            ? featRes
            : Array.isArray(featRes?.features)
            ? featRes.features.map((f: any) => ({
                id: f.id || f.properties?.id,
                featureType: f.properties?.featureType || f.featureType,
                areaSqm: f.properties?.areaSqm ?? f.areaSqm ?? 0,
                meanElevationChangeM: f.properties?.meanElevationChangeM ?? f.meanElevationChangeM ?? null,
                estimatedVolumeM3: f.properties?.estimatedVolumeM3 ?? f.estimatedVolumeM3 ?? null,
                isConfirmed: f.properties?.isConfirmed ?? f.isConfirmed ?? false,
                confidence: f.properties?.confidence ?? f.confidence,
                geometry: f.geometry,
              }))
            : [];
          setChangeFeatures(rawFeatures);
        } else {
          setAnalysisData(null);
          setChangeFeatures([]);
        }
      } catch (err) {
        console.warn('[Surveys Load Error]', err);
      }
    }

    loadAreaDetails();
  }, [selectedAreaId]);

  // Keyboard Escape listener for Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCreateModalOpen && !isSubmitting) {
        setIsCreateModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen, isSubmitting]);

  // Handle Create Area via Modal
  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCreateError(null);
    try {
      const lines = formCoords.trim().split('\n');
      const ring = lines
        .map((line) => {
          const parts = line.split(',').map((s) => s.trim());
          if (parts.length >= 2) {
            const lon = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lon) && !isNaN(lat)) {
              return [lon, lat];
            }
          }
          return null;
        })
        .filter((pt): pt is [number, number] => pt !== null);

      if (ring.length < 4) {
        throw new Error('ต้องระบุพิกัดอย่างน้อย 4 จุด (และจุดแรกกับจุดสุดท้ายต้องเหมือนกัน) เพื่อสร้างรูปปิด');
      }

      const res = await apiFetch<any>('/areas', {
        method: 'POST',
        body: JSON.stringify({
          name: formName,
          description: formDesc,
          boundary: {
            type: 'Polygon',
            coordinates: [ring],
          },
        }),
      });

      setIsCreateModalOpen(false);
      setFormName('');
      setFormDesc('');
      setFormCoords('');
      await loadInitialData();
      if (res?.data?.id) {
        setSelectedAreaId(res.data.id);
      }
    } catch (err: any) {
      setCreateError(err.message || 'เกิดข้อผิดพลาดในการบันทึกพื้นที่');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Analyst Feature Review
  const handleReviewFeature = async (featureId: string, status: string) => {
    try {
      await apiFetch(`/change-features/${featureId}/review`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      setChangeFeatures((prev) =>
        prev.map((f) => (f.id === featureId ? { ...f, isConfirmed: status === 'confirmed_change' } : f))
      );
    } catch {
      setChangeFeatures((prev) =>
        prev.map((f) => (f.id === featureId ? { ...f, isConfirmed: status === 'confirmed_change' } : f))
      );
    }
  };

  // Handle Report Generation
  const handleGenerateReport = async (format: 'pdf' | 'csv') => {
    if (!selectedAreaId) return;
    try {
      const res = await apiFetch<any>('/reports', {
        method: 'POST',
        body: JSON.stringify({
          areaId: selectedAreaId,
          title: `รายงานสรุปการวิเคราะห์การเปลี่ยนแปลง ${selectedArea?.name || ''}`,
          format,
        }),
      });
      const token = getClientToken();
      window.open(`http://localhost:4000/api/v1/reports/${res.id}/download${token ? `?token=${token}` : ''}`, '_blank');
    } catch (err: any) {
      alert(`ไม่สามารถสร้างรายงานได้: ${err.message}`);
    }
  };

  // Trigger processing job
  const handleRunComparison = async () => {
    if (!selectedAreaId || !baselineSurveyId || !comparisonSurveyId) {
      return;
    }
    setActiveJob({
      id: 'job-live-analysis',
      jobType: 'elevation_diff',
      status: 'processing',
      progressPercent: 25,
    });
  };

  const selectedArea = areas.find((a) => a.id === selectedAreaId);

  if (hasError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-navy-950 p-6">
        <ErrorState onRetry={loadInitialData} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-navy-950 font-sans">
      {/* 1. Top Navigation Bar */}
      <Navbar
        areas={areas}
        selectedAreaId={selectedAreaId}
        onSelectArea={setSelectedAreaId}
        onOpenNotifications={() =>
          setActiveJob({
            id: 'job-notif',
            jobType: 'photogrammetry_ingest',
            status: 'processing',
            progressPercent: 65,
          })
        }
      />

      {/* 2. Main GIS Command Center Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar: Projects, Managed Areas, Saved Views, Layer Navigation */}
        <LeftSidebar
          areas={areas}
          selectedAreaId={selectedAreaId}
          onSelectArea={setSelectedAreaId}
          onSelectSavedView={setSavedViewKey}
          onOpenCreateArea={() => setIsCreateModalOpen(true)}
          defaultCollapsed={true}
          layerSettings={layerSettings}
          onUpdateLayerSettings={handleUpdateLayerSettings}
          onSearchCoordinates={handleSearchCoordinates}
        />

        {/* 3. Center Visually Dominant 3D Map Canvas */}
        <div className="flex-1 flex flex-col relative h-full">
          {/* Floating HUD Metric Cards */}
          <MetricHUD metrics={metrics} />

          {/* Background Processing Job Indicator Dock */}
          {activeJob && (
            <ProcessingIndicator job={activeJob} onClose={() => setActiveJob(null)} />
          )}

          {/* Non-intrusive Empty State Alert (When 0 Areas Exist, doesn't block map canvas) */}
          {areas.length === 0 && !isLoading && !isBannerDismissed && (
            <div
              className="absolute top-4 left-4 z-20 max-w-sm bg-[#101A2D]/95 border border-[#06B6D4]/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md select-none animate-in fade-in slide-in-from-top-2 duration-200"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#06B6D4]/15 text-[#06B6D4] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-[#F1F5F9]">ระบบพร้อมใช้งาน (Ready)</h4>
                    <button
                      onClick={() => setIsBannerDismissed(true)}
                      className="min-w-[28px] min-h-[28px] flex items-center justify-center text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#162238] transition-colors"
                      aria-label="ปิดการแจ้งเตือน"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-[#CBD5E1] leading-relaxed">
                    ยังไม่มีพื้นที่ดูแลในระบบ กำหนดขอบเขตเพื่อเริ่มตรวจจับความเปลี่ยนแปลง
                  </p>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-2 min-h-[40px] px-3.5 py-1.5 bg-[#06B6D4] hover:bg-[#22D3EE] text-[#080F20] font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md focus-visible:ring-2 focus-visible:ring-[#22D3EE] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ กำหนดพื้นที่ดูแลใหม่</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Cesium 3D Globe */}
          <div className="flex-1 relative">
            <CesiumMap
              areas={areas}
              selectedAreaId={selectedAreaId}
              onSelectArea={setSelectedAreaId}
              changeFeatures={changeFeatures}
              savedViewKey={savedViewKey}
              layerSettings={layerSettings}
            />
          </div>

          {/* 4. Bottom Timeline: Survey dates & historical comparison control */}
          <SurveyTimeline
            surveys={surveys}
            baselineSurveyId={baselineSurveyId}
            comparisonSurveyId={comparisonSurveyId}
            onSelectBaseline={setBaselineSurveyId}
            onSelectComparison={setComparisonSurveyId}
            onRunComparison={handleRunComparison}
          />
        </div>

        {/* 5. Right Inspector Panel: Metadata, Survey dates, Change stats, Analyst notes */}
        <AnalysisPanel
          areaName={selectedArea?.name}
          areaSqm={selectedArea?.areaSqm}
          totalChangeAreaSqm={analysisData?.totalChangeAreaSqm}
          cutVolumeM3={analysisData?.cutVolumeM3}
          fillVolumeM3={analysisData?.fillVolumeM3}
          netVolumeM3={analysisData?.netVolumeM3}
          confidenceScore={analysisData?.confidenceScore}
          features={changeFeatures}
          onReviewFeature={handleReviewFeature}
          onGenerateReport={handleGenerateReport}
        />
      </div>

      {/* Accessible Enterprise Create Area Modal */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#080F20]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-area-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) {
              setIsCreateModalOpen(false);
            }
          }}
        >
          <div className="bg-[#101A2D] rounded-2xl p-6 border border-[rgba(148,163,184,0.25)] max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[rgba(148,163,184,0.20)] pb-3.5">
              <h3 id="create-area-title" className="text-base font-bold text-[#F1F5F9] flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#06B6D4]" />
                กำหนดพื้นที่ดูแลใหม่ (Create Managed Area)
              </h3>
              <button
                onClick={() => !isSubmitting && setIsCreateModalOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#162238] transition-colors focus-visible:ring-2 focus-visible:ring-[#22D3EE]"
                aria-label="ปิดหน้าต่าง"
                disabled={isSubmitting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {createError && (
              <div className="p-3 bg-[#F43F5E]/15 border border-[#F43F5E]/40 rounded-xl text-xs text-[#F43F5E] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateArea} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#CBD5E1] font-semibold mb-1.5 text-xs">
                  ชื่อพื้นที่สำรวจ *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ระบุชื่อพื้นที่ในการดูแล เช่น โซนก่อสร้างทางวิ่งสำรอง"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full min-h-[44px] bg-[#162238] border border-[rgba(148,163,184,0.25)] rounded-xl px-3.5 py-2 text-[#F1F5F9] placeholder-[#94A3B8] outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] text-sm"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-[#CBD5E1] font-semibold mb-1.5 text-xs">
                  รายละเอียดโครงการ (วัตถุประสงค์)
                </label>
                <textarea
                  rows={2}
                  placeholder="วัตถุประสงค์การติดตามความก้าวหน้าโครงการ..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-[#162238] border border-[rgba(148,163,184,0.25)] rounded-xl px-3.5 py-2.5 text-[#F1F5F9] placeholder-[#94A3B8] outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] text-xs leading-relaxed"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-[#CBD5E1] font-semibold mb-1.5 text-xs">
                  พิกัดรูปหลายเหลี่ยม (Longitude, Latitude ต่อบรรทัด) *
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder="101.1400, 12.6700&#10;101.1600, 12.6700&#10;101.1600, 12.6850&#10;101.1400, 12.6850&#10;101.1400, 12.6700"
                  value={formCoords}
                  onChange={(e) => setFormCoords(e.target.value)}
                  className="w-full bg-[#162238] border border-[rgba(148,163,184,0.25)] rounded-xl px-3.5 py-2.5 text-[#22D3EE] font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]"
                  disabled={isSubmitting}
                />
                <p className="text-[11px] text-[#94A3B8] mt-1.5">
                  ระบุพิกัดแบบทวนเข็มนาฬิกา จุดเริ่มต้นและจุดสิ้นสุดต้องเป็นพิกัดเดียวกันเพื่อปิดขอบเขต (Closed Ring)
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[rgba(148,163,184,0.20)]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                  className="min-h-[44px] px-5 py-2 bg-[#162238] hover:bg-[#1C2940] text-[#CBD5E1] hover:text-white rounded-xl text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#22D3EE]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] px-5 py-2 bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-50 text-[#080F20] font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg focus-visible:ring-2 focus-visible:ring-[#22D3EE] cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      กำลังบันทึกและคำนวณ PostGIS...
                    </>
                  ) : (
                    'บันทึกพื้นที่และคำนวณด้วย PostGIS'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
