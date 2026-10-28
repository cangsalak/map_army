'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Map,
  Activity,
  Compass,
  Layers,
  TrendingDown,
  FileCheck,
  ShieldAlert,
  PlusCircle,
  FolderKanban,
  Sliders,
  Plane,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { formatAreaThai } from '@geomonitor/shared';
import { AreaFeature } from '../map/CesiumMap';
import { cn } from '../ui/primitives';

interface NavItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  hasDropdown?: boolean;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

interface SidebarProps {
  areas?: AreaFeature[];
  selectedAreaId?: string | null;
  onSelectArea?: (id: string) => void;
  onOpenCreateArea?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export default function Sidebar({
  areas = [],
  selectedAreaId,
  onSelectArea,
  onOpenCreateArea,
  collapsed = false,
  onToggleCollapse,
  className,
}: SidebarProps) {
  const pathname = usePathname();

  const navGroups: NavGroup[] = [
    {
      items: [
        { label: 'ศูนย์บัญชาการ 3D', shortLabel: '3D Globe', href: '/', icon: Map },
        { label: 'Drone Mission Planner', shortLabel: 'Planner', href: '/missions', icon: Plane, hasDropdown: true },
        { label: 'แผนที่ปฏิบัติการ (Field Ops)', shortLabel: 'Ops Map', href: '/operations/map', icon: Activity },
      ],
    },
    {
      title: 'GEOSPATIAL & DATA',
      items: [
        { label: 'พื้นที่ดูแล (Areas)', shortLabel: 'Areas', href: '/areas', icon: Compass, hasDropdown: true },
        { label: 'การจัดการโครงการ (Projects)', shortLabel: 'Projects', href: '/projects', icon: FolderKanban, hasDropdown: true },
        { label: 'รอบบินสำรวจและไฟล์โดรน', shortLabel: 'Surveys', href: '/surveys', icon: Layers },
        { label: 'วิเคราะห์การเปลี่ยนแปลง', shortLabel: 'Analysis', href: '/analysis', icon: TrendingDown, hasDropdown: true },
      ],
    },
    {
      title: 'SYSTEM & AUDIT',
      items: [
        { label: 'รายงานสรุป (Reports)', shortLabel: 'Reports', href: '/reports', icon: FileCheck, hasDropdown: true },
        { label: 'บันทึกความปลอดภัย (Audit)', shortLabel: 'Audit', href: '/audit', icon: ShieldAlert },
        { label: 'ผู้ดูแลระบบ (Admin)', shortLabel: 'Admin', href: '/admin', icon: Sliders },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col justify-between select-none transition-all duration-300 z-40 h-screen shrink-0',
        collapsed ? 'w-20' : 'w-72',
        className
      )}
      aria-label="แถบเมนูหลัก NextAdmin"
    >
      {/* 1. Sidebar Brand Header (NextAdmin Style) */}
      <div className="h-16 border-b border-sidebar-border flex items-center justify-between px-4 shrink-0">
        <Link
          href="/"
          className={cn(
            'flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl',
            collapsed && 'justify-center w-full'
          )}
        >
          {/* NextAdmin Stylized Diamond/Polygon Logo */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-105 transition-transform duration-200">
            <Sparkles className="w-5 h-5 text-white" />
          </div>

          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-tight text-foreground flex items-center gap-1">
                GeoMonitor <span className="text-primary text-xs uppercase px-1.5 py-0.5 rounded-md bg-primary/10 font-bold">3D</span>
              </span>
              <span className="text-[10px] text-sidebar-muted font-normal -mt-0.5 tracking-tight">
                Enterprise NextAdmin GIS
              </span>
            </div>
          )}
        </Link>

        {/* Sidebar Collapse Toggle Button */}
        {!collapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sidebar-muted hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="ย่อแถบเมนู (Collapse Sidebar)"
            aria-label="ย่อแถบเมนู"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Navigation Items List (NextAdmin Style) */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {group.title && !collapsed && (
              <div className="text-[11px] font-bold tracking-wider text-sidebar-muted uppercase px-3 mb-2 font-mono">
                {group.title}
              </div>
            )}
            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group',
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold shadow-sm border border-primary/20'
                        : 'text-sidebar-foreground/80 hover:bg-muted hover:text-foreground',
                      collapsed && 'justify-center px-2 py-3'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
                        isActive ? 'text-primary' : 'text-sidebar-muted group-hover:text-foreground'
                      )}
                    />
                    {!collapsed && (
                      <span className="truncate flex-1">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono font-bold">
                        {item.badge}
                      </span>
                    )}
                    {!collapsed && item.hasDropdown && (
                      <ChevronDown
                        className={cn(
                          'w-3.5 h-3.5 transition-transform duration-200',
                          isActive ? 'text-primary' : 'text-sidebar-muted/70'
                        )}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        {/* Managed Areas Quick Access Cell (NextAdmin Style) */}
        {!collapsed && areas.length > 0 && (
          <div className="pt-3 border-t border-sidebar-border">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[10px] font-bold text-sidebar-muted uppercase tracking-wider font-mono">
                พื้นที่ดูแลด่วน ({areas.length})
              </span>
              {onOpenCreateArea && (
                <button
                  onClick={onOpenCreateArea}
                  title="เพิ่มพื้นที่ใหม่ (Add Area)"
                  className="text-primary hover:opacity-80 p-0.5 rounded transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {areas.slice(0, 4).map((area) => {
                const isSelected = area.id === selectedAreaId;
                return (
                  <button
                    key={area.id}
                    onClick={() => onSelectArea && onSelectArea(area.id)}
                    className={cn(
                      'w-full text-left p-2 rounded-xl border text-xs transition-all cursor-pointer block',
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary font-semibold shadow-sm'
                        : 'bg-card border-border hover:border-primary/40 text-foreground'
                    )}
                  >
                    <div className="font-medium truncate">{area.name}</div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-sidebar-muted font-mono">
                      <span>{formatAreaThai(area.areaSqm)}</span>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                          area.status === 'monitoring'
                            ? 'text-amber-500 bg-amber-500/10'
                            : 'text-emerald-500 bg-emerald-500/10'
                        )}
                      >
                        {area.status === 'monitoring' ? 'เฝ้าระวัง' : 'ปกติ'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom Card / Status Cell (NextAdmin Style "Upgrade to Pro" Card) */}
      <div className="p-3 border-t border-sidebar-border bg-sidebar shrink-0">
        {!collapsed ? (
          <div className="p-3.5 rounded-2xl bg-card-secondary border border-border shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">GeoMonitor Pro</div>
                  <div className="text-[10px] text-sidebar-muted">PostGIS 3.4 • EPSG:32647</div>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Online" />
            </div>

            <div className="text-[11px] text-sidebar-muted leading-relaxed">
              ระบบวิเคราะห์ภาพถ่าย 3 มิติ และตรวจจับความเปลี่ยนแปลงอัตโนมัติ
            </div>

            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="w-full min-h-[32px] py-1.5 px-3 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>ย่อแถบเมนู</span>
              </button>
            )}
          </div>
        ) : (
          onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center py-2.5 rounded-xl text-sidebar-muted hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="ขยายแถบเมนู (Expand Sidebar)"
            >
              <PanelLeft className="w-5 h-5 text-primary" />
            </button>
          )
        )}
      </div>
    </aside>
  );
}
