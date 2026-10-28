'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Badge,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Select,
} from '@/components/ui/primitives';
import { Shield, ShieldAlert, Filter } from 'lucide-react';
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
    <DashboardLayout areas={areas}>
      <PageHeader
        title="ประวัติการดำเนินการและการเข้าถึงระบบ (Audit Logs)"
        description="บันทึกเหตุการณ์สำคัญแบบแก้ไขไม่ได้ (Immutable Log) ทั้งการเข้าสู่ระบบ, การสร้างพื้นที่, การอัปโหลดไฟล์ และการรับรองผลวิเคราะห์"
        icon={ShieldAlert}
        breadcrumbs={[
          { label: 'หน้าหลัก', href: '/' },
          { label: 'บันทึกความปลอดภัย (Audit)' },
        ]}
        actions={
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground shadow-sm">
            <Shield className="w-4 h-4 text-success" />
            <span className="font-semibold">บันทึกทั้งหมด {total} รายการ</span>
          </div>
        }
      />

      {/* Audit Logs Table Card */}
      <Card className="overflow-hidden shadow-card">
        <div className="p-4 border-b border-border flex items-center justify-between text-xs bg-card-secondary/40">
          <span className="font-bold text-foreground">ประวัติกิจกรรมย้อนหลัง</span>
          <div className="flex items-center gap-2.5">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground outline-none cursor-pointer"
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>วันและเวลา (UTC+7)</TableHead>
              <TableHead>ผู้ใช้งาน (User)</TableHead>
              <TableHead>สิทธิ์ (Role)</TableHead>
              <TableHead>การกระทำ (Action)</TableHead>
              <TableHead>ทรัพยากร (Resource)</TableHead>
              <TableHead>หมายเลข IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {new Date(log.createdAt).toLocaleString('th-TH')}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {log.userName || log.userEmail || 'System'}
                </TableCell>
                <TableCell>
                  <Badge variant="info" className="text-[10px]">
                    {log.userRole || 'SYSTEM'}
                  </Badge>
                </TableCell>
                <TableCell className="text-primary font-mono font-bold text-xs">
                  {log.action}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {log.resourceType}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {log.ipAddress || '127.0.0.1'}
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableEmpty colSpan={6} message="ไม่พบบันทึกกิจกรรมตามเงื่อนไขที่เลือก" />
            )}
          </TableBody>
        </Table>
      </Card>
    </DashboardLayout>
  );
}
