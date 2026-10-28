'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Button,
  Badge,
  Card,
  FormField,
  Input,
  Textarea,
  Select,
  cn,
} from '@/components/ui/primitives';
import { FileCheck, Download, FileText, Printer, CheckCircle } from 'lucide-react';
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
    <DashboardLayout areas={areas} selectedAreaId={selectedAreaId} onSelectArea={setSelectedAreaId}>
      <PageHeader
        title="รายงานสรุปการเปรียบเทียบและการคำนวณปริมาตรงานดิน"
        description="สร้างรายงานสรุปเชิงบริหาร (Executive Summary) และรายงานเทคนิคพร้อมการส่งออกในรูปแบบ PDF และตารางข้อมูล CSV"
        icon={FileCheck}
        breadcrumbs={[
          { label: 'หน้าหลัก', href: '/' },
          { label: 'รายงานสรุป (Reports)' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Report Generation Form */}
        <Card className="p-6 space-y-5">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
            <FileText className="w-4 h-4 text-primary" />
            ออกรายงานฉบับใหม่ (Generate Report)
          </h2>

          <form onSubmit={handleCreateReport} className="space-y-4">
            <FormField label="เลือกพื้นที่เป้าหมาย" required>
              <Select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="ชื่อหัวข้อรายงาน" required>
              <Input
                required
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
              />
            </FormField>

            <div>
              <label className="block text-foreground text-xs font-semibold mb-2">
                รูปแบบเอกสารผลลัพธ์ (Format) *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReportFormat('pdf')}
                  className={cn(
                    'p-4 rounded-xl border text-center transition-all cursor-pointer',
                    reportFormat === 'pdf'
                      ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Printer className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <div className="text-xs font-bold">เอกสาร PDF</div>
                  <div className="text-[10px] opacity-75">Printable Report</div>
                </button>

                <button
                  type="button"
                  onClick={() => setReportFormat('csv')}
                  className={cn(
                    'p-4 rounded-xl border text-center transition-all cursor-pointer',
                    reportFormat === 'csv'
                      ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Download className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <div className="text-xs font-bold">ตารางข้อมูล CSV</div>
                  <div className="text-[10px] opacity-75">Spreadsheet Data</div>
                </button>
              </div>
            </div>

            <FormField label="ความเห็นและการตรวจสอบของนักวิเคราะห์ (Analyst Notes)">
              <Textarea
                placeholder="ระบุข้อสังเกต เช่น พบการปรับเกลี่ยดินบริเวณขอบแปลงทิศเหนือ..."
                value={analystNotes}
                onChange={(e) => setAnalystNotes(e.target.value)}
              />
            </FormField>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isGenerating}
                isLoading={isGenerating}
                variant="primary"
                className="w-full gap-2 font-bold"
              >
                <Download className="w-4 h-4" />
                <span>สร้างและดาวน์โหลดรายงานทันที (Generate Report)</span>
              </Button>
            </div>
          </form>
        </Card>

        {/* Report Export Preview & Guidance */}
        <Card className="p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <CheckCircle className="w-4 h-4 text-success" />
              มาตรฐานรายงานและการรับรองข้อมูล
            </h2>

            <div className="p-4 bg-card-secondary rounded-xl border border-border space-y-2.5 text-xs text-muted-foreground leading-relaxed">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span>การรับรองความถูกต้องด้วย Cryptographic Hash</span>
              </div>
              <p>
                เอกสารรายงานทุกฉบับที่ออกจากระบบจะถูกคำนวณ Checksum SHA-256 พร้อมระบุผู้จัดทำ, วันที่และเวลาที่พิมพ์, และข้อมูล CRS อ้างอิง เพื่อให้สามารถนำไปใช้ในกระบวนการตรวจสอบความปลอดภัยและการตรวจรับงานราชการได้จริง
              </p>
            </div>

            {generatedReportId && (
              <div className="p-4 bg-success/10 border border-success/30 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 text-success font-bold">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>สร้างรายงานฉบับล่าสุดสำเร็จ</span>
                </div>
                <div className="text-muted-foreground font-mono">
                  Report ID: {generatedReportId}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-card-secondary rounded-xl border border-border text-xs text-muted-foreground space-y-1">
            <div className="text-foreground font-medium">รูปแบบการนำไปใช้งาน:</div>
            <div>• PDF: พร้อมส่งมอบหน่วยงานบังคับบัญชาและคู่สัญญา</div>
            <div>• CSV: พร้อมนำเข้า QGIS, ArcGIS หรือระบบวิศวกรรม ERP</div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
