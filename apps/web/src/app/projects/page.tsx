'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { apiFetch } from '@/lib/api';
import {
  FolderKanban,
  Plus,
  MapPin,
  Calendar,
  Layers,
  ChevronRight,
  Globe,
  CheckCircle,
  FileText,
  Clock,
} from 'lucide-react';
import { Button, Badge, Card } from '@/components/ui/primitives';
import { LoadingState } from '@/components/common/StateViews';
import Link from 'next/link';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [projRes, areasRes] = await Promise.all([
        apiFetch<any[]>('/projects'),
        apiFetch<any>('/areas'),
      ]);
      setProjects(Array.isArray(projRes) ? projRes : []);
      setAreas(areasRes?.items || areasRes || []);
    } catch (err) {
      console.warn('[Projects API]', err);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      await apiFetch<any>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || undefined,
        }),
      });
      setNewProjectName('');
      setNewProjectDesc('');
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-navy-950 font-sans text-slate-100">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar areas={areas} />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Top Title & Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-cyan-400" />
                  การจัดการโครงการ (Project Management)
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                บริหารจัดการโครงการสำรวจภาพถ่ายโดรน พื้นที่รับผิดชอบ และนโยบายการประมวลผล On-Premises
              </p>
            </div>

            <Button
              onClick={() => setShowCreateModal(true)}
              className="gap-2 text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              สร้างโครงการใหม่ (New Project)
            </Button>
          </div>

          {/* Project List Grid or Empty State */}
          {projects.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-slate-800 bg-navy-900/40 text-center space-y-4 max-w-xl mx-auto mt-6">
              <div className="w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
                <FolderKanban className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">ยังไม่มีโครงการในระบบ</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  สร้างโฟลเดอร์โครงการเพื่อจัดกลุ่มพื้นที่สำรวจภาพถ่ายโดรน (Managed Areas) และรอบบินสำรวจทางอากาศ
                </p>
              </div>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="gap-2 text-xs font-bold mx-auto"
              >
                <Plus className="w-4 h-4" />
                สร้างโครงการแรก (Create First Project)
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((proj) => (
                <Card
                  key={proj.id}
                  className="p-5 flex flex-col justify-between hover:border-cyan-500/40 transition-all group"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <span className="font-mono text-[11px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded">
                        PROJ-{proj.id.slice(0, 8).toUpperCase()}
                      </span>
                      <Badge variant="cyan" className="text-[10px]">
                        กำลังดำเนินการ
                      </Badge>
                    </div>

                    <h3 className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors line-clamp-1 mb-2">
                      {proj.name}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                      {proj.description || 'ไม่มีคำอธิบายโครงการ'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        พื้นที่ในโครงการ
                      </span>
                      <span className="font-mono font-medium text-slate-200">
                        {proj.areasCount || 0} แปลง
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-500" />
                        รอบบินโดรน
                      </span>
                      <span className="font-mono font-medium text-slate-200">
                        {proj.surveysCount || 0} รอบ
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                        ระบบพิกัด
                      </span>
                      <span className="font-mono text-[11px] text-slate-300">
                        UTM 47N (EPSG:32647)
                      </span>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                      <Link
                        href={`/projects/${proj.id}/areas`}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold text-center flex items-center justify-center gap-1 transition-colors"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>พื้นที่รับผิดชอบ ({proj.areasCount || 0})</span>
                      </Link>
                      <Link
                        href={`/missions?projectId=${proj.id}`}
                        className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                        title="เปิด Drone Mission Planner สำหรับโครงการนี้"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4">
          <div className="gis-panel rounded-2xl max-w-md w-full p-6 border border-cyan-500/30 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-cyan-400" />
              สร้างโครงการใหม่ (Create Project)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              กำหนดชื่อโครงการและขอบเขตวัตถุประสงค์การติดตาม
            </p>

            <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  ชื่อโครงการ (Project Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น โครงการพัฒนาพื้นที่พิเศษ EEC ภาคตะวันออก"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  รายละเอียดโครงการ (Description)
                </label>
                <textarea
                  rows={3}
                  placeholder="วัตถุประสงค์และพื้นที่ความรับผิดชอบ..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full bg-navy-950 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  ยกเลิก
                </Button>
                <Button type="submit" variant="primary">
                  บันทึกโครงการ
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
