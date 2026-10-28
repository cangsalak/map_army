'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import {
  FolderKanban,
  Plus,
  Search,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  Shield,
  Trash2,
  Edit,
  Globe,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatAreaThai } from '@geomonitor/shared';
import { useAuth } from '@/lib/auth-context';

export default function AreasPage() {
  const { hasRole } = useAuth();
  const [areas, setAreas] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form State (Clean slate for production use)
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCoords, setFormCoords] = useState('');

  const loadAreas = async () => {
    try {
      const res = await apiFetch<any>('/areas');
      const items = res.items || res || [];
      setAreas(Array.isArray(items) ? items : []);
    } catch (err) {
      console.warn('[Areas Load Error]', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAreas();
  }, []);

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCoords.trim()) {
      alert('กรุณากรอกชื่อพื้นที่และพิกัดขอบเขต');
      return;
    }

    try {
      // Parse coordinates lines into GeoJSON Linear Ring
      const lines = formCoords.trim().split('\n').filter((l) => l.trim().length > 0);
      const ring = lines.map((line) => {
        const [lonStr, latStr] = line.split(',').map((s) => s.trim());
        return [parseFloat(lonStr), parseFloat(latStr)];
      });

      // Ensure ring is closed
      if (ring.length >= 3) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (Math.abs(first[0] - last[0]) > 1e-6 || Math.abs(first[1] - last[1]) > 1e-6) {
          ring.push([...first]);
        }
      }

      await apiFetch('/areas', {
        method: 'POST',
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          boundary: {
            type: 'Polygon',
            coordinates: [ring],
          },
        }),
      });

      setFormName('');
      setFormDesc('');
      setFormCoords('');
      setIsModalOpen(false);
      await loadAreas();
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    }
  };

  const handleDeleteArea = async (areaId: string, areaName: string) => {
    if (!confirm(`คุณต้องการลบพื้นที่ "${areaName}" ใช่หรือไม่? ข้อมูลรอบสำรวจที่เกี่ยวข้องจะถูกลบทั้งหมด`)) return;

    try {
      await apiFetch(`/areas/${areaId}`, { method: 'DELETE' });
      await loadAreas();
    } catch (err: any) {
      alert(`ไม่สามารถลบพื้นที่ได้: ${err.message}`);
    }
  };

  const filteredAreas = areas.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-navy-950 font-sans">
      <Navbar areas={areas} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar areas={areas} onOpenCreateArea={() => setIsModalOpen(true)} />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-cyan-400 font-mono font-bold uppercase tracking-wider">
                การจัดการพื้นที่ภูมิสารสนเทศ (Spatial Area Management)
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                พื้นที่ในการดูแลและติดตามการเปลี่ยนแปลง
              </h1>
              <p className="text-slate-400 text-xs mt-1">
                กำหนดขอบเขตพิกัด PostGIS Polygon (EPSG:4326) และระบบฉายพิกัด UTM สำหรับคำนวณขนาดพื้นที่
              </p>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-navy-950 font-bold rounded-lg text-xs flex items-center gap-2 shadow-glow-cyan transition-all"
            >
              <Plus className="w-4 h-4" />
              เพิ่มพื้นที่ดูแลใหม่ (Add New Area)
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-3 bg-navy-900/80 border border-slate-800 rounded-lg px-3.5 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาตามชื่อพื้นที่ หรือรายละเอียดโครงการ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-slate-200 placeholder:text-slate-500 w-full"
            />
          </div>

          {/* Areas Grid or Empty State */}
          {filteredAreas.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-slate-800 bg-navy-900/40 text-center space-y-4 max-w-xl mx-auto mt-6">
              <div className="w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
                <MapPin className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">ยังไม่มีพื้นที่ในการดูแลในระบบ</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  ฐานข้อมูลพร้อมสำหรับการลงทะเบียนพื้นที่ใช้งานจริง กำหนดขอบเขตพิกัดแปลงที่ดินและพื้นที่โครงการ เพื่อเริ่มต้นวิเคราะห์และเปรียบเทียบภาพถ่ายโดรน
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-navy-950 font-bold rounded-xl text-xs inline-flex items-center gap-2 shadow-glow-cyan transition-all"
              >
                <Plus className="w-4 h-4" />
                สร้างพื้นที่ดูแลแรก (Create First Area)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAreas.map((area) => (
                <div
                  key={area.id}
                  className="gis-panel rounded-xl p-5 border border-slate-800 hover:border-cyan-500/40 flex flex-col justify-between transition-all shadow-md group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          area.status === 'monitoring'
                            ? 'bg-amber-950/70 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {area.status === 'monitoring' ? 'อยู่ระหว่างเฝ้าระวัง' : 'ปกติ (Active)'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-cyan-400 font-mono">
                          {area.surveyCount || 0} รอบบินสำรวจ
                        </span>
                        <button
                          onClick={() => handleDeleteArea(area.id, area.name)}
                          title="ลบพื้นที่"
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                        {area.name}
                      </h3>
                      <p className="text-slate-400 text-xs mt-1 line-clamp-2">
                        {area.description || 'ไม่มีรายละเอียดโครงการ'}
                      </p>
                    </div>

                    <div className="p-3 bg-navy-950/80 rounded-lg border border-slate-800/80 space-y-1 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">ขนาดพื้นที่คำนวณ:</span>
                        <span className="text-cyan-400 font-bold">{formatAreaThai(area.areaSqm)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">ระบบพิกัด:</span>
                        <span className="text-slate-300 text-[11px]">WGS84 (EPSG:4326) / UTM 47N</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <Link
                      href="/"
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5"
                    >
                      เปิดในแผนที่ 3D <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href="/surveys"
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <Layers className="w-3.5 h-3.5" /> ไฟล์สำรวจ
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Area Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 bg-navy-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="gis-panel rounded-2xl p-6 border border-cyan-500/30 max-w-lg w-full shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    กำหนดพื้นที่ดูแลใหม่ (Create Managed Area)
                  </h3>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateArea} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">ชื่อพื้นที่สำรวจ *</label>
                    <input
                      type="text"
                      required
                      placeholder="ระบุชื่อพื้นที่ในการดูแล เช่น โซนก่อสร้างทางวิ่งสำรอง"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">รายละเอียดโครงการ</label>
                    <textarea
                      rows={2}
                      placeholder="วัตถุประสงค์และรายละเอียดโครงการ..."
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      พิกัดรูปหลายเหลี่ยม (Longitude, Latitude ต่อบรรทัด) *
                    </label>
                    <textarea
                      rows={5}
                      required
                      placeholder={`พิกัดรูปหลายเหลี่ยม (Longitude, Latitude ต่อบรรทัด) เช่น:\n100.1234, 13.5678\n100.1345, 13.5678\n100.1345, 13.5789\n100.1234, 13.5789\n100.1234, 13.5678`}
                      value={formCoords}
                      onChange={(e) => setFormCoords(e.target.value)}
                      className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-cyan-300 font-mono text-[11px] outline-none focus:border-cyan-400"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      จุดเริ่มต้นและจุดสิ้นสุดต้องเป็นพิกัดเดียวกันเพื่อปิดขอบเขต (Closed Ring)
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-navy-950 font-bold rounded-lg shadow-glow-cyan"
                    >
                      บันทึกพื้นที่และคำนวณด้วย PostGIS
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
