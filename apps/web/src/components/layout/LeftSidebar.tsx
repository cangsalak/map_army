'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  MapPin,
  Bookmark,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Sliders,
  PlusCircle,
  Search,
  Building2,
  Anchor,
  Pickaxe,
  Mountain,
  Globe2,
  CheckCircle2,
  AlertCircle,
  Compass,
  Menu,
  Activity,
  Map,
  TrendingDown,
  FileCheck,
  ShieldAlert,
  Plane,
} from 'lucide-react';
import { formatAreaThai } from '@geomonitor/shared';
import { apiFetch } from '@/lib/api';
import { AreaFeature, LayerSettings } from '../map/CesiumMap';
import { parseCoordinateString } from '@/lib/gis-engine';

interface LeftSidebarProps {
  areas?: AreaFeature[];
  selectedAreaId?: string | null;
  onSelectArea?: (id: string) => void;
  onSelectSavedView?: (viewKey: string) => void;
  onOpenCreateArea?: () => void;
  defaultCollapsed?: boolean;
  layerSettings?: LayerSettings;
  onUpdateLayerSettings?: (settings: Partial<LayerSettings>) => void;
  onSearchCoordinates?: (coords: { lat: number; lon: number }) => void;
}

export default function LeftSidebar({
  areas = [],
  selectedAreaId,
  onSelectArea,
  onSelectSavedView,
  onOpenCreateArea,
  defaultCollapsed = false,
  layerSettings = {
    orthoVisible: true,
    orthoOpacity: 100,
    dsmVisible: true,
    dsmOpacity: 80,
    meshVisible: true,
    meshOpacity: 90,
  },
  onUpdateLayerSettings,
  onSearchCoordinates,
}: LeftSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [activeTab, setActiveTab] = useState<'menu' | 'areas' | 'projects' | 'savedViews' | 'layers'>('areas');
  const [projects, setProjects] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Active saved view key
  const [activeSavedView, setActiveSavedView] = useState<string | null>(null);

  // Parse search query for coordinates
  const parsedCoords = useMemo(() => {
    return parseCoordinateString(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await apiFetch<any[]>('/projects');
        setProjects(Array.isArray(res) ? res : []);
      } catch (err) {
        // Silently fallback
      }
    }
    loadProjects();
  }, []);

  // Filtered areas based on search query
  const filteredAreas = useMemo(() => {
    if (!searchQuery.trim()) return areas;
    const q = searchQuery.toLowerCase();
    return areas.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.status && a.status.toLowerCase().includes(q))
    );
  }, [areas, searchQuery]);

  // Real saved camera views supported by CesiumMap
  const savedViews = [
    {
      id: 'lng-terminal',
      title: 'สถานี LNG มาบตาพุด',
      description: 'มุมมองระดับสูง 1,800m เน้นโครงสร้างคลังก๊าซและสะพานเทียบเรือ',
      icon: Anchor,
      tag: 'โครงสร้างพื้นฐาน',
    },
    {
      id: 'cut-basin',
      title: 'แอ่งขุดและปรับระดับดิน (Cut Basin)',
      description: 'มุมมองเฉียง 45° ระดับ 1,200m ส่องพื้นที่ขุดดินและบ่อพักน้ำ',
      icon: Pickaxe,
      tag: 'วิเคราะห์ Cut',
    },
    {
      id: 'reclamation-fill',
      title: 'พื้นที่ถมทะเลส่วนขยาย (Reclamation)',
      description: 'มุมมองเฉียง 40° ระดับ 1,400m ตรวจสอบการถมหินและแนวคันดิน',
      icon: Mountain,
      tag: 'วิเคราะห์ Fill',
    },
    {
      id: 'overview-3d',
      title: 'ภาพรวม 3 มิติทั้งโครงการ (Overview)',
      description: 'มุมมองกว้างระดับ 4,200m ครอบคลุมพื้นที่นิคมอุตสาหกรรมทั้งหมด',
      icon: Globe2,
      tag: 'ภาพรวม 3D',
    },
  ];

  const handleSelectView = (viewId: string) => {
    setActiveSavedView(viewId);
    if (onSelectSavedView) {
      onSelectSavedView(viewId);
    }
  };

  // If sidebar is collapsed, display a compact vertical dock
  if (isCollapsed) {
    return (
      <aside
        className="w-14 bg-[#101A2D]/95 border-r border-[rgba(148,163,184,0.20)] flex flex-col items-center py-2 justify-between h-[calc(100vh-4rem)] select-none z-20 backdrop-blur-md transition-all duration-200 shadow-xl"
        aria-label="แถบควบคุมด้านซ้ายแบบย่อ"
      >
        <div className="flex flex-col items-center gap-2 w-full">
          {/* Expand Button (44x44px target) */}
          <button
            onClick={() => setIsCollapsed(false)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#162238] text-[#06B6D4] hover:text-white hover:bg-[#1C2940] border border-[rgba(148,163,184,0.20)] shadow-sm focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none transition-all"
            title="ขยายแถบเครื่องมือด้านซ้าย"
            aria-label="ขยายแถบเครื่องมือด้านซ้าย"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="w-8 h-[1px] bg-[rgba(148,163,184,0.20)] my-1" />

          {/* Tab 0: System Navigation Menu */}
          <button
            onClick={() => {
              setActiveTab('menu');
              setIsCollapsed(false);
            }}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
              activeTab === 'menu'
                ? 'bg-[#06B6D4]/20 text-[#22D3EE] border border-[#06B6D4]/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#162238]'
            }`}
            title="เมนูระบบหลัก (Main Navigation)"
            aria-label="เมนูระบบหลัก"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Tab 1: Areas */}
          <button
            onClick={() => {
              setActiveTab('areas');
              setIsCollapsed(false);
            }}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
              activeTab === 'areas'
                ? 'bg-[#06B6D4]/20 text-[#22D3EE] border border-[#06B6D4]/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#162238]'
            }`}
            title="พื้นที่ในการดูแล (Areas)"
            aria-label="พื้นที่ในการดูแล"
          >
            <MapPin className="w-5 h-5" />
          </button>

          {/* Tab 2: Projects */}
          <button
            onClick={() => {
              setActiveTab('projects');
              setIsCollapsed(false);
            }}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
              activeTab === 'projects'
                ? 'bg-[#06B6D4]/20 text-[#22D3EE] border border-[#06B6D4]/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#162238]'
            }`}
            title="โฟลเดอร์โครงการ (Projects)"
            aria-label="โฟลเดอร์โครงการ"
          >
            <FolderKanban className="w-5 h-5" />
          </button>

          {/* Tab 3: Saved Views */}
          <button
            onClick={() => {
              setActiveTab('savedViews');
              setIsCollapsed(false);
            }}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
              activeTab === 'savedViews'
                ? 'bg-[#06B6D4]/20 text-[#22D3EE] border border-[#06B6D4]/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#162238]'
            }`}
            title="มุมมองกล้อง 3D ที่บันทึกไว้ (Saved Views)"
            aria-label="มุมมองกล้อง 3D ที่บันทึกไว้"
          >
            <Bookmark className="w-5 h-5" />
          </button>

          {/* Tab 4: Layers */}
          <button
            onClick={() => {
              setActiveTab('layers');
              setIsCollapsed(false);
            }}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
              activeTab === 'layers'
                ? 'bg-[#06B6D4]/20 text-[#22D3EE] border border-[#06B6D4]/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#162238]'
            }`}
            title="การจัดการเลเยอร์ (Layers)"
            aria-label="การจัดการเลเยอร์"
          >
            <Layers className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom indicator */}
        <div className="w-8 h-[2px] bg-[#06B6D4]/40 rounded-full mb-1" />
      </aside>
    );
  }

  return (
    <aside
      className="w-80 bg-[#101A2D]/95 border-r border-[rgba(148,163,184,0.20)] flex flex-col h-[calc(100vh-4rem)] select-none text-[#CBD5E1] z-20 backdrop-blur-md shadow-2xl transition-all duration-200"
      aria-label="แผงข้อมูลเชิงพื้นที่ด้านซ้าย"
    >
      {/* Header with Title and Collapse Button (44x44px target) */}
      <div className="px-3 py-2.5 border-b border-[rgba(148,163,184,0.15)] bg-[#162238]/60 flex items-center justify-between">
        <span className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[#06B6D4]" />
          <span>การจัดการข้อมูลเชิงพื้นที่</span>
        </span>
        <button
          onClick={() => setIsCollapsed(true)}
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1C2940] border border-transparent hover:border-[rgba(148,163,184,0.20)] focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none transition-all"
          title="ยุบแถบด้านซ้ายเพื่อขยายพื้นที่แผนที่ 3D"
          aria-label="ยุบแถบด้านซ้าย"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Tab Switcher (min 44px height buttons) */}
      <div className="grid grid-cols-5 border-b border-[rgba(148,163,184,0.15)] bg-[#080F20]/50 p-1.5 gap-1 text-xs font-medium">
        <button
          onClick={() => setActiveTab('menu')}
          title="เมนูระบบหลัก (System Navigation)"
          className={`min-h-[44px] py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
            activeTab === 'menu'
              ? 'bg-[#06B6D4]/20 text-[#22D3EE] font-bold border border-[#06B6D4]/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
              : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#162238]'
          }`}
          aria-selected={activeTab === 'menu'}
        >
          <Menu className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">เมนู</span>
        </button>

        <button
          onClick={() => setActiveTab('areas')}
          title="พื้นที่ในการดูแล (Managed Areas)"
          className={`min-h-[44px] py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
            activeTab === 'areas'
              ? 'bg-[#06B6D4]/20 text-[#22D3EE] font-bold border border-[#06B6D4]/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
              : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#162238]'
          }`}
          aria-selected={activeTab === 'areas'}
        >
          <MapPin className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">พื้นที่</span>
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          title="โฟลเดอร์โครงการ (Project Folders)"
          className={`min-h-[44px] py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
            activeTab === 'projects'
              ? 'bg-[#06B6D4]/20 text-[#22D3EE] font-bold border border-[#06B6D4]/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
              : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#162238]'
          }`}
          aria-selected={activeTab === 'projects'}
        >
          <FolderKanban className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">โครงการ</span>
        </button>

        <button
          onClick={() => setActiveTab('savedViews')}
          title="มุมมองกล้อง 3D ที่บันทึกไว้ (Saved Views)"
          className={`min-h-[44px] py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
            activeTab === 'savedViews'
              ? 'bg-[#06B6D4]/20 text-[#22D3EE] font-bold border border-[#06B6D4]/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
              : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#162238]'
          }`}
          aria-selected={activeTab === 'savedViews'}
        >
          <Bookmark className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">มุมมอง</span>
        </button>

        <button
          onClick={() => setActiveTab('layers')}
          title="การจัดการเลเยอร์ (Layer Navigation)"
          className={`min-h-[44px] py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
            activeTab === 'layers'
              ? 'bg-[#06B6D4]/20 text-[#22D3EE] font-bold border border-[#06B6D4]/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
              : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#162238]'
          }`}
          aria-selected={activeTab === 'layers'}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">เลเยอร์</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Tab 0: System Navigation Menu */}
        {activeTab === 'menu' && (
          <div className="space-y-3">
            <div className="px-1 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
              เมนูระบบหลัก (Main Navigation)
            </div>
            <div className="space-y-1">
              {[
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
              ].map((item) => {
                const Icon = item.icon;
                const isCurrent = item.href === '/';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-3 transition-colors ${
                      isCurrent
                        ? 'bg-[#06B6D4] text-[#080F20] font-bold shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'text-[#CBD5E1] hover:text-white hover:bg-[#162238]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isCurrent ? 'text-[#080F20]' : 'text-[#06B6D4]'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 1: Managed Areas */}
        {activeTab === 'areas' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                พื้นที่ในการดูแล ({filteredAreas.length}/{areas.length})
              </span>
              {onOpenCreateArea && (
                <button
                  onClick={onOpenCreateArea}
                  title="สร้างพื้นที่ใหม่"
                  className="min-h-[40px] px-2.5 py-1 bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 text-[#22D3EE] font-semibold rounded-lg text-xs border border-[#06B6D4]/40 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#22D3EE] transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>เพิ่มพื้นที่</span>
                </button>
              )}
            </div>

            {/* Area Search Input (min 44px target) */}
            {areas.length > 0 && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3.5 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อพื้นที่ หรือพิมพ์พิกัด 12.675, 101.145..."
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-[#162238] border border-[rgba(148,163,184,0.20)] rounded-lg text-xs text-[#F1F5F9] placeholder-[#94A3B8] outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]"
                    aria-label="ค้นหาพื้นที่หรือพิกัด"
                  />
                </div>

                {/* Parsed Coordinate Quick Fly-To Button */}
                {parsedCoords && parsedCoords.isValid && (
                  <button
                    onClick={() => {
                      if (onSearchCoordinates) {
                        onSearchCoordinates({ lat: parsedCoords.lat, lon: parsedCoords.lon });
                      }
                    }}
                    className="w-full min-h-[44px] p-2 bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 border border-[#06B6D4] rounded-xl flex items-center justify-between text-xs text-[#22D3EE] font-mono transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)] animate-in fade-in"
                    title="บินไปยังพิกัดเป้าหมายทันที"
                  >
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#06B6D4] animate-spin" />
                      <span className="font-sans font-bold">บินไปยังพิกัด:</span>
                    </div>
                    <span className="font-bold">
                      {parsedCoords.lat.toFixed(5)}°N, {parsedCoords.lon.toFixed(5)}°E
                    </span>
                  </button>
                )}
              </div>
            )}

            {areas.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-[rgba(148,163,184,0.25)] text-center space-y-3 bg-[#162238]/40">
                <div className="w-10 h-10 rounded-full bg-[#06B6D4]/10 text-[#06B6D4] flex items-center justify-center mx-auto">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#F1F5F9]">ยังไม่มีพื้นที่ในการดูแล</div>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    เริ่มต้นกำหนดขอบเขตพื้นที่เพื่อเริ่มตรวจจับความเปลี่ยนแปลง
                  </p>
                </div>
                {onOpenCreateArea && (
                  <button
                    onClick={onOpenCreateArea}
                    className="w-full min-h-[44px] py-2 px-3 bg-[#06B6D4] hover:bg-[#22D3EE] text-[#080F20] font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-md focus-visible:ring-2 focus-visible:ring-[#22D3EE]"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>สร้างพื้นที่ดูแลใหม่</span>
                  </button>
                )}
              </div>
            ) : filteredAreas.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#94A3B8] bg-[#162238]/30 rounded-xl border border-[rgba(148,163,184,0.15)]">
                ไม่พบพื้นที่ที่ตรงกับคำค้นหา &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAreas.map((area) => {
                  const isSelected = area.id === selectedAreaId;
                  return (
                    <div
                      key={area.id}
                      onClick={() => onSelectArea && onSelectArea(area.id)}
                      className={`min-h-[56px] p-3 rounded-xl border text-xs cursor-pointer transition-all space-y-1.5 focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
                        isSelected
                          ? 'bg-[#1C2940] border-[#06B6D4] text-[#F1F5F9] shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-1 ring-[#06B6D4]'
                          : 'bg-[#162238]/80 border-[rgba(148,163,184,0.15)] hover:border-[#06B6D4]/50 hover:bg-[#162238] text-[#CBD5E1]'
                      }`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          if (onSelectArea) onSelectArea(area.id);
                        }
                      }}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#F1F5F9] line-clamp-1">{area.name}</span>
                        <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-[#06B6D4]' : 'text-[#94A3B8]'}`} />
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#06B6D4] font-semibold">{formatAreaThai(area.areaSqm)}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            area.status === 'monitoring'
                              ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                              : 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                          }`}
                        >
                          {area.status === 'monitoring' ? 'เฝ้าระวัง' : 'ปกติ'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Project Hierarchy */}
        {activeTab === 'projects' && (
          <div className="space-y-3 text-xs">
            <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider px-1">
              โครงสร้างโฟลเดอร์โครงการ (Projects)
            </div>

            {projects.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-[rgba(148,163,184,0.25)] text-center space-y-3 bg-[#162238]/40">
                <FolderKanban className="w-8 h-8 text-[#94A3B8] mx-auto" />
                <div className="text-sm font-semibold text-[#F1F5F9]">ยังไม่มีโครงการในระบบ</div>
                <Link
                  href="/projects"
                  className="inline-flex items-center justify-center min-h-[44px] w-full px-3 bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 border border-[#06B6D4]/40 rounded-lg text-[#22D3EE] text-xs font-bold transition-all"
                >
                  + สร้างโครงการใหม่
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="bg-[#162238]/80 border border-[rgba(148,163,184,0.15)] rounded-xl p-3 space-y-1.5 hover:border-[#06B6D4]/40 transition-colors"
                  >
                    <div className="font-bold text-sm text-[#F1F5F9] flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-[#06B6D4] shrink-0" />
                      <span className="line-clamp-1">{proj.name}</span>
                    </div>
                    {proj.description && (
                      <p className="text-xs text-[#94A3B8] pl-6 line-clamp-2">{proj.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/projects"
              className="min-h-[44px] flex items-center justify-center text-center py-2 px-3 bg-[#162238] border border-[#06B6D4]/30 hover:border-[#06B6D4] rounded-lg text-[#06B6D4] hover:text-white text-xs font-bold transition-all shadow-sm"
            >
              จัดการโครงการทั้งหมด (Manage Projects) ➔
            </Link>
          </div>
        )}

        {/* Tab 3: Saved Views / Camera Bookmarks */}
        {activeTab === 'savedViews' && (
          <div className="space-y-3 text-xs">
            <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider px-1">
              มุมมองกล้อง 3D ที่บันทึกไว้ ({savedViews.length})
            </div>

            <div className="space-y-2">
              {savedViews.map((view) => {
                const Icon = view.icon;
                const isCurrent = activeSavedView === view.id;
                return (
                  <div
                    key={view.id}
                    onClick={() => handleSelectView(view.id)}
                    className={`min-h-[56px] p-3 rounded-xl border cursor-pointer transition-all space-y-1.5 focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:outline-none ${
                      isCurrent
                        ? 'bg-[#1C2940] border-[#06B6D4] text-[#F1F5F9] shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                        : 'bg-[#162238]/80 border-[rgba(148,163,184,0.15)] hover:border-[#06B6D4]/50 hover:bg-[#162238] text-[#CBD5E1]'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleSelectView(view.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm text-[#F1F5F9] flex items-center gap-2">
                        <Icon className="w-4 h-4 text-[#06B6D4] shrink-0" />
                        <span>{view.title}</span>
                      </div>
                      <span className="text-[10px] bg-[#101A2D] text-[#22D3EE] px-1.5 py-0.5 rounded border border-[rgba(148,163,184,0.2)] font-mono">
                        {view.tag}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8] pl-6 leading-relaxed">{view.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Layer Navigation & Opacity */}
        {activeTab === 'layers' && (
          <div className="space-y-3 text-xs">
            <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider px-1">
              ควบคุมการแสดงผลและระดับความทึบแสงของเลเยอร์
            </div>

            {/* Layer 1: Orthomosaic */}
            <div className="p-3 bg-[#162238]/80 border border-[rgba(148,163,184,0.20)] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (onUpdateLayerSettings) {
                        onUpdateLayerSettings({ orthoVisible: !(layerSettings.orthoVisible ?? true) });
                      }
                    }}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-[#1C2940] text-[#06B6D4] hover:text-white"
                    title={(layerSettings.orthoVisible ?? true) ? 'ซ่อนเลเยอร์' : 'แสดงเลเยอร์'}
                    aria-label="สลับการแสดงผลภาพถ่ายออร์โธโมเสก"
                  >
                    {(layerSettings.orthoVisible ?? true) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-[#94A3B8]" />}
                  </button>
                  <span className="font-semibold text-sm text-[#F1F5F9]">ภาพถ่ายออร์โธโมเสก (Orthomosaic)</span>
                </div>
                <span className="text-xs font-mono text-[#06B6D4] font-bold">
                  {(layerSettings.orthoVisible ?? true) ? `${layerSettings.orthoOpacity ?? 100}%` : 'ซ่อน'}
                </span>
              </div>
              {(layerSettings.orthoVisible ?? true) && (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={layerSettings.orthoOpacity ?? 100}
                  onChange={(e) => {
                    if (onUpdateLayerSettings) {
                      onUpdateLayerSettings({ orthoOpacity: Number(e.target.value) });
                    }
                  }}
                  className="w-full h-2 bg-[#1C2940] rounded-lg appearance-none cursor-pointer accent-[#06B6D4]"
                  aria-label="ระดับความโปร่งแสงภาพถ่ายออร์โธโมเสก"
                />
              )}
            </div>

            {/* Layer 2: DSM Elevation */}
            <div className="p-3 bg-[#162238]/80 border border-[rgba(148,163,184,0.20)] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (onUpdateLayerSettings) {
                        onUpdateLayerSettings({ dsmVisible: !(layerSettings.dsmVisible ?? true) });
                      }
                    }}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-[#1C2940] text-[#06B6D4] hover:text-white"
                    title={(layerSettings.dsmVisible ?? true) ? 'ซ่อนเลเยอร์' : 'แสดงเลเยอร์'}
                    aria-label="สลับการแสดงผลระดับความสูงพื้นผิว DSM"
                  >
                    {(layerSettings.dsmVisible ?? true) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-[#94A3B8]" />}
                  </button>
                  <span className="font-semibold text-sm text-[#F1F5F9]">ระดับความสูงพื้นผิว (DSM)</span>
                </div>
                <span className="text-xs font-mono text-[#06B6D4] font-bold">
                  {(layerSettings.dsmVisible ?? true) ? `${layerSettings.dsmOpacity ?? 80}%` : 'ซ่อน'}
                </span>
              </div>
              {(layerSettings.dsmVisible ?? true) && (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={layerSettings.dsmOpacity ?? 80}
                  onChange={(e) => {
                    if (onUpdateLayerSettings) {
                      onUpdateLayerSettings({ dsmOpacity: Number(e.target.value) });
                    }
                  }}
                  className="w-full h-2 bg-[#1C2940] rounded-lg appearance-none cursor-pointer accent-[#06B6D4]"
                  aria-label="ระดับความโปร่งแสงระดับความสูง DSM"
                />
              )}
            </div>

            {/* Layer 3: 3D Tiles Mesh */}
            <div className="p-3 bg-[#162238]/80 border border-[rgba(148,163,184,0.20)] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (onUpdateLayerSettings) {
                        onUpdateLayerSettings({ meshVisible: !(layerSettings.meshVisible ?? true) });
                      }
                    }}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-[#1C2940] text-[#06B6D4] hover:text-white"
                    title={(layerSettings.meshVisible ?? true) ? 'ซ่อนเลเยอร์' : 'แสดงเลเยอร์'}
                    aria-label="สลับการแสดงผลโมเดล 3D Tiles"
                  >
                    {(layerSettings.meshVisible ?? true) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-[#94A3B8]" />}
                  </button>
                  <span className="font-semibold text-sm text-[#F1F5F9]">โมเดลสิ่งปลูกสร้าง (3D Tiles)</span>
                </div>
                <span className="text-xs font-mono text-[#06B6D4] font-bold">
                  {(layerSettings.meshVisible ?? true) ? `${layerSettings.meshOpacity ?? 90}%` : 'ซ่อน'}
                </span>
              </div>
              {(layerSettings.meshVisible ?? true) && (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={layerSettings.meshOpacity ?? 90}
                  onChange={(e) => {
                    if (onUpdateLayerSettings) {
                      onUpdateLayerSettings({ meshOpacity: Number(e.target.value) });
                    }
                  }}
                  className="w-full h-2 bg-[#1C2940] rounded-lg appearance-none cursor-pointer accent-[#06B6D4]"
                  aria-label="ระดับความโปร่งแสงโมเดล 3D Tiles"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Spatial Coordinate Reference Status */}
      <div className="p-3 border-t border-[rgba(148,163,184,0.20)] bg-[#101A2D] text-xs text-[#94A3B8] flex items-center justify-between">
        <span className="font-mono text-[#94A3B8]">CRS: EPSG:4326</span>
        <span className="text-[#06B6D4] font-mono font-bold text-[11px]">WGS84 / UTM 47N</span>
      </div>
    </aside>
  );
}

