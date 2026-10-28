'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  Compass,
  Layers,
  Bell,
  User as UserIcon,
  Activity,
  Sliders,
  LogOut,
  FolderKanban,
  MapPin,
  TrendingDown,
  FileCheck,
  ShieldAlert,
  Globe,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Menu,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface NavbarProps {
  areas?: Array<{ id: string; name: string }>;
  selectedAreaId?: string | null;
  onSelectArea?: (id: string) => void;
  onOpenNotifications?: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'info' | 'warning' | 'success';
  read: boolean;
}

export default function Navbar({
  areas = [],
  selectedAreaId,
  onSelectArea,
  onOpenNotifications,
}: NavbarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  // Collapsed and Drawer states
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'ตรวจพบการเปลี่ยนแปลงพื้นผิว',
      desc: 'พบการขุดดินในพื้นที่มาบตาพุด โซน B (ปริมาตร Cut +1,240 m³)',
      time: '10 นาทีที่แล้ว',
      type: 'warning',
      read: false,
    },
    {
      id: '2',
      title: 'ประมวลผลโดรนเสร็จสิ้น',
      desc: 'Orthophoto & DSM สำหรับเที่ยวบิน SV-2026-03 เสร็จสมบูรณ์',
      time: '35 นาทีที่แล้ว',
      type: 'success',
      read: false,
    },
    {
      id: '3',
      title: 'การเชื่อมต่อระบบ PostGIS ปลอดภัย',
      desc: 'Spatial Indexing และ CRS EPSG:32647 ทำงานปกติ',
      time: '1 ชั่วโมงที่แล้ว',
      type: 'info',
      read: true,
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Load Projects from real API
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await apiFetch<any[]>('/projects');
        if (Array.isArray(res) && res.length > 0) {
          setProjects(res);
          setSelectedProjectId(res[0].id);
        }
      } catch (err) {
        // Silently fallback if unauthenticated or offline
      }
    }
    loadProjects();
  }, []);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifPopoverOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsNotifPopoverOpen(false);
        setIsMobileDrawerOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <>
      {/* 1. Collapsed Floating Pill Bar (When Navbar is collapsed by user) */}
      {isNavbarCollapsed ? (
        <div className="fixed top-3 left-4 z-50 flex items-center gap-2 bg-[#101A2D]/90 border border-[rgba(148,163,184,0.30)] rounded-full px-3 py-1.5 shadow-2xl backdrop-blur-md select-none animate-in fade-in duration-200">
          <Link
            href="/"
            className="flex items-center gap-2 pr-1 hover:opacity-80"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#3B82F6] flex items-center justify-center">
              <Compass className="w-4 h-4 text-[#080F20]" />
            </div>
            <span className="font-bold text-xs text-white">GeoMonitor <span className="text-[#06B6D4]">3D</span></span>
          </Link>

          {/* Expand Navbar Button */}
          <button
            onClick={() => setIsNavbarCollapsed(false)}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full text-[#06B6D4] hover:bg-[#162238] border border-[#06B6D4]/30 hover:border-[#06B6D4] transition-all"
            title="ขยาย Navbar (แสดงแถบเมนูเต็ม)"
            aria-label="ขยายแถบเมนู"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* 2. Full Expanded Navbar */
        <header
          className="h-16 bg-[#101A2D]/95 border-b border-[rgba(148,163,184,0.20)] px-3 lg:px-6 flex items-center justify-between z-40 select-none backdrop-blur-md shadow-lg transition-all"
          role="banner"
        >
          {/* Brand & Project Selector */}
          <div className="flex items-center gap-3 lg:gap-4">
            {/* Mobile Drawer Hamburger (Min 44x44px target) */}
            <button
              onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
              className="xl:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-[#162238] border border-[rgba(148,163,184,0.20)] focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none transition-colors"
              aria-label="เปิดเมนูการนำทาง"
              aria-expanded={isMobileDrawerOpen}
            >
              {isMobileDrawerOpen ? <X className="w-5 h-5 text-[#06B6D4]" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Brand Logo & Name */}
            <Link
              href="/"
              className="flex items-center gap-2.5 group flex-shrink-0 focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none rounded-lg p-1"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#3B82F6] flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.35)] group-hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] transition-all duration-300">
                <Compass className="w-5 h-5 text-[#080F20] group-hover:rotate-45 transition-transform duration-300" />
              </div>
              <div>
                <div className="font-bold text-base tracking-wide flex items-center gap-1.5 text-[#F1F5F9]">
                  GeoMonitor <span className="text-[#06B6D4]">3D</span>
                </div>
                <div className="text-[11px] text-[#94A3B8] font-normal tracking-tight hidden sm:block -mt-0.5">
                  Enterprise Geospatial Command Center
                </div>
              </div>
            </Link>

            {/* Project Selector (Desktop) */}
            <div className="hidden 2xl:flex items-center gap-2 bg-[#162238] border border-[rgba(148,163,184,0.20)] rounded-lg px-3 py-1.5 text-xs shadow-inner">
              <FolderKanban className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-[#94A3B8] text-xs font-medium">โครงการ:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-transparent text-[#F1F5F9] outline-none cursor-pointer font-medium text-xs max-w-[190px] truncate focus-visible:ring-1 focus-visible:ring-[#22D3EE] rounded"
                aria-label="เลือกโครงการ"
              >
                {projects.length > 0 ? (
                  projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#101A2D] text-[#F1F5F9]">
                      {p.name}
                    </option>
                  ))
                ) : (
                  <option value="" className="bg-[#101A2D] text-[#CBD5E1]">
                    โครงการหลัก (Default)
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* Center Space: Keep clean & uncluttered as requested by user */}
          <div className="flex-1" />

        {/* Actions & User Profile */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Notifications Popover */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setIsNotifPopoverOpen(!isNotifPopoverOpen);
                if (onOpenNotifications) onOpenNotifications();
              }}
              title="การแจ้งเตือนงานและการเปลี่ยนแปลง"
              className="relative min-w-[44px] min-h-[44px] flex items-center justify-center text-[#CBD5E1] hover:text-white bg-[#162238] border border-[rgba(148,163,184,0.20)] rounded-lg hover:border-[#06B6D4]/50 focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none transition-all"
              aria-label={`การแจ้งเตือน มี ${unreadCount} รายการใหม่`}
              aria-expanded={isNotifPopoverOpen}
            >
              <Bell className="w-4 h-4 text-[#CBD5E1]" />
              {unreadCount > 0 && (
                <>
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#06B6D4] animate-ping" />
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#06B6D4]" />
                </>
              )}
            </button>

            {/* Notification Popover Panel */}
            {isNotifPopoverOpen && (
              <div
                className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#101A2D] border border-[rgba(148,163,184,0.25)] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                role="dialog"
                aria-label="กล่องแจ้งเตือน"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(148,163,184,0.15)]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#F1F5F9]">การแจ้งเตือนระบบ</span>
                    {unreadCount > 0 && (
                      <span className="bg-[#06B6D4]/20 text-[#22D3EE] text-[11px] font-bold px-2 py-0.5 rounded-full border border-[#06B6D4]/30">
                        ใหม่ {unreadCount}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-[#06B6D4] hover:text-[#22D3EE] hover:underline"
                    >
                      อ่านทั้งหมดแล้ว
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[rgba(148,163,184,0.1)] py-1">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg transition-colors ${
                        item.read ? 'opacity-70 hover:bg-[#162238]/50' : 'bg-[#162238]/80 hover:bg-[#162238]'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {item.type === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                        ) : item.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-[#F1F5F9]">{item.title}</div>
                          <div className="text-[12px] text-[#CBD5E1] mt-0.5">{item.desc}</div>
                          <div className="text-[11px] text-[#94A3B8] mt-1 font-mono">{item.time}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-2 border-t border-[rgba(148,163,184,0.15)] flex justify-between items-center text-xs">
                  <Link
                    href="/audit"
                    onClick={() => setIsNotifPopoverOpen(false)}
                    className="text-[#06B6D4] hover:text-[#22D3EE] flex items-center gap-1 font-medium"
                  >
                    ดูประวัติ Audit ทั้งหมด <ExternalLink className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={() => setIsNotifPopoverOpen(false)}
                    className="text-[#94A3B8] hover:text-white"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Role Display */}
          <div className="flex items-center gap-2 pl-2 border-l border-[rgba(148,163,184,0.20)]">
            {user ? (
              <>
                <div className="text-right hidden md:block">
                  <div className="text-xs font-semibold text-[#F1F5F9]">{user.fullName}</div>
                  <div className="text-[10px] text-[#06B6D4] font-mono uppercase tracking-wider font-bold">
                    {user.role}
                  </div>
                </div>

                <div
                  className="min-w-[40px] min-h-[40px] rounded-full bg-[#1C2940] border border-[#06B6D4]/40 flex items-center justify-center text-[#06B6D4] shadow-md"
                  aria-label={`ผู้ใช้ ${user.fullName} บทบาท ${user.role}`}
                >
                  <UserIcon className="w-4 h-4" />
                </div>

                {/* Logout Button (Min 44x44px touch target) */}
                <button
                  onClick={() => logout()}
                  title="ออกจากระบบ"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#94A3B8] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 rounded-lg focus-visible:ring-2 focus-visible:ring-[#F43F5E] focus-visible:outline-none transition-colors"
                  aria-label="ออกจากระบบ"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>เข้าสู่ระบบ</span>
              </Link>
            )}

            {/* Collapse Navbar Button (User request to collapse / expand navbar) */}
            <button
              onClick={() => setIsNavbarCollapsed(true)}
              title="ยุบ Navbar (เพิ่มพื้นที่แสดงแผนที่เต็มจอ)"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#94A3B8] hover:text-[#06B6D4] hover:bg-[#162238] rounded-lg border border-[rgba(148,163,184,0.15)] focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none transition-colors"
              aria-label="ยุบแถบเมนู"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      )}

      {/* Responsive Navigation Drawer for Tablet / Mobile (< 1280px) */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 xl:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="เมนูระบบแบบเลื่อน"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#080F20]/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-80 max-w-[85vw] bg-[#101A2D] border-r border-[rgba(148,163,184,0.25)] h-full flex flex-col p-4 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(148,163,184,0.20)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#3B82F6] flex items-center justify-center">
                  <Compass className="w-4 h-4 text-[#080F20]" />
                </div>
                <div className="font-bold text-sm text-white">
                  GeoMonitor <span className="text-[#06B6D4]">3D</span>
                </div>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#162238] focus-visible:ring-2 focus-visible:ring-[#22D3EE]"
                aria-label="ปิดเมนู"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Project Selection inside Drawer */}
            <div className="py-3 border-b border-[rgba(148,163,184,0.15)]">
              <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">
                โครงการปัจจุบัน
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-[#162238] text-white border border-[rgba(148,163,184,0.25)] rounded-lg p-2.5 text-xs outline-none"
              >
                {projects.length > 0 ? (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                ) : (
                  <option value="">โครงการหลัก (Default)</option>
                )}
              </select>
            </div>

            {/* Navigation Sections */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4">
              <div>
                <div className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-2 mb-1.5">
                  เมนูระบบทั้งหมด (Navigation)
                </div>
                <div className="space-y-1">
                  {[
                    { label: 'ศูนย์บัญชาการ 3D (Drone & Cut/Fill)', href: '/', icon: Globe },
                    { label: 'แผนที่ปฏิบัติการ (Field Ops)', href: '/operations/map', icon: Activity },
                    { label: 'พื้นที่ดูแล (Areas)', href: '/areas', icon: MapPin },
                    { label: 'โครงการ (Projects)', href: '/projects', icon: FolderKanban },
                    { label: 'ข้อมูลโดรน (Surveys)', href: '/surveys', icon: Layers },
                    { label: 'วิเคราะห์การเปลี่ยนแปลง (Cut/Fill)', href: '/analysis', icon: TrendingDown },
                    { label: 'รายงานและสถิติ (Reports)', href: '/reports', icon: FileCheck },
                    { label: 'บันทึกความปลอดภัย (Audit)', href: '/audit', icon: ShieldAlert },
                    { label: 'ผู้ดูแลระบบ (Admin)', href: '/admin', icon: Sliders },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileDrawerOpen(false)}
                        className={`min-h-[44px] px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                          isActive
                            ? 'bg-[#06B6D4] text-[#080F20] font-bold shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                            : 'text-[#CBD5E1] hover:text-white hover:bg-[#162238]'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#080F20]' : 'text-[#06B6D4]'}`} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Drawer Footer User Info */}
            <div className="pt-3 border-t border-[rgba(148,163,184,0.20)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[#1C2940] border border-[#06B6D4]/40 flex items-center justify-center text-[#06B6D4]">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">{user?.fullName || 'ผู้ดูแลระบบ'}</div>
                  <div className="text-[10px] text-[#06B6D4] font-mono">{user?.role || 'SUPER_ADMIN'}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  logout();
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#94A3B8] hover:text-[#F43F5E]"
                aria-label="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

