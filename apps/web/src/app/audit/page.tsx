'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { Shield, ShieldAlert, Clock, User, CheckCircle, Search, Filter } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        const [auditRes, areasRes] = await Promise.all([
          apiFetch<any>(`/audit/logs${actionFilter ? `?action=${actionFilter}` : ''}`),
          apiFetch<any>('/areas'),
        ]);
        setLogs(auditRes.items || []);
        setTotal(auditRes.total || 0);
        setAreas(areasRes.items || areasRes || []);
      } catch (err) {
        console.warn('[Audit Logs Load Error]', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadLogs();
  }, [actionFilter]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-navy-950 font-sans">
      <Navbar areas={areas} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar areas={areas} />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-cyan-400 font-mono font-bold uppercase tracking-wider">
                บันทึกการตรวจสอบความปลอดภัย (Security & Audit Trail)
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                ประวัติการดำเนินการและการเข้าถึงระบบ (Audit Logs)
              </h1>
              <p className="text-slate-400 text-xs mt-1">
                บันทึกเหตุการณ์สำคัญแบบแก้ไขไม่ได้ (Immutable Log) ทั้งการเข้าสู่ระบบ, การสร้างพื้นที่, การอัปโหลดไฟล์ และการรับรองผลวิเคราะห์
              </p>
            </div>

            <div className="flex items-center gap-2 bg-navy-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>บันทึกทั้งหมด {total} รายการ</span>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="gis-panel rounded-xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">ประวัติกิจกรรมย้อนหลัง</span>
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="bg-navy-950 border border-slate-700 rounded px-2 py-1 text-slate-300 outline-none cursor-pointer"
                >
                  <option value="">การกระทำทั้งหมด (All Actions)</option>
                  <option value="auth.login">เข้าสู่ระบบ (auth.login)</option>
                  <option value="area.create">สร้างพื้นที่ (area.create)</option>
                  <option value="survey.create">ลงทะเบียนรอบบิน (survey.create)</option>
                  <option value="feature.review">ตรวจสอบการเปลี่ยนแปลง (feature.review)</option>
                  <option value="report.generate">สร้างรายงาน (report.generate)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px]">
                  <tr>
                    <th className="p-3">วันและเวลา (UTC+7)</th>
                    <th className="p-3">ผู้ใช้งาน (User)</th>
                    <th className="p-3">สิทธิ์ (Role)</th>
                    <th className="p-3">การกระทำ (Action)</th>
                    <th className="p-3">ทรัพยากร (Resource)</th>
                    <th className="p-3">หมายเลข IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 text-slate-400">
                        {new Date(log.createdAt).toLocaleString('th-TH')}
                      </td>
                      <td className="p-3 font-sans font-medium text-white">
                        {log.userName || log.userEmail || 'System'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 uppercase">
                          {log.userRole || 'SYSTEM'}
                        </span>
                      </td>
                      <td className="p-3 text-emerald-400 font-bold">{log.action}</td>
                      <td className="p-3 text-slate-400">{log.resourceType}</td>
                      <td className="p-3 text-slate-500">{log.ipAddress || '127.0.0.1'}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                        ไม่พบบันทึกกิจกรรมตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
