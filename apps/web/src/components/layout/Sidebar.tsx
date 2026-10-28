'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Map,
  Activity,
  Compass,
  Layers,
  TrendingDown,
  FileCheck,
  ShieldAlert,
  PlusCircle,
  FolderKanban,
  CheckCircle2,
  Clock,
  Sliders,
  Plane,
} from 'lucide-react';
import { formatAreaThai } from '@geomonitor/shared';
import { AreaFeature } from '../map/CesiumMap';

interface SidebarProps {
  areas?: AreaFeature[];
  selectedAreaId?: string | null;
  onSelectArea?: (id: string) => void;
  onOpenCreateArea?: () => void;
}

export default function Sidebar({
  areas = [],
  selectedAreaId,
  onSelectArea,
  onOpenCreateArea,
}: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'ศูนย์บัญชาการ 3D (Drone & Cut/Fill)', href: '/', icon: Map },
    { label: 'Drone Mission Planner — วางแผนการบินโดรน', href: '/missions', icon: Plane },
    { label: 'แผนที่ปฏิบัติการ (Field Ops)', href: '/operations/map', icon: Activity },
    { label: 'จัดการพื้นที่ดูแล (Areas)', href: '/areas', icon: Compass },
    { label: 'การจัดการโครงการ (Projects)', href: '/projects', icon: FolderKanban },
    { label: 'รอบบินสำรวจและไฟล์โดรน', href: '/surveys', icon: Layers },
    { label: 'วิเคราะห์การเปลี่ยนแปลง & ปริมาตร', href: '/analysis', icon: TrendingDown },
    { label: 'รายงานสรุป (Reports)', href: '/reports', icon: FileCheck },
    { label: 'บันทึกความปลอดภัย (Audit)', href: '/audit', icon: ShieldAlert },
    { label: 'ผู้ดูแลระบบ (Admin)', href: '/admin', icon: Sliders },
  ];

  return (
    <aside className="w-64 bg-navy-900/90 border-r border-slate-800 flex flex-col justify-between h-[calc(100vh-3.5rem)] select-none text-slate-300">
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Navigation Sections */}
        <div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">
            เมนูหลัก (Navigation)
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Managed Areas Quick Switcher */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              พื้นที่ในการดูแล ({areas.length})
            </span>
            {onOpenCreateArea && (
              <button
                onClick={onOpenCreateArea}
                title="เพิ่มพื้นที่ใหม่ (Add Area)"
                className="text-cyan-400 hover:text-cyan-300 p-0.5 rounded transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {areas.map((area) => {
              const isSelected = area.id === selectedAreaId;
              return (
                <div
                  key={area.id}
                  onClick={() => onSelectArea && onSelectArea(area.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-glow-cyan'
                      : 'bg-navy-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-200 line-clamp-1">{area.name}</div>
                  <div className="flex items-center justify-between mt-1 text-[11px]">
                    <span className="text-cyan-400 font-mono">{formatAreaThai(area.areaSqm)}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                        area.status === 'monitoring'
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {area.status === 'monitoring' ? 'เฝ้าระวัง' : 'ปกติ'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer System Status Badge */}
      <div className="p-3 border-t border-slate-800/80 bg-navy-950/40 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>PostGIS & Engine พร้อมใช้งาน</span>
        </div>
        <span className="font-mono text-slate-500">v1.0.0</span>
      </div>
    </aside>
  );
}
