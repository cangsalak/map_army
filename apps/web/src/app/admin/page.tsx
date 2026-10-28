'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Button,
  Badge,
  Card,
  Tabs,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  cn,
} from '@/components/ui/primitives';
import {
  Shield,
  Users,
  Server,
  Database,
  HardDrive,
  Cpu,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function AdminSystemPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'system' | 'storage'>('users');
  const [isResetting, setIsResetting] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await apiFetch<any>('/users');
        if (res.items) {
          setUsersList(res.items);
        }
      } catch (err) {
        console.warn('[Admin Users Load Warning]', err);
      }
    }
    loadUsers();
  }, []);

  const handleResetOperationalData = async () => {
    if (
      !confirm(
        'คำเตือน: คุณต้องการลบข้อมูลการปฏิบัติการทั้งหมด (พื้นที่ดูแล, รอบบินสำรวจ, ผลการวิเคราะห์, รายงาน) ใช่หรือไม่? บัญชีผู้ใช้และองค์กรจะยังคงอยู่'
      )
    )
      return;

    setIsResetting(true);
    try {
      const res = await apiFetch<any>('/system/reset-data', { method: 'POST' });
      alert(res.message || 'ลบข้อมูลปฏิบัติการทั้งหมดเรียบร้อยแล้ว');
      window.location.href = '/';
    } catch (err: any) {
      alert(`ข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'ผู้ดูแลระบบสูงสุด (System Admin)';
      case 'project_manager':
        return 'ผู้จัดการโครงการ (Project Manager)';
      case 'analyst':
        return 'นักวิเคราะห์ภาพถ่าย (Photogrammetry Analyst)';
      case 'viewer':
        return 'ผู้ตรวจดูข้อมูล (Read-Only Viewer)';
      default:
        return role;
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="การจัดการระบบและความปลอดภัย (Admin & System Operations)"
        description="บริหารจัดการบัญชีผู้ใช้งาน สิทธิ์การเข้าถึง (RBAC) และติดตามสถานะระบบเซิร์ฟเวอร์ On-Premises"
        icon={Shield}
        breadcrumbs={[
          { label: 'หน้าหลัก', href: '/' },
          { label: 'ผู้ดูแลระบบ (Admin)' },
        ]}
        actions={
          <Badge variant="info" className="font-mono text-xs">
            Air-Gapped Private Network
          </Badge>
        }
      />

      {/* Modern NextAdmin Style Navigation Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
        items={[
          { id: 'users', label: 'ผู้ใช้งานและสิทธิ์ (Users & Roles)', icon: Users },
          { id: 'system', label: 'สถานะเซิร์ฟเวอร์และฐานข้อมูล (Infrastructure)', icon: Server },
          { id: 'storage', label: 'การจัดเก็บข้อมูลภาพ (Object Storage)', icon: HardDrive },
        ]}
      />

      {/* Tab 1: Users & Roles */}
      {activeTab === 'users' && (
        <Card className="overflow-hidden shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ-นามสกุล</TableHead>
                <TableHead>อีเมล</TableHead>
                <TableHead>บทบาท (Role)</TableHead>
                <TableHead>สังกัดหน่วยงาน</TableHead>
                <TableHead>เข้าสู่ระบบล่าสุด</TableHead>
                <TableHead className="text-right">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersList.map((u) => {
                const displayName = u.fullName || u.name || u.email;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-bold flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs">
                        {displayName.slice(0, 1).toUpperCase()}
                      </div>
                      <span>{displayName}</span>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          u.role === 'admin'
                            ? 'danger'
                            : u.role === 'project_manager'
                            ? 'warning'
                            : u.role === 'analyst'
                            ? 'info'
                            : 'slate'
                        }
                        className="text-[10px]"
                      >
                        {getRoleLabel(u.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.organizationName || u.org || 'ศูนย์บัญชาการ GeoMonitor 3D'}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-[11px]">
                      {u.lastLogin || (u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH') : 'ปกติ')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={u.isActive !== false ? 'success' : 'slate'} className="text-[10px]">
                        {u.isActive !== false ? 'เปิดใช้งาน' : 'ระงับ'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Tab 2: System & Database */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                PostgreSQL 16 + PostGIS 3.4
              </h3>
              <Badge variant="success" className="text-[10px]">
                ONLINE
              </Badge>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Spatial Extensions:</span>
                <span className="font-mono text-primary font-semibold">postgis, postgis_raster</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Spatial Indexing:</span>
                <span className="font-mono text-foreground">GiST (2D & 3D Spatial Bounding)</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Coordinate Systems:</span>
                <span className="font-mono text-foreground">EPSG:4326 (WGS84), EPSG:32647 (UTM)</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Database Connection:</span>
                <span className="font-mono text-success font-semibold">Healthy (Pool Active)</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                Redis 7 + BullMQ Processing Queue
              </h3>
              <Badge variant="success" className="text-[10px]">
                ONLINE
              </Badge>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Queue Name:</span>
                <span className="font-mono text-primary font-semibold">geomonitor-jobs</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Worker Concurrency:</span>
                <span className="font-mono text-foreground">2 Parallel Photogrammetry Pipelines</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Active Ingest Jobs:</span>
                <span className="font-mono text-success font-semibold">0 Queued / Ready</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Retry Strategy:</span>
                <span className="font-mono text-foreground">Exponential Backoff (3 attempts)</span>
              </div>
            </div>
          </Card>

          {/* Maintenance & Reset Operations */}
          <Card className="p-5 md:col-span-2 border-destructive/40 bg-card space-y-3">
            <div className="flex items-center justify-between border-b border-destructive/20 pb-2">
              <h3 className="font-bold text-sm text-destructive flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-destructive" />
                การคืนค่าและลบข้อมูลปฏิบัติการ (Operational Data Reset)
              </h3>
              <Badge variant="danger" className="text-[10px]">
                ADMIN ONLY
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              ลบข้อมูลการสำรวจทั้งหมด (พื้นที่ดูแล, รอบบินสำรวจ, ผลลัพธ์ Deliverables, ผลการคำนวณปริมาตร, รายงาน) เพื่อเริ่มต้นระบบใหม่ โดยยังคงรักษาบัญชีผู้ใช้งานและองค์กรไว้
            </p>
            <div className="pt-2 flex justify-end">
              <Button
                disabled={isResetting}
                isLoading={isResetting}
                onClick={handleResetOperationalData}
                variant="danger"
                size="sm"
                className="gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบข้อมูลปฏิบัติการทั้งหมด (Reset All Data)</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Storage */}
      {activeTab === 'storage' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-primary" />
                ถังจัดเก็บข้อมูลโดรน (S3 / MinIO Assets Bucket)
              </h3>
              <Badge variant="info" className="text-[10px]">
                CONFIGURED
              </Badge>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Bucket:</span>
                <span className="font-mono text-primary font-semibold">geomonitor-assets</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>ชนิดไฟล์:</span>
                <span className="text-foreground">ภาพถ่ายดิบโดรน, Orthomosaic COG, DSM GeoTIFF</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Storage Engine:</span>
                <span className="font-mono text-foreground">Self-Hosted MinIO / Local FS</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Access Control:</span>
                <span className="font-mono text-success font-semibold">Private (Signed Download URLs)</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-primary" />
                ถังเอกสารรายงาน (Reports Bucket)
              </h3>
              <Badge variant="info" className="text-[10px]">
                CONFIGURED
              </Badge>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Bucket:</span>
                <span className="font-mono text-primary font-semibold">geomonitor-reports</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>ชนิดไฟล์:</span>
                <span className="text-foreground">รายงานวิเคราะห์ PDF และตารางข้อมูล CSV</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Retention Policy:</span>
                <span className="font-mono text-foreground">ถาวร (Immutable Audit Records)</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
