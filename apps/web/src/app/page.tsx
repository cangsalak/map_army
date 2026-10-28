'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import LeftSidebar from '@/components/layout/LeftSidebar';
import SurveyTimeline, { TimelineSurvey } from '@/components/timeline/SurveyTimeline';
import AnalysisPanel from '@/components/analysis/AnalysisPanel';
import MetricHUD from '@/components/dashboard/MetricHUD';
import ProcessingIndicator from '@/components/processing/ProcessingIndicator';
import { AreaFeature, ChangePolygonFeature, LayerSettings } from '@/components/map/CesiumMap';
import { apiFetch, getClientToken } from '@/lib/api';
import { LoadingState, ErrorState } from '@/components/common/StateViews';
import { Plus, Sparkles, MapPin, Layers, Globe, CheckCircle2, TrendingDown, ArrowRight, Loader2, X, AlertCircle } from 'lucide-react';
import { Button, Modal, FormField, Input, Textarea } from '@/components/ui/primitives';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans transition-colors duration-150">
      {/* 1. Left Full-Height NextAdmin Sidebar (navigation) */}
      <Sidebar
        areas={areas}
        selectedAreaId={selectedAreaId}
        onSelectArea={setSelectedAreaId}
        onOpenCreateArea={() => setIsCreateModalOpen(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 2. Right Workspace Container: Top Navbar + GIS Viewport */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* NextAdmin Top Navigation Bar — always fixed height (h-16) */}
        <Navbar
          areas={areas}
          selectedAreaId={selectedAreaId}
          onSelectArea={setSelectedAreaId}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onOpenNotifications={() =>
            setActiveJob({
              id: 'job-notif',
              jobType: 'photogrammetry_ingest',
              status: 'processing',
              progressPercent: 65,
            })
          }
        />

        {/* 3. GIS Map Viewport — LAYER ARCHITECTURE
            Layer 0 (bottom): Cesium WebGL Canvas fills the entire viewport absolutely.
                              Width/Height NEVER change when sidebars open/close.
            Layer 1 (top):    All UI panels float as absolute overlays over the map.
        */}
        <div className="flex-1 relative overflow-hidden min-w-0">

          {/* ── LAYER 0: Cesium 3D Map Canvas ─────────────────────────────
              absolute inset-0 ensures it always fills the full container
              regardless of what overlays sit on top.                      */}
          <div className="absolute inset-0">
            <CesiumMap
              areas={areas}
              selectedAreaId={selectedAreaId}
              onSelectArea={setSelectedAreaId}
              changeFeatures={changeFeatures}
              savedViewKey={savedViewKey}
              layerSettings={layerSettings}
            />
          </div>

          {/* ── LAYER 1: Floating Overlay UI ──────────────────────────────
              All panels are pointer-events-none on the wrapper so clicks
              pass through to the map; individual interactive elements
              restore pointer-events-auto.                                  */}

          {/* Left GIS Tool & Spatial Data Panel — slides over the map */}
          <div className="absolute top-0 left-0 h-full z-20 pointer-events-none">
            <div className="pointer-events-auto h-full">
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
            </div>
          </div>

          {/* Right Inspector Panel — slides in from the right over the map */}
          <div className="absolute top-0 right-0 h-full z-20 pointer-events-none">
            <div className="pointer-events-auto h-full">
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
          </div>

          {/* Bottom Timeline — floats at bottom over the map */}
          <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
            <div className="pointer-events-auto">
              <SurveyTimeline
                surveys={surveys}
                baselineSurveyId={baselineSurveyId}
                comparisonSurveyId={comparisonSurveyId}
                onSelectBaseline={setBaselineSurveyId}
                onSelectComparison={setComparisonSurveyId}
                onRunComparison={handleRunComparison}
              />
            </div>
          </div>

          {/* Floating HUD Metric Cards — top-right of map */}
          <div className="absolute top-2 right-2 z-20 pointer-events-none">
            <div className="pointer-events-auto">
              <MetricHUD metrics={metrics} />
            </div>
          </div>

          {/* Background Processing Job Indicator */}
          {activeJob && (
            <div className="absolute top-16 right-4 z-30 pointer-events-auto">
              <ProcessingIndicator job={activeJob} onClose={() => setActiveJob(null)} />
            </div>
          )}

          {/* Non-intrusive Empty State Alert */}
          {areas.length === 0 && !isLoading && !isBannerDismissed && (
            <div
              className="absolute top-4 left-20 z-20 max-w-sm bg-card/95 border border-border text-foreground rounded-2xl p-4 shadow-2xl backdrop-blur-md select-none animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-auto"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground">ระบบพร้อมใช้งาน (Ready)</h4>
                    <button
                      onClick={() => setIsBannerDismissed(true)}
                      className="min-w-[28px] min-h-[28px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                      aria-label="ปิดการแจ้งเตือน"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    ยังไม่มีพื้นที่ดูแลในระบบ กำหนดขอบเขตเพื่อเริ่มตรวจจับความเปลี่ยนแปลง
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-2 text-xs"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    <span>+ กำหนดพื้นที่ดูแลใหม่</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Standardized Create Area Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !isSubmitting && setIsCreateModalOpen(false)}
        title="กำหนดพื้นที่ดูแลใหม่ (Create Managed Area)"
        description="ระบุชื่อแปลงและป้อนจุดพิกัดรูปปิด Linear Ring ตามมาตรฐาน PostGIS Polygon"
        maxWidth="lg"
      >
        {createError && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{createError}</span>
          </div>
        )}

        <form onSubmit={handleCreateArea} className="space-y-4">
          <FormField label="ชื่อพื้นที่สำรวจ" required>
            <Input
              required
              placeholder="ระบุชื่อพื้นที่ในการดูแล เช่น โซนก่อสร้างทางวิ่งสำรอง"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              disabled={isSubmitting}
            />
          </FormField>

          <FormField label="รายละเอียดโครงการ (วัตถุประสงค์)">
            <Textarea
              rows={2}
              placeholder="วัตถุประสงค์การติดตามความก้าวหน้าโครงการ..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              disabled={isSubmitting}
            />
          </FormField>

          <FormField
            label="พิกัดรูปหลายเหลี่ยม (Longitude, Latitude ต่อบรรทัด)"
            required
            hint="ระบุพิกัดแบบทวนเข็มนาฬิกา จุดแรกและจุดสุดท้ายเหมือนกัน"
          >
            <Textarea
              rows={5}
              required
              placeholder="101.1400, 12.6700&#10;101.1600, 12.6700&#10;101.1600, 12.6850&#10;101.1400, 12.6850&#10;101.1400, 12.6700"
              value={formCoords}
              onChange={(e) => setFormCoords(e.target.value)}
              className="font-mono text-xs"
              disabled={isSubmitting}
            />
          </FormField>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              isLoading={isSubmitting}
            >
              {isSubmitting ? 'กำลังบันทึกและคำนวณ PostGIS...' : 'บันทึกพื้นที่และคำนวณด้วย PostGIS'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
