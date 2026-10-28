'use client';

import React, { useEffect, useState, use } from 'react';
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
import {
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  Trash2,
  Globe,
  Navigation,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatAreaThai } from '@geomonitor/shared';
import { useAuth } from '@/lib/auth-context';
import { LoadingState } from '@/components/common/StateViews';

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
    <DashboardLayout areas={areas}>
      <PageHeader
        title={`พื้นที่รับผิดชอบ: ${project?.name || '...'}`}
        description={project?.description || 'ขอบเขตพื้นที่รับผิดชอบและแปลงสำรวจภาพถ่ายโดรนในโครงการนี้'}
        icon={MapPin}
        breadcrumbs={[
          { label: 'หน้าหลัก', href: '/' },
          { label: 'โครงการทั้งหมด', href: '/projects' },
          { label: project?.name || 'โครงการ' },
          { label: 'พื้นที่รับผิดชอบ' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/missions?projectId=${projectId}`}
              className="py-2.5 px-3.5 rounded-xl border border-border bg-card hover:bg-card-secondary text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Navigation className="w-3.5 h-3.5 text-primary" />
              <span>เปิด Mission Planner</span>
            </Link>
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="primary"
              className="gap-2 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มพื้นที่รับผิดชอบ (New Area)</span>
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingState message="กำลังโหลดข้อมูลพื้นที่รับผิดชอบ..." />
      ) : areas.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-border bg-card/50 text-center space-y-4 max-w-xl mx-auto mt-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <MapPin className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">ยังไม่มีพื้นที่รับผิดชอบในโครงการนี้</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              เพิ่มแปลงพื้นที่รับผิดชอบพร้อมกำหนดพิกัดขอบเขต Polygon (WGS84) สำหรับรอบบินสำรวจภาพถ่ายโดรน
            </p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            className="gap-2 text-xs font-bold mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มพื้นที่แรกในโครงการ (Add First Area)</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {areas.map((area) => (
            <Card
              key={area.id}
              className="p-5 flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-card-hover"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <span className="font-mono text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
                    AREA-{area.id.slice(0, 8).toUpperCase()}
                  </span>
                  <Badge variant={area.status === 'active' ? 'success' : 'slate'} className="text-[10px]">
                    {area.status === 'active' ? 'กำลังใช้งาน' : 'ระงับการใช้งาน'}
                  </Badge>
                </div>

                <h3 className="font-bold text-sm text-foreground line-clamp-1 mb-1">
                  {area.name}
                </h3>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                  {area.description || 'ไม่มีคำอธิบายพื้นที่'}
                </p>
              </div>

              <div className="pt-4 border-t border-border space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                    ขนาดพื้นที่คำนวณ
                  </span>
                  <span className="font-mono font-bold text-primary">
                    {formatAreaThai(area.areaSqm)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    จำนวนรอบบินสำรวจ
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {area.surveyCount || 0} รอบ
                  </span>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Link
                    href={`/?areaId=${area.id}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[11px] font-semibold text-center flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>ดูบนแผนที่ 3D</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>

                  {hasRole('SUPER_ADMIN') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteArea(area.id, area.name)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:border-destructive/40"
                      title="ลบพื้นที่ดูแล"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal for Creating New Area in Project */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="เพิ่มพื้นที่รับผิดชอบใหม่ (Add Responsibility Area)"
        description={`ลงทะเบียนพื้นที่สำหรับโครงการ: ${project?.name || ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateArea} className="space-y-4">
          <FormField label="ชื่อพื้นที่ดูแล (Area Name)" required>
            <Input
              required
              placeholder="เช่น แปลงงานก่อสร้างทางหลวง ตอนที่ 3"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </FormField>

          <FormField label="คำอธิบาย / วัตถุประสงค์ (Description)">
            <Input
              placeholder="วัตถุประสงค์การติดตามการเปลี่ยนแปลงและการถมดิน..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </FormField>

          <FormField
            label="พิกัดขอบเขต Polygon (EPSG:4326 Longitude, Latitude)"
            required
            hint="แถวละ 1 จุด: lon, lat"
          >
            <Textarea
              required
              rows={5}
              placeholder="100.824, 12.684&#10;100.827, 12.684&#10;100.827, 12.681&#10;100.824, 12.681"
              value={formCoords}
              onChange={(e) => setFormCoords(e.target.value)}
              className="font-mono text-xs"
            />
          </FormField>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button type="submit" variant="primary">
              บันทึกพื้นที่ดูแล
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
