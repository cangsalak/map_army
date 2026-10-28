'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import {
  Shield,
  Users,
  Server,
  Database,
  HardDrive,
  Cpu,
  KeyRound,
  CheckCircle2,
  Lock,
  RefreshCw,
  Activity,
  Layers,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Button, Badge, Card } from '@/components/ui/primitives';
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
    if (!confirm('คำเตือน: คุณต้องการลบข้อมูลการปฏิบัติการทั้งหมด (พื้นที่ดูแล, รอบบินสำรวจ, ผลการวิเคราะห์, รายงาน) ใช่หรือไม่? บัญชีผู้ใช้และองค์กรจะยังคงอยู่')) return;

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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-navy-950 font-sans text-slate-100">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  การจัดการระบบและความปลอดภัย (Admin & System Operations)
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                บริหารจัดการบัญชีผู้ใช้งาน สิทธิ์การเข้าถึง (RBAC) และติดตามสถานะระบบเซิร์ฟเวอร์ On-Premises
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="cyan" className="font-mono text-xs">
                Air-Gapped Private Network
              </Badge>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b border-slate-800">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              ผู้ใช้งานและสิทธิ์ (Users & Roles)
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'system'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-4 h-4" />
              สถานะเซิร์ฟเวอร์และฐานข้อมูล (Infrastructure)
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'storage'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              การจัดเก็บข้อมูลภาพ (Object Storage)
            </button>
          </div>

          {/* Tab 1: Users & Roles */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="gis-panel rounded-xl overflow-hidden border border-slate-800 shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-navy-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-mono">
                    <tr>
                      <th className="px-4 py-3">ชื่อ-นามสกุล</th>
                      <th className="px-4 py-3">อีเมล</th>
                      <th className="px-4 py-3">บทบาท (Role)</th>
                      <th className="px-4 py-3">สังกัดหน่วยงาน</th>
                      <th className="px-4 py-3">เข้าสู่ระบบล่าสุด</th>
                      <th className="px-4 py-3 text-right">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {usersList.map((u) => {
                      const displayName = u.fullName || u.name || u.email;
                      return (
                        <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-white flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center font-bold text-xs">
                              {displayName.slice(0, 1)}
                            </div>
                            <span>{displayName}</span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-300">{u.email}</td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                                u.role === 'admin'
                                  ? 'bg-rose-950/80 border border-rose-800 text-rose-300'
                                  : u.role === 'project_manager'
                                  ? 'bg-amber-950/80 border border-amber-800 text-amber-300'
                                  : u.role === 'analyst'
                                  ? 'bg-cyan-950/80 border border-cyan-800 text-cyan-300'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {getRoleLabel(u.role)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-400">
                            {u.organizationName || u.org || 'ศูนย์บัญชาการ GeoMonitor 3D'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                            {u.lastLogin || (u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH') : 'ปกติ')}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Badge variant="cyan" className="text-[10px]">
                              {u.isActive !== false ? 'เปิดใช้งาน' : 'ระงับ'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: System & Database */}
          {activeTab === 'system' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    PostgreSQL 16 + PostGIS 3.4
                  </h3>
                  <Badge variant="cyan" className="text-[10px]">
                    ONLINE
                  </Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Spatial Extensions:</span>
                    <span className="font-mono text-cyan-400">postgis, postgis_raster</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Spatial Indexing:</span>
                    <span className="font-mono text-slate-200">GiST (2D & 3D Spatial Bounding)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Coordinate Systems:</span>
                    <span className="font-mono text-slate-200">EPSG:4326 (WGS84), EPSG:32647 (UTM)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Database Connection:</span>
                    <span className="font-mono text-emerald-400">Healthy (Pool Active)</span>
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    Redis 7 + BullMQ Processing Queue
                  </h3>
                  <Badge variant="cyan" className="text-[10px]">
                    ONLINE
                  </Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Queue Name:</span>
                    <span className="font-mono text-cyan-400">geomonitor-jobs</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Worker Concurrency:</span>
                    <span className="font-mono text-slate-200">2 Parallel Photogrammetry Pipelines</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Active Ingest Jobs:</span>
                    <span className="font-mono text-emerald-400">0 Queued / Ready</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Retry Strategy:</span>
                    <span className="font-mono text-slate-200">Exponential Backoff (3 attempts)</span>
                  </div>
                </div>
              </Card>

              {/* Maintenance & Reset Operations */}
              <Card className="p-5 md:col-span-2 border-rose-500/40 bg-navy-950/90 space-y-3">
                <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
                  <h3 className="font-bold text-sm text-rose-300 flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    การคืนค่าและลบข้อมูลปฏิบัติการ (Operational Data Reset)
                  </h3>
                  <Badge variant="outline" className="border-rose-500/40 text-rose-300 text-[10px]">
                    ADMIN ONLY
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  ลบข้อมูลการสำรวจทั้งหมด (พื้นที่ดูแล, รอบบินสำรวจ, ผลลัพธ์ Deliverables, ผลการคำนวณปริมาตร, รายงาน) เพื่อเริ่มต้นระบบใหม่ โดยยังคงรักษาบัญชีผู้ใช้งานและองค์กรไว้
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    disabled={isResetting}
                    onClick={handleResetOperationalData}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isResetting ? 'กำลังลบข้อมูล...' : 'ลบข้อมูลปฏิบัติการทั้งหมด (Reset All Data)'}
                  </button>
                </div>
              </Card>
            </div>
          )}

          {/* Tab 3: Storage */}
          {activeTab === 'storage' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    ถังจัดเก็บข้อมูลโดรน (S3 / MinIO Assets Bucket)
                  </h3>
                  <Badge variant="cyan" className="text-[10px]">
                    CONFIGURED
                  </Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Bucket:</span>
                    <span className="font-mono text-cyan-400">geomonitor-assets</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>ชนิดไฟล์:</span>
                    <span className="text-slate-200">ภาพถ่ายดิบโดรน, Orthomosaic COG, DSM GeoTIFF</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Storage Engine:</span>
                    <span className="font-mono text-slate-200">Self-Hosted MinIO / Local FS</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Access Control:</span>
                    <span className="font-mono text-emerald-400">Private (Signed Download URLs)</span>
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    ถังเอกสารรายงาน (Reports Bucket)
                  </h3>
                  <Badge variant="cyan" className="text-[10px]">
                    CONFIGURED
                  </Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Bucket:</span>
                    <span className="font-mono text-cyan-400">geomonitor-reports</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>ชนิดไฟล์:</span>
                    <span className="text-slate-200">รายงานวิเคราะห์ PDF และตารางข้อมูล CSV</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Retention Policy:</span>
                    <span className="font-mono text-slate-200">ถาวร (Immutable Audit Records)</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
