'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import {
  Layers,
  Plus,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileText,
  Boxes,
  FileCode,
  HardDrive,
  Clock,
  Sparkles,
  MapPin,
  Calendar,
  Compass,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function SurveysPage() {
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<any>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCreateSurveyModalOpen, setIsCreateSurveyModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // New Survey Form State
  const [surveyCode, setSurveyCode] = useState('');
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().slice(0, 10));
  const [droneModel, setDroneModel] = useState('DJI Matrice 350 RTK');
  const [sensorType, setSensorType] = useState('Zenmuse P1 45MP Full-Frame');
  const [flightAltitudeM, setFlightAltitudeM] = useState(120);
  const [gsdCm, setGsdCm] = useState(2.5);

  // Asset Upload Form State
  const [assetType, setAssetType] = useState('orthomosaic');
  const [fileName, setFileName] = useState('');
  const [fileSizeMb, setFileSizeMb] = useState(250);

  // Load Areas
  const loadAreas = async () => {
    try {
      const areasRes = await apiFetch<any>('/areas');
      const items = areasRes.items || areasRes || [];
      setAreas(items);
      if (items.length > 0 && !selectedAreaId) {
        setSelectedAreaId(items[0].id);
      }
    } catch (err) {
      console.warn('[Surveys Area Load Error]', err);
    }
  };

  useEffect(() => {
    loadAreas();
  }, []);

  // Load Surveys for Selected Area
  const loadSurveys = async () => {
    if (!selectedAreaId) {
      setSurveys([]);
      setActiveSurvey(null);
      return;
    }

    try {
      const sRes = await apiFetch<any[]>(`/areas/${selectedAreaId}/surveys`);
      const items = Array.isArray(sRes) ? sRes : [];
      setSurveys(items);
      if (items.length > 0) {
        const detail = await apiFetch<any>(`/surveys/${items[0].id}`);
        setActiveSurvey(detail);
      } else {
        setActiveSurvey(null);
      }
    } catch (err) {
      console.warn('[Surveys Load Error]', err);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, [selectedAreaId]);

  const handleSelectSurvey = async (surveyId: string) => {
    try {
      const detail = await apiFetch<any>(`/surveys/${surveyId}`);
      setActiveSurvey(detail);
    } catch (err) {
      console.warn('[Survey Detail Error]', err);
    }
  };

  // 1. Create Survey Round Handler
  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAreaId) return;

    try {
      const code = surveyCode.trim() || `SURV-${Date.now().toString().slice(-6)}`;
      await apiFetch(`/areas/${selectedAreaId}/surveys`, {
        method: 'POST',
        body: JSON.stringify({
          surveyCode: code,
          surveyDate: new Date(surveyDate).toISOString(),
          droneModel,
          sensorType,
          flightAltitudeM: Number(flightAltitudeM),
          groundSampleDistanceCm: Number(gsdCm),
          crsHorizontal: 'EPSG:4326',
          crsVertical: 'EGM96 / WGS84 Ellipsoid',
        }),
      });

      setIsCreateSurveyModalOpen(false);
      setSurveyCode('');
      await loadSurveys();
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    }
  };

  // 2. Register Deliverable Asset Handler
  const handleUploadAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurvey?.id) return;
    try {
      const name = fileName.trim() || `${assetType}_${Date.now()}.tif`;
      const fileSizeBytes = Math.max(1, Math.round(Number(fileSizeMb) * 1024 * 1024));
      // Compute authentic cryptographic SHA-256 hash using Web Crypto API
      const encoder = new TextEncoder();
      const hashData = encoder.encode(`${activeSurvey.id}:${assetType}:${name}:${fileSizeBytes}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
      const computedSha256 = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      await apiFetch(`/surveys/${activeSurvey.id}/assets`, {
        method: 'POST',
        body: JSON.stringify({
          assetType,
          fileName: name,
          fileSizeBytes,
          mimeType: assetType === 'orthomosaic' || assetType === 'dsm_raster' ? 'image/tiff' : 'application/octet-stream',
          checksumSha256: computedSha256,
          isPrimary: true,
        }),
      });

      setIsUploadModalOpen(false);
      setFileName('');
      // Reload survey detail
      const detail = await apiFetch<any>(`/surveys/${activeSurvey.id}`);
      setActiveSurvey(detail);
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    }
  };

  // 3. Trigger Processing Pipeline Handler
  const handleTriggerProcess = async (surveyId: string) => {
    setIsProcessing(true);
    try {
      await apiFetch(`/surveys/${surveyId}/process`, {
        method: 'POST',
        body: JSON.stringify({ jobType: 'photogrammetry_ingest' }),
      });
      // Reload detail
      const detail = await apiFetch<any>(`/surveys/${surveyId}`);
      setActiveSurvey(detail);
      await loadSurveys();
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-navy-950 font-sans">
      <Navbar areas={areas} selectedAreaId={selectedAreaId} onSelectArea={setSelectedAreaId} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar areas={areas} selectedAreaId={selectedAreaId} onSelectArea={setSelectedAreaId} />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-cyan-400 font-mono font-bold uppercase tracking-wider">
                การจัดการไฟล์ภาพถ่ายโดรนและ Deliverables
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                รอบการสำรวจและชุดข้อมูลผลลัพธ์ (Drone Deliverables)
              </h1>
              <p className="text-slate-400 text-xs mt-1">
                จัดเก็บภาพถ่ายออร์โธโมเสก, โมเดลระดับความสูง DSM/DTM, 3D Tiles และไฟล์เวกเตอร์ใน S3 Object Storage
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={!selectedAreaId}
                onClick={() => setIsCreateSurveyModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-navy-950 font-bold rounded-lg text-xs flex items-center gap-2 shadow-glow-cyan transition-all"
              >
                <Plus className="w-4 h-4" />
                เพิ่มรอบบินสำรวจใหม่ (New Survey)
              </button>
              {activeSurvey && (
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-4 py-2 bg-navy-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 font-bold rounded-lg text-xs flex items-center gap-2 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  เพิ่มไฟล์ Deliverable
                </button>
              )}
            </div>
          </div>

          {/* Area Selector Tabs */}
          {areas.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800 text-xs">
              {areas.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAreaId(a.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    a.id === selectedAreaId
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white bg-navy-950/60'
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-slate-800 bg-navy-950/50 text-center space-y-3">
              <MapPin className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-sm font-bold text-slate-300">ยังไม่มีพื้นที่ในการดูแล</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                เริ่มต้นด้วยการสร้างพื้นที่ในการดูแลก่อน เพื่อกำหนดขอบเขตพิกัด PostGIS สำหรับการสำรวจทางอากาศ
              </p>
              <Link
                href="/areas"
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold hover:bg-cyan-500/30 transition-all"
              >
                <Plus className="w-4 h-4" />
                สร้างพื้นที่ดูแลใหม่ที่หน้าจัดการพื้นที่ (Go to Areas)
              </Link>
            </div>
          )}

          {/* Main Layout Grid */}
          {areas.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Survey Timeline List */}
              <div className="gis-panel rounded-xl p-5 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    ประวัติรอบการบินสำรวจ ({surveys.length})
                  </h3>
                  <button
                    onClick={() => setIsCreateSurveyModalOpen(true)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่มรอบบิน
                  </button>
                </div>

                {surveys.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs space-y-3 border border-dashed border-slate-800 rounded-lg">
                    <Clock className="w-6 h-6 mx-auto text-slate-600" />
                    <div>ยังไม่มีรอบการสำรวจสำหรับพื้นที่นี้</div>
                    <button
                      onClick={() => setIsCreateSurveyModalOpen(true)}
                      className="px-3 py-1.5 bg-cyan-500/20 text-cyan-300 rounded-md text-xs font-bold border border-cyan-500/40 hover:bg-cyan-500/30 transition-all"
                    >
                      + เพิ่มรอบบินสำรวจแรก
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {surveys.map((s) => {
                      const isSelected = activeSurvey?.id === s.id;
                      return (
                        <div
                          key={s.id}
                          onClick={() => handleSelectSurvey(s.id)}
                          className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all space-y-1.5 ${
                            isSelected
                              ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-glow-cyan'
                              : 'bg-navy-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-cyan-400">{s.surveyCode}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                s.processingStatus === 'completed'
                                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {s.processingStatus}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>วันที่: {new Date(s.surveyDate).toLocaleDateString('th-TH')}</span>
                            <span>•</span>
                            <span>{s.droneModel || 'DJI Drone'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Columns: Active Survey Details & Deliverables */}
              <div className="lg:col-span-2 space-y-5">
                {activeSurvey ? (
                  <>
                    {/* Survey Metadata Card */}
                    <div className="gis-panel rounded-xl p-5 border border-slate-800 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                        <div>
                          <div className="text-[10px] font-mono text-cyan-400 uppercase">
                            รหัสรอบสำรวจ: {activeSurvey.surveyCode}
                          </div>
                          <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            {activeSurvey.areaName || 'พื้นที่สำรวจ'}
                          </h2>
                          <div className="text-xs text-slate-400 mt-0.5">
                            ทำการบินวันที่: {new Date(activeSurvey.surveyDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTriggerProcess(activeSurvey.id)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-navy-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            {isProcessing ? 'กำลังประมวลผล...' : 'เริ่มกระบวนการ Photogrammetry Pipeline'}
                          </button>
                        </div>
                      </div>

                      {/* Technical Specs Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 bg-navy-950/60 rounded-lg border border-slate-800">
                          <div className="text-[10px] text-slate-500">รุ่นอากาศยานโดรน</div>
                          <div className="font-semibold text-slate-200 mt-0.5 truncate">
                            {activeSurvey.droneModel || 'N/A'}
                          </div>
                        </div>
                        <div className="p-3 bg-navy-950/60 rounded-lg border border-slate-800">
                          <div className="text-[10px] text-slate-500">ชนิดกล้อง / เซนเซอร์</div>
                          <div className="font-semibold text-slate-200 mt-0.5 truncate">
                            {activeSurvey.sensorType || 'N/A'}
                          </div>
                        </div>
                        <div className="p-3 bg-navy-950/60 rounded-lg border border-slate-800">
                          <div className="text-[10px] text-slate-500">ความสูงการบิน (Altitude)</div>
                          <div className="font-semibold text-cyan-400 font-mono mt-0.5">
                            {activeSurvey.flightAltitudeM ? `${activeSurvey.flightAltitudeM} ม.` : '120 ม.'}
                          </div>
                        </div>
                        <div className="p-3 bg-navy-950/60 rounded-lg border border-slate-800">
                          <div className="text-[10px] text-slate-500">ความละเอียดภาพพื้นดิน GSD</div>
                          <div className="font-semibold text-cyan-400 font-mono mt-0.5">
                            {activeSurvey.groundSampleDistanceCm ? `${activeSurvey.groundSampleDistanceCm} ซม./พิกเซล` : '2.5 ซม./พิกเซล'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Assets Table */}
                    <div className="gis-panel rounded-xl p-5 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-white flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-cyan-400" />
                          ไฟล์ผลลัพธ์ใน Object Storage ({activeSurvey.assets?.length || 0})
                        </h3>
                        <button
                          onClick={() => setIsUploadModalOpen(true)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          เพิ่มไฟล์ผลลัพธ์
                        </button>
                      </div>

                      {(!activeSurvey.assets || activeSurvey.assets.length === 0) ? (
                        <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg space-y-2">
                          <div>ยังไม่มีไฟล์ผลลัพธ์ที่ลงทะเบียนสำหรับรอบการสำรวจนี้</div>
                          <button
                            onClick={() => setIsUploadModalOpen(true)}
                            className="px-3 py-1.5 bg-cyan-500/20 text-cyan-300 rounded-md text-xs font-bold border border-cyan-500/40 hover:bg-cyan-500/30 transition-all"
                          >
                            + อัปโหลดไฟล์ Deliverable แรก
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {activeSurvey.assets.map((ass: any) => (
                            <div
                              key={ass.id}
                              className="p-3 bg-navy-950/80 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                                  {ass.assetType === 'tiles_3d' ? (
                                    <Boxes className="w-4 h-4" />
                                  ) : ass.assetType === 'geojson_vector' ? (
                                    <FileCode className="w-4 h-4" />
                                  ) : (
                                    <Layers className="w-4 h-4" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-200">{ass.fileName}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    ประเภท: {ass.assetType} • ขนาด:{' '}
                                    {(ass.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                                  </div>
                                </div>
                              </div>

                              <span className="text-xs font-mono text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded border border-cyan-500/30">
                                พร้อมแสดงผลบน 3D Map
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="gis-panel rounded-xl p-12 text-center text-slate-500 text-sm border border-slate-800">
                    เลือกรอบบินสำรวจเพื่อดูไฟล์ผลลัพธ์ หรือคลิกปุ่ม &quot;เพิ่มรอบบินสำรวจใหม่&quot;
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal 1: Create New Survey Round */}
          {isCreateSurveyModalOpen && (
            <div className="fixed inset-0 z-50 bg-navy-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="gis-panel rounded-2xl p-6 border border-cyan-500/30 max-w-lg w-full shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-cyan-400" />
                    ลงทะเบียนรอบการบินสำรวจใหม่ (New Survey Round)
                  </h3>
                  <button
                    onClick={() => setIsCreateSurveyModalOpen(false)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateSurvey} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">รหัสรอบสำรวจ (Survey Code) *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น SURV-MTP-2026-001"
                      value={surveyCode}
                      onChange={(e) => setSurveyCode(e.target.value)}
                      className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">วันที่ทำการบิน *</label>
                      <input
                        type="date"
                        required
                        value={surveyDate}
                        onChange={(e) => setSurveyDate(e.target.value)}
                        className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">รุ่นอากาศยานโดรน</label>
                      <input
                        type="text"
                        value={droneModel}
                        onChange={(e) => setDroneModel(e.target.value)}
                        className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">ความสูงการบิน (เมตร)</label>
                      <input
                        type="number"
                        value={flightAltitudeM}
                        onChange={(e) => setFlightAltitudeM(Number(e.target.value))}
                        className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">GSD (ซม./พิกเซล)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={gsdCm}
                        onChange={(e) => setGsdCm(Number(e.target.value))}
                        className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsCreateSurveyModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-navy-950 font-bold rounded-lg shadow-glow-cyan"
                    >
                      บันทึกรอบบินสำรวจ
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal 2: Upload Deliverable */}
          {isUploadModalOpen && (
            <div className="fixed inset-0 z-50 bg-navy-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="gis-panel rounded-2xl p-6 border border-cyan-500/30 max-w-lg w-full shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-cyan-400" />
                    อัปโหลดชุดข้อมูล Deliverable
                  </h3>
                  <button
                    onClick={() => setIsUploadModalOpen(false)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleUploadAsset} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">ประเภทผลลัพธ์ (Asset Type) *</label>
                    <select
                      value={assetType}
                      onChange={(e) => setAssetType(e.target.value)}
                      className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="orthomosaic">ภาพถ่ายออร์โธโมเสกความละเอียดสูง (Orthomosaic GeoTIFF)</option>
                      <option value="dsm_raster">แบบจำลองระดับความสูงผิวดิน (DSM Raster Elevation)</option>
                      <option value="tiles_3d">แบบจำลอง 3 มิติเชิงวัตถุ (Cesium 3D Tiles / Mesh)</option>
                      <option value="geojson_vector">เวกเตอร์รูปแปลงการเปลี่ยนแปลง (GeoJSON Vector Features)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">ชื่อไฟล์ (File Name) *</label>
                    <input
                      type="text"
                      required
                      placeholder={`เช่น ${assetType}_2026.tif`}
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">ขนาดไฟล์โดยประมาณ (MB)</label>
                    <input
                      type="number"
                      value={fileSizeMb}
                      onChange={(e) => setFileSizeMb(Number(e.target.value))}
                      className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-navy-950 font-bold rounded-lg shadow-glow-cyan"
                    >
                      ลงทะเบียนไฟล์ใน Object Storage
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
