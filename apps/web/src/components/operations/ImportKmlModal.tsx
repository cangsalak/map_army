'use client';

import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileCode,
  Check,
  AlertCircle,
  Layers,
  ArrowRight,
  ShieldCheck,
  Compass,
  Plane,
  Eye,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import {
  parseKml,
  parseKmz,
  KmlFeatureCollection,
  KmlImportIntent,
} from '@geomonitor/shared';

interface ProjectOption {
  id: string;
  name: string;
}

interface ImportKmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId: string;
  availableProjects?: ProjectOption[];
  onImportSuccess?: (result: { layerId: string; layerName: string; managedAreaId?: string | null }) => void;
  onSelectMissionArea?: (polygonCoords: [number, number][], featureName: string) => void;
  defaultIntent?: KmlImportIntent;
}

export default function ImportKmlModal({
  isOpen,
  onClose,
  currentProjectId,
  availableProjects = [],
  onImportSuccess,
  onSelectMissionArea,
  defaultIntent = 'view_only',
}: ImportKmlModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSizeStr, setFileSizeStr] = useState('');
  const [fileFormat, setFileFormat] = useState<'kml' | 'kmz'>('kml');
  const [layerName, setLayerName] = useState('');
  const [intent, setIntent] = useState<KmlImportIntent>(defaultIntent);
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState<number>(0);
  const [colorHex, setColorHex] = useState<string>('#00ffff');

  const [parsedCollection, setParsedCollection] = useState<KmlFeatureCollection | null>(null);
  const [polygonFeatures, setPolygonFeatures] = useState<{ index: number; name: string; vertexCount: number }[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setFileName('');
    setFileSizeStr('');
    setParsedCollection(null);
    setPolygonFeatures([]);
    setParseWarnings([]);
    setErrorMsg(null);
    setDuplicateWarning(null);
    setSuccessMsg(null);
  };

  const handleProcessFile = async (selectedFile: File) => {
    resetState();
    setFile(selectedFile);
    setFileName(selectedFile.name);
    const sizeMb = (selectedFile.size / 1024 / 1024).toFixed(2);
    setFileSizeStr(`${sizeMb} MB (${selectedFile.size.toLocaleString()} bytes)`);

    const lowerName = selectedFile.name.toLowerCase();
    const isKmz = lowerName.endsWith('.kmz');
    const isKml = lowerName.endsWith('.kml');

    if (!isKml && !isKmz) {
      setErrorMsg('นามสกุลไฟล์ไม่ถูกต้อง: รองรับเฉพาะไฟล์ .kml และ .kmz เท่านั้น');
      return;
    }

    const fmt: 'kml' | 'kmz' = isKmz ? 'kmz' : 'kml';
    setFileFormat(fmt);

    // Default layer name from file name without extension
    const baseName = selectedFile.name.replace(/\.(kml|kmz)$/i, '');
    setLayerName(baseName);

    setIsProcessing(true);
    setProcessingStep('กำลังอ่านและตรวจสอบโครงสร้างไฟล์...');

    try {
      if (isKmz) {
        setProcessingStep('กำลังตรวจสอบโครงสร้าง ZIP และป้องกัน Zip Slip / Zip Bomb...');
        const arrayBuffer = await selectedFile.arrayBuffer();
        const parseRes = await parseKmz(arrayBuffer, selectedFile.name);

        if (!parseRes.success || !parseRes.featureCollection) {
          throw new Error(parseRes.errors?.join('\n') || 'ไม่สามารถแปลงไฟล์ KMZ ได้');
        }

        setParsedCollection(parseRes.featureCollection);
        if (parseRes.warnings) setParseWarnings(parseRes.warnings);
        extractPolygons(parseRes.featureCollection);
      } else {
        setProcessingStep('กำลังตรวจสอบไวยากรณ์ XML และพิกัด WGS84...');
        const text = await selectedFile.text();
        const parseRes = parseKml(text, selectedFile.name);

        if (!parseRes.success || !parseRes.featureCollection) {
          throw new Error(parseRes.errors?.join('\n') || 'ไม่สามารถแปลงไฟล์ KML ได้');
        }

        setParsedCollection(parseRes.featureCollection);
        if (parseRes.warnings) setParseWarnings(parseRes.warnings);
        extractPolygons(parseRes.featureCollection);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการประมวลผลไฟล์');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const extractPolygons = (fc: KmlFeatureCollection) => {
    const polys: { index: number; name: string; vertexCount: number }[] = [];
    fc.features.forEach((feat, idx) => {
      if (feat.geometry.type === 'Polygon') {
        const ring = feat.geometry.coordinates[0] || [];
        polys.push({
          index: idx,
          name: feat.properties.name || `Polygon ${polys.length + 1}`,
          vertexCount: ring.length,
        });
      }
    });
    setPolygonFeatures(polys);
    if (polys.length > 0) {
      setSelectedPolygonIndex(polys[0].index);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleProcessFile(droppedFile);
    }
  };

  const handleSubmit = async (allowDuplicate = false) => {
    if (!parsedCollection) return;

    // Special case: If user chose "Mission Area" and an external mission callback was provided
    if (intent === 'mission_area' && onSelectMissionArea) {
      const chosenFeat = parsedCollection.features[selectedPolygonIndex];
      if (chosenFeat && chosenFeat.geometry.type === 'Polygon') {
        const rawCoords = chosenFeat.geometry.coordinates[0];
        // Ensure [lon, lat] format
        const cleanPolygon: [number, number][] = rawCoords.map((c: number[]) => [c[0], c[1]]);
        onSelectMissionArea(cleanPolygon, chosenFeat.properties.name || layerName);
        setSuccessMsg(`นำเข้าพื้นที่สำรวจ ${chosenFeat.properties.name} สู่ระบบวางแผนแนวบินเรียบร้อยแล้ว!`);
        setTimeout(() => {
          onClose();
        }, 1200);
        return;
      }
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setDuplicateWarning(null);
    setProcessingStep('กำลังบันทึกข้อมูลลงสู่ระบบฐานข้อมูล GeoMonitor...');

    try {
      const payload = {
        projectId: selectedProjectId,
        layerName: layerName.trim() || fileName,
        originalFilename: fileName,
        fileFormat,
        intent,
        featureCollection: parsedCollection,
        selectedPolygonIndex,
        colorHex,
        allowDuplicate,
      };

      const res = await apiFetch<{
        layer: any;
        insertedCount: number;
        managedAreaId?: string | null;
        warnings?: string[];
      }>('/layers/import-kml', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccessMsg(`นำเข้าชั้นข้อมูล "${payload.layerName}" สำเร็จเรียบร้อย (${res.insertedCount} รูปแปลง)!`);
      setTimeout(() => {
        onImportSuccess?.({
          layerId: res.layer.id,
          layerName: res.layer.name,
          managedAreaId: res.managedAreaId,
        });
        onClose();
      }, 1200);
    } catch (err: any) {
      if (err.status === 409 || err.code === 'DUPLICATE_IMPORT_WARNING' || err.isDuplicate) {
        setDuplicateWarning(err.message || 'ตรวจพบชั้นข้อมูลชื่อนี้ในโครงการแล้ว');
      } else {
        setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการนำเข้าชั้นข้อมูล');
      }
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const summary = parsedCollection?.metadata?.geometrySummary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-navy-900 border border-cyan-500/40 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden text-slate-100 animate-fadeIn my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-navy-800 bg-navy-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/30">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">นำเข้าข้อมูลภูมิสารสนเทศ (Import KML / KMZ)</h3>
              <p className="text-xs text-slate-400">
                รองรับไฟล์จาก Google Earth, GIS และระบบสำรวจตามมาตรฐาน OGC KML 2.2
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {errorMsg && (
            <div className="p-3.5 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold">ข้อผิดพลาดในการนำเข้า:</span>
                <p className="whitespace-pre-line text-red-200">{errorMsg}</p>
              </div>
            </div>
          )}

          {duplicateWarning && (
            <div className="p-4 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-200 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>การแจ้งเตือนชั้นข้อมูลซ้ำ</span>
              </div>
              <p className="text-xs text-amber-100">{duplicateWarning}</p>
              <div className="flex gap-2 pt-1 justify-end">
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="px-3 py-1.5 bg-navy-900 border border-navy-700 text-slate-300 rounded-lg hover:bg-navy-800 text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-navy-950 font-semibold rounded-lg text-xs"
                >
                  ยืนยันนำเข้าข้อมูลซ้ำ
                </button>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-300 flex items-center gap-2.5">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Project Selection (if multiple projects exist) */}
          {availableProjects.length > 1 && (
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>เลือกโครงการปลายทาง (Destination Project):</span>
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Drag & Drop Zone */}
          {!file && (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 rounded-xl p-8 bg-navy-950/60 text-center flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:bg-navy-950/80 group"
            >
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-full group-hover:scale-110 transition-transform">
                <FileCode className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-200">
                  คลิกเพื่อเลือกไฟล์ หรือลากและวางไฟล์ KML / KMZ ที่นี่
                </p>
                <p className="text-xs text-slate-400">
                  รองรับไฟล์ .kml และ .kmz สูงสุด 35MB (ระบบตรวจสอบความปลอดภัย XXE และ Zip Slip อัตโนมัติ)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleProcessFile(f);
                }}
              />
            </div>
          )}

          {/* File Selected & Processing State */}
          {file && (
            <div className="space-y-4">
              <div className="p-3.5 bg-navy-950 rounded-xl border border-navy-800 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-cyan-500/20 text-cyan-300 rounded-lg font-mono text-xs uppercase font-bold shrink-0">
                    {fileFormat}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{fileName}</p>
                    <p className="text-[11px] text-slate-400">{fileSizeStr}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetState}
                  className="px-2.5 py-1 text-slate-400 hover:text-red-400 hover:bg-navy-900 rounded-lg text-xs transition-colors shrink-0"
                >
                  เปลี่ยนไฟล์
                </button>
              </div>

              {isProcessing && (
                <div className="p-4 bg-navy-950/80 rounded-xl border border-cyan-500/30 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-xs text-cyan-300">{processingStep || 'กำลังประมวลผล...'}</span>
                </div>
              )}

              {/* Parsed Metadata Summary */}
              {parsedCollection && (
                <div className="space-y-3">
                  <div className="p-4 bg-navy-950 rounded-xl border border-navy-800 space-y-2.5">
                    <div className="flex items-center justify-between text-slate-200 font-semibold border-b border-navy-800/80 pb-2">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>ผลการตรวจสอบโครงสร้างข้อมูลจริง</span>
                      </span>
                      <span className="text-cyan-400 font-mono text-xs">
                        รวม {parsedCollection.features.length} Features
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                      <div className="p-2 bg-navy-900/80 rounded-lg border border-navy-800/60">
                        <span className="text-slate-400 block">จุด (Points):</span>
                        <span className="font-bold text-white text-sm">{summary?.points || 0}</span>
                      </div>
                      <div className="p-2 bg-navy-900/80 rounded-lg border border-navy-800/60">
                        <span className="text-slate-400 block">เส้น (Lines):</span>
                        <span className="font-bold text-white text-sm">{summary?.lines || 0}</span>
                      </div>
                      <div className="p-2 bg-navy-900/80 rounded-lg border border-navy-800/60">
                        <span className="text-slate-400 block">พื้นที่ (Polygons):</span>
                        <span className="font-bold text-white text-sm">{summary?.polygons || 0}</span>
                      </div>
                      <div className="p-2 bg-navy-900/80 rounded-lg border border-navy-800/60">
                        <span className="text-slate-400 block">หลายส่วน (Multi):</span>
                        <span className="font-bold text-white text-sm">{summary?.multiGeometries || 0}</span>
                      </div>
                    </div>

                    {parseWarnings.length > 0 && (
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-[11px] space-y-1">
                        <div className="font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>ข้อสังเกตจากไฟล์ KML ({parseWarnings.length} รายการ):</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-amber-200/90 text-[10px]">
                          {parseWarnings.slice(0, 3).map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Settings: Layer Name & Color */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-slate-300 font-semibold">ชื่อชั้นข้อมูลในแผนที่ (Layer Name):</label>
                      <input
                        type="text"
                        value={layerName}
                        onChange={(e) => setLayerName(e.target.value)}
                        className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        placeholder="ระบุชื่อชั้นข้อมูล"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-300 font-semibold">สีแสดงผล (Color):</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={colorHex}
                          onChange={(e) => setColorHex(e.target.value)}
                          className="w-8 h-8 bg-transparent rounded cursor-pointer border border-navy-800"
                        />
                        <span className="font-mono text-slate-300">{colorHex}</span>
                      </div>
                    </div>
                  </div>

                  {/* Import Intent Selector (Requirement 10.6) */}
                  <div className="space-y-2 pt-2 border-t border-navy-800/80">
                    <label className="text-slate-200 font-semibold block">
                      วัตถุประสงค์ในการนำเข้า (Import Purpose):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      {/* Option 1: View Only */}
                      <label
                        className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                          intent === 'view_only'
                            ? 'bg-cyan-500/10 border-cyan-400 text-white'
                            : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="kmlIntent"
                          value="view_only"
                          checked={intent === 'view_only'}
                          onChange={() => setIntent('view_only')}
                          className="mt-0.5 accent-cyan-400"
                        />
                        <div>
                          <span className="font-semibold block text-slate-200">1. แสดงบนแผนที่เท่านั้น</span>
                          <span className="text-[10px] text-slate-400">
                            เพิ่มเป็นชั้นข้อมูลแสดงผล (Imported Layer) โดยไม่ดัดแปลงข้อมูลภารกิจ
                          </span>
                        </div>
                      </label>

                      {/* Option 2: Responsibility Area */}
                      <label
                        className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                          intent === 'responsibility_area'
                            ? 'bg-cyan-500/10 border-cyan-400 text-white'
                            : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="kmlIntent"
                          value="responsibility_area"
                          checked={intent === 'responsibility_area'}
                          onChange={() => setIntent('responsibility_area')}
                          className="mt-0.5 accent-cyan-400"
                        />
                        <div>
                          <span className="font-semibold block text-slate-200">2. พื้นที่รับผิดชอบ (Managed Area)</span>
                          <span className="text-[10px] text-slate-400">
                            แปลง Polygon เป็นพื้นที่ตรวจการณ์ของหน่วย พร้อมคำนวณขนาดพื้นที่
                          </span>
                        </div>
                      </label>

                      {/* Option 3: Mission Area */}
                      <label
                        className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                          intent === 'mission_area'
                            ? 'bg-cyan-500/10 border-cyan-400 text-white'
                            : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="kmlIntent"
                          value="mission_area"
                          checked={intent === 'mission_area'}
                          onChange={() => setIntent('mission_area')}
                          className="mt-0.5 accent-cyan-400"
                        />
                        <div>
                          <span className="font-semibold block text-slate-200">3. พื้นที่ภารกิจบินโดรน (Mission Area)</span>
                          <span className="text-[10px] text-slate-400">
                            ส่งต่อขอบเขต Polygon ให้ระบบ Mission Planner (ไม่สร้างแนวบินอัตโนมัติ)
                          </span>
                        </div>
                      </label>

                      {/* Option 4: Reference GIS */}
                      <label
                        className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                          intent === 'reference_gis'
                            ? 'bg-cyan-500/10 border-cyan-400 text-white'
                            : 'bg-navy-950/60 border-navy-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="kmlIntent"
                          value="reference_gis"
                          checked={intent === 'reference_gis'}
                          onChange={() => setIntent('reference_gis')}
                          className="mt-0.5 accent-cyan-400"
                        />
                        <div>
                          <span className="font-semibold block text-slate-200">4. ข้อมูลอ้างอิงภูมิสารสนเทศ (GIS Reference)</span>
                          <span className="text-[10px] text-slate-400">
                            ใช้เป็นเส้นทางคมนาคม แนวน้ำ หรือขอบเขตอ้างอิง
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* Polygon Selector if file has multiple polygons and intent requires a polygon */}
                    {(intent === 'responsibility_area' || intent === 'mission_area') && polygonFeatures.length > 1 && (
                      <div className="p-3 bg-navy-950 rounded-xl border border-cyan-500/30 space-y-1.5 mt-2">
                        <label className="text-cyan-300 font-semibold block">
                          เลือกแปลงพื้นที่เป้าหมาย (พบ {polygonFeatures.length} Polygons):
                        </label>
                        <select
                          value={selectedPolygonIndex}
                          onChange={(e) => setSelectedPolygonIndex(parseInt(e.target.value, 10))}
                          className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                        >
                          {polygonFeatures.map((p) => (
                            <option key={p.index} value={p.index}>
                              {p.name} ({p.vertexCount} จุดพิกัด)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-navy-800 bg-navy-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-navy-700 text-xs text-slate-300 hover:bg-navy-800 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!parsedCollection || isProcessing}
            onClick={() => handleSubmit(false)}
            className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-navy-950 text-xs font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-2 disabled:opacity-40 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isProcessing ? 'กำลังประมวลผล...' : 'ยืนยันนำเข้าข้อมูล (Import KML/KMZ)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
