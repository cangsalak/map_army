'use client';

import React, { useEffect, useState, use } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import {
  FolderKanban,
  Plus,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  Shield,
  Trash2,
  Globe,
  ChevronLeft,
  Navigation,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatAreaThai } from '@geomonitor/shared';
import { useAuth } from '@/lib/auth-context';
import { Button, Badge, Card } from '@/components/ui/primitives';

interface ProjectAreasPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectAreasPage({ params }: ProjectAreasPageProps) {
  const { projectId } = use(params);
  const { hasRole } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form State for New Responsibility Area
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCoords, setFormCoords] = useState('');

  const loadProjectAndAreas = async () => {
    setIsLoading(true);
    try {
      const [projRes, areasRes] = await Promise.all([
        apiFetch<any>(`/projects/${projectId}`),
        apiFetch<any>(`/projects/${projectId}/areas`),
      ]);
      setProject(projRes);
      const items = areasRes?.items || areasRes || [];
      setAreas(Array.isArray(items) ? items : []);
    } catch (err) {
      console.warn('[Project Areas Error]', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjectAndAreas();
  }, [projectId]);

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCoords.trim()) {
      alert('กรุณากรอกชื่อพื้นที่และพิกัดขอบเขต');
      return;
    }

    try {
      const lines = formCoords.trim().split('\n').filter((l) => l.trim().length > 0);
      const ring = lines.map((line) => {
        const [lonStr, latStr] = line.split(',').map((s) => s.trim());
        return [parseFloat(lonStr), parseFloat(latStr)];
      });

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
          projectId,
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
      await loadProjectAndAreas();
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    }
  };

  const handleDeleteArea = async (areaId: string, areaName: string) => {
    if (!confirm(`คุณต้องการลบพื้นที่ "${areaName}" ใช่หรือไม่? ข้อมูลรอบสำรวจที่เกี่ยวข้องจะถูกลบทั้งหมด`)) return;

    try {
      await apiFetch(`/areas/${areaId}`, { method: 'DELETE' });
      await loadProjectAndAreas();
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการลบ: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-navy-950 font-sans text-slate-100">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar areas={areas} />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/projects" className="hover:text-cyan-400 flex items-center gap-1 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>โครงการทั้งหมด</span>
            </Link>
            <span>/</span>
            <span className="text-white font-medium">{project?.name || 'รายละเอียดโครงการ'}</span>
            <span>/</span>
            <span className="text-cyan-400 font-semibold">พื้นที่รับผิดชอบ (Responsibility Areas)</span>
          </div>

          {/* Top Title & Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-cyan-400" />
                  <span>พื้นที่รับผิดชอบ: {project?.name || '...'}</span>
                </h1>
                <Badge variant="cyan" className="font-mono text-[10px]">
                  PROJ-{projectId.slice(0, 8).toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {project?.description || 'ขอบเขตพื้นที่รับผิดชอบและแปลงสำรวจภาพถ่ายโดรนในโครงการนี้'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/missions?projectId=${projectId}`}
                className="py-2 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                <span>เปิด Drone Mission Planner</span>
              </Link>
              <Button onClick={() => setIsModalOpen(true)} className="gap-2 text-xs font-bold">
                <Plus className="w-4 h-4" />
                เพิ่มพื้นที่รับผิดชอบ (New Area)
              </Button>
            </div>
          </div>

          {/* Areas List Grid or Empty State */}
          {areas.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-slate-800 bg-navy-900/40 text-center space-y-4 max-w-xl mx-auto mt-6">
              <div className="w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
                <MapPin className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">ยังไม่มีพื้นที่รับผิดชอบในโครงการนี้</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  เพิ่มแปลงพื้นที่รับผิดชอบพร้อมกำหนดพิกัดขอบเขต Polygon (WGS84) สำหรับรอบบินสำรวจภาพถ่ายโดรน
                </p>
              </div>
              <Button onClick={() => setIsModalOpen(true)} className="gap-2 text-xs font-bold mx-auto">
                <Plus className="w-4 h-4" />
                เพิ่มพื้นที่แรกในโครงการ (Add First Area)
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {areas.map((area) => (
                <Card key={area.id} className="p-5 flex flex-col justify-between hover:border-cyan-500/40 transition-all">
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <span className="font-mono text-[11px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded">
                        AREA-{area.id.slice(0, 8).toUpperCase()}
                      </span>
                      <Badge variant={area.status === 'active' ? 'emerald' : 'slate'} className="text-[10px]">
                        {area.status === 'active' ? 'กำลังใช้งาน' : 'ระงับการใช้งาน'}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-sm text-white mb-1.5">{area.name}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                      {area.description || 'ไม่มีคำอธิบายพื้นที่'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>ขนาดพื้นที่</span>
                      <span className="font-medium text-slate-200">
                        {formatAreaThai(area.areaSqm || 0)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span>รอบบินโดรน</span>
                      <span className="font-mono font-medium text-slate-200">
                        {area.surveyCount || 0} รอบ
                      </span>
                    </div>

                    <div className="pt-2 flex items-center gap-2 border-t border-slate-800/60">
                      <Link
                        href={`/missions?areaId=${area.id}&projectId=${projectId}`}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold text-center flex items-center justify-center gap-1 transition-colors"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>วางแผนการบิน</span>
                      </Link>
                      <button
                        onClick={() => handleDeleteArea(area.id, area.name)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="ลบพื้นที่"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create Area Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4">
          <div className="gis-panel rounded-2xl max-w-lg w-full p-6 border border-cyan-500/30 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              เพิ่มพื้นที่รับผิดชอบในโครงการ (Add Responsibility Area)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              กำหนดชื่อและพิกัดหมุดขอบเขต Polygon (WGS84 ลองจิจูด, ละติจูด)
            </p>

            <form onSubmit={handleCreateArea} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">ชื่อพื้นที่รับผิดชอบ *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น แปลงขุดถม บ่อดินโซนเหนือ A-1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">คำอธิบายและวัตถุประสงค์</label>
                <textarea
                  rows={2}
                  placeholder="รายละเอียดพื้นที่หรือเป้าหมายการบินโดรน..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  พิกัดขอบเขต Polygon (ลองจิจูด, ละติจูด ต่อบรรทัด) *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="100.5018, 13.7563&#10;100.5045, 13.7563&#10;100.5045, 13.7540&#10;100.5018, 13.7540"
                  value={formCoords}
                  onChange={(e) => setFormCoords(e.target.value)}
                  className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-[11px] outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" variant="primary">
                  บันทึกพื้นที่
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
