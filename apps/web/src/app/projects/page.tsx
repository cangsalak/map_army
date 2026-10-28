'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Button,
  Badge,
  Card,
  Modal,
  FormField,
  Input,
  Textarea,
} from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';
import {
  FolderKanban,
  Plus,
  MapPin,
  Layers,
  ChevronRight,
  Globe,
} from 'lucide-react';
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
    <DashboardLayout areas={areas}>
      <PageHeader
        title="การจัดการโครงการ (Project Management)"
        description="บริหารจัดการโครงการสำรวจภาพถ่ายโดรน พื้นที่รับผิดชอบ และนโยบายการประมวลผล On-Premises"
        icon={FolderKanban}
        breadcrumbs={[
          { label: 'หน้าหลัก', href: '/' },
          { label: 'การจัดการโครงการ' },
        ]}
        actions={
          <Button
            onClick={() => setShowCreateModal(true)}
            variant="primary"
            size="md"
            className="gap-2 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างโครงการใหม่ (New Project)</span>
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState message="กำลังโหลดรายการโครงการ..." />
      ) : projects.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-border bg-card/50 text-center space-y-4 max-w-xl mx-auto mt-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <FolderKanban className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">ยังไม่มีโครงการในระบบ</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              สร้างโฟลเดอร์โครงการเพื่อจัดกลุ่มพื้นที่สำรวจภาพถ่ายโดรน (Managed Areas) และรอบบินสำรวจทางอากาศ
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            variant="primary"
            className="gap-2 text-xs font-bold mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างโครงการแรก (Create First Project)</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => (
            <Card
              key={proj.id}
              className="p-5 flex flex-col justify-between hover:border-primary/50 transition-all group hover:shadow-card-hover"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <span className="font-mono text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
                    PROJ-{proj.id.slice(0, 8).toUpperCase()}
                  </span>
                  <Badge variant="success" className="text-[10px]">
                    กำลังดำเนินการ
                  </Badge>
                </div>

                <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-2">
                  {proj.name}
                </h3>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                  {proj.description || 'ไม่มีคำอธิบายโครงการ'}
                </p>
              </div>

              <div className="pt-4 border-t border-border space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    พื้นที่ในโครงการ
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {proj.areasCount || 0} แปลง
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                    รอบบินโดรน
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {proj.surveysCount || 0} รอบ
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    ระบบพิกัด
                  </span>
                  <span className="font-mono text-[11px] text-foreground">
                    UTM 47N (EPSG:32647)
                  </span>
                </div>

                <div className="pt-3 border-t border-border flex items-center gap-2">
                  <Link
                    href={`/projects/${proj.id}/areas`}
                    className="flex-1 py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[11px] font-semibold text-center flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>พื้นที่รับผิดชอบ ({proj.areasCount || 0})</span>
                  </Link>
                  <Link
                    href={`/missions?projectId=${proj.id}`}
                    className="p-2 rounded-xl bg-card hover:bg-card-secondary text-foreground border border-border text-[11px] font-medium flex items-center justify-center transition-colors"
                    title="เปิด Drone Mission Planner สำหรับโครงการนี้"
                  >
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* NextAdmin Standard Modal for Create Project */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="สร้างโครงการใหม่ (Create Project)"
        description="กำหนดชื่อโครงการและขอบเขตวัตถุประสงค์การติดตาม"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <FormField label="ชื่อโครงการ (Project Name)" required>
            <Input
              required
              placeholder="เช่น โครงการพัฒนาพื้นที่พิเศษ EEC ภาคตะวันออก"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
          </FormField>

          <FormField label="รายละเอียดโครงการ (Description)">
            <Textarea
              placeholder="วัตถุประสงค์และพื้นที่ความรับผิดชอบ..."
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
            />
          </FormField>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
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
      </Modal>
    </DashboardLayout>
  );
}
