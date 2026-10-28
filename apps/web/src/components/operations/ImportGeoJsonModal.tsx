'use client';

import React, { useState } from 'react';
import {
  Upload,
  X,
  FileCode,
  Check,
  AlertCircle,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface ImportGeoJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  layerId: string;
  layerName: string;
  onImportSuccess: () => void;
}

export default function ImportGeoJsonModal({
  isOpen,
  onClose,
  layerId,
  layerName,
  onImportSuccess,
}: ImportGeoJsonModalProps) {
  const [fileContent, setFileContent] = useState<any | null>(null);
  const [fileName, setFileName] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [featureSummary, setFeatureSummary] = useState<{ [key: string]: number }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
          throw new Error('โครงสร้างไฟล์ไม่ถูกต้อง: ต้องเป็น GeoJSON FeatureCollection');
        }

        // Validate CRS / coordinates
        let points = 0;
        let lines = 0;
        let polygons = 0;
        let others = 0;

        for (const f of parsed.features) {
          if (!f.geometry || !f.geometry.type || !f.geometry.coordinates) {
            throw new Error('พบ Feature ที่ไม่มี Geometry หรือพิกัดผิดรูปแบบ');
          }
          if (f.geometry.type === 'Point') points++;
          else if (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString') lines++;
          else if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') polygons++;
          else others++;
        }

        setFileContent(parsed);
        setPreviewCount(parsed.features.length);
        setFeatureSummary({
          'จุด (Points)': points,
          'เส้น (Lines)': lines,
          'พื้นที่ (Polygons)': polygons,
          'อื่นๆ (Others)': others,
        });
      } catch (err: any) {
        setErrorMsg(err.message || 'ไฟล์ JSON มีรูปแบบไม่ถูกต้อง');
        setFileContent(null);
        setPreviewCount(null);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!fileContent || !layerId) return;

    setIsUploading(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ insertedCount: number }>(`/layers/${layerId}/import`, {
        method: 'POST',
        body: JSON.stringify(fileContent),
      });

      setSuccessMsg(`นำเข้าข้อมูลรูปแปลงและสัญลักษณ์สำเร็จ ${res.insertedCount} รายการ!`);
      setTimeout(() => {
        onImportSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-navy-900 border border-cyan-500/30 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-slate-100 animate-fadeIn">
        {/* Header */}
        <div className="px-5 py-4 border-b border-navy-800 bg-navy-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">นำเข้าข้อมูลแผนที่ (GeoJSON Import)</h3>
              <p className="text-xs text-slate-400">
                นำเข้ารูปแปลงลงสู่ชั้นข้อมูล: <span className="text-cyan-300 font-semibold">{layerName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* File Picker Dropzone */}
          <div className="border border-dashed border-cyan-500/40 rounded-xl p-6 bg-navy-950/60 text-center flex flex-col items-center justify-center gap-2">
            <FileCode className="w-8 h-8 text-cyan-400" />
            <span className="text-xs text-slate-300 font-medium">
              เลือกไฟล์ .geojson หรือ .json ที่เป็นไปตามมาตรฐาน WGS84 (EPSG:4326)
            </span>
            <input
              type="file"
              accept=".geojson,.json,application/geo+json"
              onChange={handleFileChange}
              className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer mt-2"
            />
          </div>

          {/* Preview Statistics */}
          {previewCount !== null && (
            <div className="p-3.5 bg-navy-950 rounded-xl border border-navy-800 space-y-2">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span>สรุปการตรวจสอบพรีวิว ({fileName})</span>
                <span className="text-cyan-400 font-mono">{previewCount} วัตถุ</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-navy-800">
                {Object.entries(featureSummary).map(([label, count]) => (
                  <div key={label} className="flex justify-between">
                    <span>{label}:</span>
                    <span className="font-mono text-white">{count}</span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 pt-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>พิกัดอยู่ในระบบอ้างอิง WGS84 และรองรับรูปแบบคุณสมบัติสัญลักษณ์ส่วนขยาย</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-navy-800 bg-navy-950/80 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-navy-700 text-xs text-slate-300 hover:bg-navy-800 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!fileContent || isUploading}
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-navy-950 text-xs font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 disabled:opacity-40 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>{isUploading ? 'กำลังนำเข้า...' : 'ยืนยันนำเข้าข้อมูล'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
