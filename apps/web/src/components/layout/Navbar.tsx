'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  Search,
  Bell,
  User as UserIcon,
  LogOut,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronDown,
  Menu,
  X,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ThemeToggle } from '../ui/ThemeToggle';
import { cn } from '../ui/primitives';

interface NavbarProps {
  areas?: Array<{ id: string; name: string }>;
  selectedAreaId?: string | null;
  onSelectArea?: (id: string) => void;
  onOpenNotifications?: () => void;
  onToggleSidebar?: () => void;
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
  onToggleSidebar,
}: NavbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Popover states
  const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'ตรวจพบการเปลี่ยนแปลงพื้นผิว',
      desc: 'พบการขุดดินในพื้นที่มาบตาพุด โซน B (Cut +1,240 m³)',
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
    let mounted = true;
    async function loadProjects() {
      try {
        const res = await apiFetch<any>('/projects');
        if (mounted && res && Array.isArray(res.data)) {
          setProjects(res.data);
          if (res.data.length > 0) {
            setSelectedProjectId(res.data[0].id);
          }
        }
      } catch (err) {
        console.warn('[Navbar] Could not load projects list', err);
      }
    }
    loadProjects();
    return () => {
      mounted = false;
    };
  }, []);

  // Global Keyboard Shortcuts (⌘K for Search, Escape to close popovers)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsNotifPopoverOpen(false);
        setIsUserMenuOpen(false);
        setIsSearchOpen(false);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifPopoverOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase().trim();
    if (q.includes('area') || q.includes('พื้นที่')) {
      router.push('/areas');
    } else if (q.includes('mission') || q.includes('บิน') || q.includes('drone')) {
      router.push('/missions');
    } else if (q.includes('project') || q.includes('โครงการ')) {
      router.push('/projects');
    } else if (q.includes('survey') || q.includes('สำรวจ')) {
      router.push('/surveys');
    } else if (q.includes('cut') || q.includes('fill') || q.includes('วิเคราะห์')) {
      router.push('/analysis');
    } else if (q.includes('report') || q.includes('รายงาน')) {
      router.push('/reports');
    } else if (q.includes('audit') || q.includes('ความปลอดภัย')) {
      router.push('/audit');
    } else {
      router.push(`/areas?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <header
      className="h-16 bg-card border-b border-border px-4 lg:px-6 flex items-center justify-between z-30 select-none shadow-sm transition-colors duration-200 shrink-0"
      role="banner"
    >
      {/* Left: Mobile Toggle & NextAdmin Search Input */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-foreground hover:bg-muted border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-colors cursor-pointer"
            aria-label="เปิดเมนูแถบข้าง"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* NextAdmin Global Search Bar with ⌘K Badge */}
        <form onSubmit={handleSearchSubmit} className="relative w-full flex items-center">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages, missions, areas..."
            className="w-full pl-10 pr-14 py-2 bg-card-secondary hover:bg-muted/50 focus:bg-card border border-border focus:border-primary rounded-xl text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary/20"
          />
          <kbd className="absolute right-3 px-1.5 py-0.5 rounded border border-border bg-card text-[10px] text-muted-foreground font-mono shadow-xs hidden sm:block">
            ⌘ K
          </kbd>
        </form>

        {/* Project Selector (NextAdmin Compact Pill) */}
        {projects.length > 0 && (
          <div className="hidden 2xl:flex items-center gap-1.5 bg-card-secondary border border-border rounded-xl px-2.5 py-1.5 text-xs shrink-0">
            <FolderKanban className="w-3.5 h-3.5 text-primary" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-foreground outline-none cursor-pointer font-medium text-xs max-w-[140px] truncate"
              aria-label="เลือกโครงการ"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-card text-foreground">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Theme Toggle, Notifications Bell, User Profile Pill */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* NextAdmin Theme Switcher (Moon/Sun) */}
        <ThemeToggle />

        {/* NextAdmin Notification Bell with Badge Dot */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setIsNotifPopoverOpen(!isNotifPopoverOpen);
              if (onOpenNotifications) onOpenNotifications();
            }}
            title="การแจ้งเตือนระบบ"
            className="relative min-w-[40px] min-h-[40px] flex items-center justify-center text-foreground bg-card hover:bg-card-secondary border border-border rounded-xl hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-all shadow-sm cursor-pointer"
            aria-label={`การแจ้งเตือน มี ${unreadCount} รายการใหม่`}
            aria-expanded={isNotifPopoverOpen}
          >
            <Bell className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-card" />
            )}
          </button>

          {/* Notifications Popover Menu */}
          {isNotifPopoverOpen && (
            <div
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-foreground"
              role="dialog"
              aria-label="กล่องแจ้งเตือน"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">การแจ้งเตือน</span>
                  {unreadCount > 0 && (
                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/20">
                      ใหม่ {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    อ่านทั้งหมด
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border py-1">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'p-3 rounded-xl transition-colors',
                      item.read ? 'opacity-70 hover:bg-muted/40' : 'bg-muted/30 hover:bg-muted/50 font-medium'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {item.type === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                      ) : item.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="w-4 h-4 text-info shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-foreground">{item.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 font-mono">{item.time}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2 border-t border-border flex justify-between items-center text-xs">
                <Link
                  href="/audit"
                  onClick={() => setIsNotifPopoverOpen(false)}
                  className="text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  ดูบันทึก Audit ทั้งหมด <ExternalLink className="w-3 h-3" />
                </Link>
                <button
                  onClick={() => setIsNotifPopoverOpen(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  ปิด
                </button>
              </div>
            </div>
          )}
        </div>

        {/* NextAdmin User Profile Pill with Avatar & Name */}
        <div className="relative" ref={userMenuRef}>
          {user ? (
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-card-secondary border border-transparent hover:border-border transition-all cursor-pointer group"
              aria-label="เมนูผู้ใช้งาน"
              aria-expanded={isUserMenuOpen}
            >
              {/* Circular User Avatar */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-primary/20">
                {user.fullName ? user.fullName.charAt(0) : 'U'}
              </div>

              <div className="text-left hidden md:block">
                <div className="text-xs font-bold text-foreground line-clamp-1">{user.fullName || 'ผู้ใช้งาน'}</div>
                <div className="text-[10px] text-muted-foreground capitalize font-mono -mt-0.5">{user.role || 'Member'}</div>
              </div>

              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-transform" />
            </button>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm hover:bg-primary-hover"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>เข้าสู่ระบบ</span>
            </Link>
          )}

          {/* User Profile Dropdown Menu */}
          {isUserMenuOpen && user && (
            <div
              className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-foreground"
              role="menu"
            >
              <div className="px-3 py-2 border-b border-border">
                <div className="text-xs font-bold text-foreground">{user.fullName}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{user.email || 'user@geomonitor.io'}</div>
                <div className="text-[10px] text-primary font-bold uppercase mt-1 px-1.5 py-0.5 rounded bg-primary/10 inline-block font-mono">
                  {user.role}
                </div>
              </div>

              <div className="py-1">
                <Link
                  href="/admin"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-muted text-foreground transition-colors"
                >
                  <Sliders className="w-4 h-4 text-muted-foreground" />
                  <span>ตั้งค่าระบบ (Admin)</span>
                </Link>
                <Link
                  href="/audit"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-muted text-foreground transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                  <span>ประวัติความปลอดภัย</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-border">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
