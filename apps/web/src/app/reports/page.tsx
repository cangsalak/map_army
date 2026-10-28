'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { FileCheck, Download, Plus, Calendar, FileText, Printer, CheckCircle } from 'lucide-react';
import { apiFetch, getClientToken } from '@/lib/api';

export default function ReportsPage() {
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [reportTitle, setReportTitle] = useState('รายงานสรุปผลการวิเคราะห์ปริมาตรงานดินและติดตามความก้าวหน้า');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [analystNotes, setAnalystNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);

  useEffect(() => {
    async function loadAreas() {
      try {
        const res = await apiFetch<any>('/areas');
        const items = res.items || res || [];
        setAreas(items);
        if (items.length > 0) {
          setSelectedAreaId(items[0].id);
        }
      } catch (err) {
        console.warn('[Reports Error]', err);
      }
    }
    loadAreas();
  }, []);

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAreaId) return;

    setIsGenerating(true);
    try {
      const res = await apiFetch<any>('/reports', {
        method: 'POST',
        body: JSON.stringify({
          areaId: selectedAreaId,
          title: reportTitle,
          format: reportFormat,
          analystNotes,
        }),
      });

      setGeneratedReportId(res.id);
      const token = getClientToken();
      window.open(`http://localhost:4000/api/v1/reports/${res.id}/download${token ? `?token=${token}` : ''}`, '_blank');
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-navy-950 font-sans">
      <Navbar areas={areas} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar areas={areas} />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <div className="text-xs text-cyan-400 font-mono font-bold uppercase tracking-wider">
              การจัดทำและส่งออกเอกสารรายงาน (Official GIS Reports)
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              รายงานสรุปการเปรียบเทียบและการคำนวณปริมาตรงานดิน
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              สร้างรายงานสรุปเชิงบริหาร (Executive Summary) และรายงานเทคนิคพร้อมการส่งออกในรูปแบบ PDF และตารางข้อมูล CSV
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Report Generation Form */}
            <div className="gis-panel rounded-xl p-6 border border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                ออกรายงานฉบับใหม่ (Generate Report)
              </h2>

              <form onSubmit={handleCreateReport} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">เลือกพื้นที่เป้าหมาย *</label>
                  <select
                    value={selectedAreaId}
                    onChange={(e) => setSelectedAreaId(e.target.value)}
                    className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">ชื่อหัวข้อรายงาน *</label>
                  <input
                    type="text"
                    required
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">รูปแบบเอกสารผลลัพธ์ (Format) *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setReportFormat('pdf')}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        reportFormat === 'pdf'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                          : 'bg-navy-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Printer className="w-5 h-5 mx-auto mb-1" />
                      เอกสาร PDF (Printable)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportFormat('csv')}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        reportFormat === 'csv'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                          : 'bg-navy-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Download className="w-5 h-5 mx-auto mb-1" />
                      ตารางข้อมูล CSV (Excel)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    ความเห็นและการตรวจสอบของนักวิเคราะห์ (Analyst Notes)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ระบุข้อคิดเห็นทางเทคนิคหรือหมายเหตุสำหรับรายงาน..."
                    value={analystNotes}
                    onChange={(e) => setAnalystNotes(e.target.value)}
                    className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isGenerating || !selectedAreaId || areas.length === 0}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-navy-950 font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-glow-cyan transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileCheck className="w-4 h-4" />
                  {isGenerating
                    ? 'กำลังสร้างรายงาน...'
                    : areas.length === 0
                    ? 'ยังไม่มีพื้นที่ในการดูแล (กรุณาสร้างพื้นที่ก่อน)'
                    : 'สร้างและดาวน์โหลดรายงานทันที'}
                </button>
              </form>
            </div>

            {/* Report Highlights & Preview */}
            <div className="gis-panel rounded-xl p-6 border border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                โครงสร้างรายงานที่ได้รับรอง (Certified Specifications)
              </h2>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="p-3 bg-navy-950/80 rounded-lg border border-slate-800/80">
                  <div className="font-bold text-white mb-1">1. ข้อมูลสังเขปโครงการและพิกัดขอบเขต</div>
                  <div className="text-slate-400 text-[11px]">
                    ระบุรหัสโครงการ, พิกัด PostGIS WGS84, โซนฉายภาพ UTM 47N และขนาดพื้นที่เป็น ตร.ม. / ไร่
                  </div>
                </div>

                <div className="p-3 bg-navy-950/80 rounded-lg border border-slate-800/80">
                  <div className="font-bold text-white mb-1">2. ตารางสรุปปริมาตรงานดิน (Cut / Fill Volume)</div>
                  <div className="text-slate-400 text-[11px]">
                    คำนวณปริมาตรงานขุดดิน (Cut m³), ปริมาตรงานถมดิน (Fill m³) และความสูงเฉลี่ย ΔZ
                  </div>
                </div>

                <div className="p-3 bg-navy-950/80 rounded-lg border border-slate-800/80">
                  <div className="font-bold text-white mb-1">3. บันทึกข้อจำกัดและการตรวจสอบทางเทคนิค</div>
                  <div className="text-slate-400 text-[11px]">
                    แสดงความเชื่อมั่นความถูกต้อง ระบุข้อจำกัดจากเงาหรือพืชพรรณ และลายมือชื่อนักวิเคราะห์
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
