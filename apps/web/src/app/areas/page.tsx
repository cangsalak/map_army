'use client';

import React, { useEffect, useState } from 'react';
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
  Plus,
  Search,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  Trash2,
  Globe,
  Compass,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatAreaThai } from '@geomonitor/shared';
import { useAuth } from '@/lib/auth-context';
import { LoadingState } from '@/components/common/StateViews';

export default function AreasPage() {
  const { hasRole } = useAuth();
  const [areas, setAreas] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCoords, setFormCoords] = useState('');

  const loadAreas = async () => {
    setIsLoading(true);
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
    <DashboardLayout areas={areas} onOpenCreateArea={() => setIsModalOpen(true)}>
      <PageHeader
        title="พื้นที่ในการดูแลและติดตามการเปลี่ยนแปลง"
        description="กำหนดขอบเขตพิกัด PostGIS Polygon (EPSG:4326) และระบบฉายพิกัด UTM สำหรับคำนวณขนาดพื้นที่"
        icon={Compass}
        breadcrumbs={[
          { label: 'หน้าหลัก', href: '/' },
          { label: 'พื้นที่ดูแล (Areas)' },
        ]}
        actions={
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            className="gap-2 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มพื้นที่ดูแลใหม่ (Add New Area)</span>
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2.5 shadow-sm max-w-xl">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="ค้นหาตามชื่อพื้นที่ หรือรายละเอียดโครงการ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground w-full"
        />
      </div>

      {isLoading ? (
        <LoadingState message="กำลังโหลดรายการพื้นที่..." />
      ) : filteredAreas.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-border bg-card/50 text-center space-y-4 max-w-xl mx-auto mt-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <MapPin className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">ยังไม่มีพื้นที่ในการดูแลในระบบ</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              ฐานข้อมูลพร้อมสำหรับการลงทะเบียนพื้นที่ใช้งานจริง กำหนดขอบเขตพิกัดแปลงที่ดินและพื้นที่โครงการ เพื่อเริ่มต้นวิเคราะห์และเปรียบเทียบภาพถ่ายโดรน
            </p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            className="gap-2 text-xs font-bold mx-auto"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างพื้นที่ดูแลแรก (Create First Area)</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAreas.map((area) => (
            <Card
              key={area.id}
              className="p-5 flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-card-hover group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={area.status === 'monitoring' ? 'warning' : 'success'}
                    className="text-[10px]"
                  >
                    {area.status === 'monitoring' ? 'อยู่ระหว่างเฝ้าระวัง' : 'ปกติ (Active)'}
                  </Badge>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-primary font-mono font-medium">
                      {area.surveyCount || 0} รอบบินสำรวจ
                    </span>
                    {hasRole('SUPER_ADMIN') && (
                      <button
                        onClick={() => handleDeleteArea(area.id, area.name)}
                        title="ลบพื้นที่"
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {area.name}
                  </h3>
                  <p className="text-muted-foreground text-xs mt-1 line-clamp-2 leading-relaxed">
                    {area.description || 'ไม่มีรายละเอียดโครงการ'}
                  </p>
                </div>

                <div className="p-3 bg-card-secondary rounded-xl border border-border/80 space-y-1 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">ขนาดพื้นที่คำนวณ:</span>
                    <span className="text-primary font-bold">{formatAreaThai(area.areaSqm)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">ระบบพิกัด:</span>
                    <span className="text-foreground text-[11px]">WGS84 / UTM 47N</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs">
                <Link
                  href={`/?areaId=${area.id}`}
                  className="text-primary hover:underline font-semibold flex items-center gap-1.5"
                >
                  <span>เปิดในแผนที่ 3D</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/surveys"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <span>ข้อมูลโดรน ({area.surveyCount || 0})</span>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal for Creating New Area */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="เพิ่มพื้นที่ดูแลใหม่ (Add Area)"
        description="ระบุชื่อแปลงและป้อนจุดพิกัดรูปปิด Linear Ring ตามมาตรฐาน PostGIS Polygon"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateArea} className="space-y-4">
          <FormField label="ชื่อพื้นที่ / แปลงที่ดิน *" required>
            <Input
              required
              placeholder="เช่น พื้นที่นิคมอุตสาหกรรมมาบตาพุด แปลง A"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </FormField>

          <FormField label="รายละเอียดโครงการ / วัตถุประสงค์">
            <Input
              placeholder="ติดตามความก้าวหน้างานถมดินและการตัดไม้..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </FormField>

          <FormField
            label="พิกัดจุดขอบเขต Polygon (Longitude, Latitude WGS84)"
            required
            hint="แถวละ 1 จุด: 100.xxx, 12.xxx"
          >
            <Textarea
              required
              rows={5}
              placeholder="101.1234, 12.5678&#10;101.1284, 12.5678&#10;101.1284, 12.5628&#10;101.1234, 12.5628"
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
