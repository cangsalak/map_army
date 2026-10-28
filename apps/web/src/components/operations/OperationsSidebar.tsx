'use client';

import React, { useState } from 'react';
import {
  Users,
  MapPin,
  Layers,
  Plus,
  Radio,
  Sliders,
  Eye,
  EyeOff,
  Shield,
  Activity,
  ChevronRight,
  Filter,
  Download,
  Upload,
  ArrowUp,
  ArrowDown,
  Trash2,
  Lock,
  Edit2,
  CheckCircle2,
  Folder,
  Menu,
  Map,
  Compass,
  TrendingDown,
  FileCheck,
  ShieldAlert,
  FolderKanban,
  Maximize2,
  FileCode,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import {
  TeamDTO,
  TeamLocationDTO,
  MapLayerDTO,
  TeamStatus,
} from '@geomonitor/shared';
import { apiFetch } from '@/lib/api';

interface OperationsSidebarProps {
  teams: TeamDTO[];
  locations: TeamLocationDTO[];
  layers: MapLayerDTO[];
  activeLayerId?: string;
  onSelectActiveLayer?: (layerId: string) => void;
  selectedItem?: { type: 'team' | 'location' | 'simulation'; id: string } | null;
  onSelectItem: (item: { type: 'team' | 'location' | 'simulation'; id: string } | null) => void;
  onOpenCreateTeam: () => void;
  onOpenCreateLocation: () => void;
  onOpenCreateLayer: () => void;
  onToggleLayerVisibility: (layerId: string, current: boolean) => void;
  onChangeLayerOpacity: (layerId: string, opacity: number) => void;
  onReorderLayers?: (items: { id: string; orderIndex: number }[]) => void;
  onLayerDeleted?: () => void;
  onLayerRenamed?: () => void;
  onOpenImportKml?: () => void;
  onExportKml?: (layerId: string, layerName: string) => void;
  onExportKmz?: (layerId: string, layerName: string) => void;
  onZoomToLayer?: (layerId: string) => void;
  onConvertToManagedArea?: (layerId: string, layerName: string) => void;
  onImportGeoJson?: (layerId: string) => void;
  onExportGeoJson?: (layerId: string, layerName: string) => void;
  onLocationDeleted?: () => void;
  onTeamDeleted?: () => void;
}

export default function OperationsSidebar({
  teams = [],
  locations = [],
  layers = [],
  activeLayerId,
  onSelectActiveLayer,
  selectedItem,
  onSelectItem,
  onOpenCreateTeam,
  onOpenCreateLocation,
  onOpenCreateLayer,
  onToggleLayerVisibility,
  onChangeLayerOpacity,
  onReorderLayers,
  onLayerDeleted,
  onLayerRenamed,
  onOpenImportKml,
  onExportKml,
  onExportKmz,
  onZoomToLayer,
  onConvertToManagedArea,
  onImportGeoJson,
  onExportGeoJson,
  onLocationDeleted,
  onTeamDeleted,
}: OperationsSidebarProps) {
  const [activeTab, setActiveTab] = useState<'menu' | 'teams' | 'locations' | 'layers'>('layers');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Quick delete team
  const handleDeleteTeam = async (t: TeamDTO, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`คุณต้องการลบชุดปฏิบัติการ "${t.name}" (${t.identifier}) หรือไม่?`)) return;
    try {
      await apiFetch(`/teams/${t.id}`, { method: 'DELETE' });
      if (selectedItem?.type === 'team' && selectedItem.id === t.id) {
        onSelectItem(null);
      }
      if (onTeamDeleted) onTeamDeleted();
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถลบทีมได้');
    }
  };

  // Quick delete location
  const handleDeleteLocation = async (loc: TeamLocationDTO, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`คุณต้องการลบจุดพิกัด/ฐาน "${loc.name}" หรือไม่?`)) return;
    try {
      await apiFetch(`/locations/${loc.id}`, { method: 'DELETE' });
      if (selectedItem?.type === 'location' && selectedItem.id === loc.id) {
        onSelectItem(null);
      }
      if (onLocationDeleted) onLocationDeleted();
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถลบจุดพิกัดได้');
    }
  };

  const filteredTeams = teams.filter((team) => {
    const matchesStatus = statusFilter === 'all' || team.status === statusFilter;
    const matchesSearch =
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.identifier.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredLocations = locations.filter((loc) =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Move layer up/down
  const handleMoveLayer = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= layers.length) return;

    const newLayers = [...layers];
    const [moved] = newLayers.splice(index, 1);
    newLayers.splice(targetIndex, 0, moved);

    const reorderPayload = newLayers.map((l, idx) => ({ id: l.id, orderIndex: idx }));
    try {
      await apiFetch('/layers/reorder', {
        method: 'POST',
        body: JSON.stringify({ items: reorderPayload }),
      });
      if (onReorderLayers) onReorderLayers(reorderPayload);
    } catch (err) {
      console.error('Failed to reorder layers', err);
    }
  };

  // Delete layer with confirmation
  const handleDeleteLayer = async (layer: MapLayerDTO) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบชั้นข้อมูล "${layer.name}" พร้อมรูปแปลงทั้งหมด?`)) return;

    try {
      await apiFetch(`/layers/${layer.id}`, { method: 'DELETE' });
      if (onLayerDeleted) onLayerDeleted();
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถลบชั้นข้อมูลได้');
    }
  };

  // Rename layer
  const handleSaveRename = async (layerId: string) => {
    if (!editingName.trim()) {
      setEditingLayerId(null);
      return;
    }
    try {
      await apiFetch(`/layers/${layerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editingName.trim() }),
      });
      setEditingLayerId(null);
      if (onLayerRenamed) onLayerRenamed();
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถเปลี่ยนชื่อชั้นข้อมูลได้');
    }
  };

  return (
    <aside className="w-80 h-full bg-navy-900/95 border-r border-cyan-500/20 flex flex-col z-20 backdrop-blur-md select-none">
      {/* Sidebar Header & Tabs */}
      <div className="p-3 border-b border-navy-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span className="font-semibold text-sm tracking-wide text-white">
              ศูนย์ปฏิบัติการภาคสนาม
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            {layers.length} ชั้นข้อมูล
          </span>
        </div>

        {/* 4 Tabs */}
        <div className="grid grid-cols-4 gap-1 bg-navy-950 p-1 rounded-lg border border-navy-800">
          <button
            onClick={() => setActiveTab('menu')}
            className={`py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'menu'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="เมนูระบบหลัก (Main Navigation)"
          >
            <Menu className="w-3.5 h-3.5" />
            เมนู
          </button>
          <button
            onClick={() => setActiveTab('layers')}
            className={`py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'layers'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            ชั้นข้อมูล
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'teams'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            ทีม
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className={`py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'locations'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            ฐาน/จุด
          </button>
        </div>
      </div>

      {/* Tab 0: System Navigation Menu */}
      {activeTab === 'menu' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="px-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            เมนูระบบหลัก (Main Navigation)
          </div>
          <div className="space-y-1">
            {[
              { label: 'ศูนย์บัญชาการ 3D (Drone & Cut/Fill)', href: '/', icon: Map },
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
              const isCurrent = item.href === '/operations/map';
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-3 transition-colors ${
                    isCurrent
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : 'text-slate-300 hover:text-white hover:bg-navy-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isCurrent ? 'text-slate-950' : 'text-cyan-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 1: Layers Manager (Main Workspace) */}
      {activeTab === 'layers' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-navy-800 bg-navy-950/40 text-[11px] text-slate-400 flex items-center justify-between">
            <span>คลิกเพื่อเลือก <strong>ชั้นข้อมูลที่ใช้งาน</strong> (Active Layer)</span>
            <span className="text-[10px] text-cyan-400">รูปแปลง: บันทึกลงชั้นนี้</span>
          </div>

          {/* Layer Actions Toolbar: Add Layer & Import KML/KMZ */}
          <div className="p-2 border-b border-navy-800 bg-navy-950/60 flex items-center gap-1.5">
            <button
              onClick={onOpenCreateLayer}
              className="flex-1 min-h-[34px] px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>สร้างชั้นข้อมูล</span>
            </button>

            {onOpenImportKml && (
              <button
                onClick={onOpenImportKml}
                className="flex-1 min-h-[34px] px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="นำเข้าไฟล์ .kml หรือ .kmz จาก Google Earth หรือ GIS"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>Import KML/KMZ</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {layers.map((layer, index) => {
              const isActive = activeLayerId === layer.id;
              const isReadOnly = !layer.isEditable;

              return (
                <div
                  key={layer.id}
                  onClick={() => onSelectActiveLayer && onSelectActiveLayer(layer.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                    isActive
                      ? 'bg-navy-950/90 border-cyan-500 shadow-md shadow-cyan-500/10'
                      : 'bg-navy-950/50 border-navy-800 hover:border-navy-700'
                  }`}
                >
                  {/* Top row: Active indicator, name, count, actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Active Radio Indicator */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectActiveLayer) onSelectActiveLayer(layer.id);
                        }}
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'border-cyan-400 bg-cyan-500/20'
                            : 'border-slate-600 hover:border-slate-400'
                        }`}
                        title={isActive ? 'ชั้นข้อมูลที่กำลังใช้งานอยู่' : 'คลิกเพื่อตั้งเป็นชั้นข้อมูลใช้งาน'}
                      >
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                      </button>

                      {/* Visibility toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLayerVisibility(layer.id, layer.visibility);
                        }}
                        className={`p-1 rounded shrink-0 ${
                          layer.visibility ? 'text-cyan-400 hover:bg-navy-800' : 'text-slate-600'
                        }`}
                        title={layer.visibility ? 'ซ่อนชั้นข้อมูล' : 'แสดงชั้นข้อมูล'}
                      >
                        {layer.visibility ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Name or Rename Input */}
                      {editingLayerId === layer.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingName}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(layer.id);
                            if (e.key === 'Escape') setEditingLayerId(null);
                          }}
                          onBlur={() => handleSaveRename(layer.id)}
                          className="bg-navy-900 border border-cyan-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none w-full"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`text-xs font-semibold truncate ${
                              isActive ? 'text-cyan-300' : 'text-white'
                            }`}
                          >
                            {layer.name}
                          </span>
                          {isReadOnly && (
                            <span title="อ่านอย่างเดียว (Read Only)">
                              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Feature Count & Badges */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-navy-900 text-slate-400 border border-navy-800 font-mono">
                        {layer.featureCount || 0}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/20"
                        style={{ backgroundColor: layer.colorHex || '#00ffff' }}
                      />
                    </div>
                  </div>

                  {/* Middle row: Opacity Slider */}
                  <div
                    className="flex items-center gap-2 text-[10px] text-slate-400 px-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>ความโปร่งแสง:</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={layer.opacity}
                      onChange={(e) => onChangeLayerOpacity(layer.id, parseFloat(e.target.value))}
                      className="flex-1 accent-cyan-400 h-1 bg-navy-800 rounded-lg cursor-pointer"
                    />
                    <span className="w-7 text-right font-mono text-[9px]">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>

                  {/* Bottom row: Tool actions (Reorder, Rename, Export, Import, Delete) */}
                  <div
                    className="flex items-center justify-between pt-1 border-t border-navy-800/80 text-[10px] text-slate-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-0.5">
                      <button
                        disabled={index === 0}
                        onClick={() => handleMoveLayer(index, 'up')}
                        className="p-1 hover:text-white disabled:opacity-20 hover:bg-navy-800 rounded transition-colors"
                        title="เลื่อนขึ้น"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        disabled={index === layers.length - 1}
                        onClick={() => handleMoveLayer(index, 'down')}
                        className="p-1 hover:text-white disabled:opacity-20 hover:bg-navy-800 rounded transition-colors"
                        title="เลื่อนลง"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {onZoomToLayer && (
                        <button
                          onClick={() => onZoomToLayer(layer.id)}
                          className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-navy-800 rounded transition-colors"
                          title="ซูมไปยังชั้นข้อมูล (Zoom to Layer)"
                        >
                          <Maximize2 className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingLayerId(layer.id);
                          setEditingName(layer.name);
                        }}
                        className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-navy-800 rounded"
                        title="เปลี่ยนชื่อชั้นข้อมูล"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {onExportGeoJson && (
                        <button
                          onClick={() => onExportGeoJson(layer.id, layer.name)}
                          className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-navy-800 rounded"
                          title="ส่งออก GeoJSON"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      )}
                      {onExportKml && (
                        <button
                          onClick={() => onExportKml(layer.id, layer.name)}
                          className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-navy-800 rounded font-mono text-[9px] font-bold"
                          title="ส่งออก OGC KML 2.2"
                        >
                          KML
                        </button>
                      )}
                      {onExportKmz && (
                        <button
                          onClick={() => onExportKmz(layer.id, layer.name)}
                          className="p-1 text-slate-400 hover:text-indigo-300 hover:bg-navy-800 rounded font-mono text-[9px] font-bold"
                          title="ส่งออก Compressed KMZ"
                        >
                          KMZ
                        </button>
                      )}
                      {onConvertToManagedArea && (
                        <button
                          onClick={() => onConvertToManagedArea(layer.id, layer.name)}
                          className="p-1 text-slate-400 hover:text-amber-400 hover:bg-navy-800 rounded transition-colors"
                          title="แปลงรูปแปลงเป็นพื้นที่รับผิดชอบ (Convert to Responsibility Area)"
                        >
                          <Shield className="w-3 h-3" />
                        </button>
                      )}
                      {onImportGeoJson && !isReadOnly && (
                        <button
                          onClick={() => onImportGeoJson(layer.id)}
                          className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-navy-800 rounded"
                          title="นำเข้า GeoJSON"
                        >
                          <Upload className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteLayer(layer)}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-navy-800 rounded"
                        title="ลบชั้นข้อมูล"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {layers.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                ยังไม่มีชั้นข้อมูลแผนที่ คลิกปุ่มด้านล่างเพื่อสร้าง
              </div>
            )}
          </div>

          <div className="p-3 border-t border-navy-800 bg-navy-950/60">
            <button
              onClick={onOpenCreateLayer}
              className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-navy-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 hover:shadow-glow-cyan transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              สร้างชั้นข้อมูลใหม่ (Create Layer)
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Teams */}
      {activeTab === 'teams' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-navy-800 bg-navy-950/60 flex flex-col gap-2">
            <input
              type="text"
              placeholder="ค้นหาชื่อทีม หรือรหัสประจำทีม..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-navy-900 border border-navy-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredTeams.map((team) => {
              const isSelected = selectedItem?.type === 'team' && selectedItem.id === team.id;
              return (
                <div
                  key={team.id}
                  onClick={() => onSelectItem({ type: 'team', id: team.id })}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500 shadow-md'
                      : 'bg-navy-950/70 border-navy-800/90 hover:border-navy-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white">{team.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        {team.identifier}
                      </span>
                      <button
                        onClick={(e) => handleDeleteTeam(team, e)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-navy-800 rounded transition-colors"
                        title="ลบชุดปฏิบัติการนี้"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="truncate max-w-[150px]">{team.description || 'ทีมปฏิบัติการ'}</span>
                    <span className="text-[10px] text-slate-500 capitalize">{team.status}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-navy-800 bg-navy-950/60">
            <button
              onClick={onOpenCreateTeam}
              className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-navy-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 hover:shadow-glow-cyan transition-all"
            >
              <Plus className="w-4 h-4" />
              ลงทะเบียนทีมใหม่
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Locations */}
      {activeTab === 'locations' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-navy-800 bg-navy-950/60">
            <input
              type="text"
              placeholder="ค้นหาฐาน หรือจุดปฏิบัติการ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-navy-900 border border-navy-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredLocations.map((loc) => {
              const isSelected = selectedItem?.type === 'location' && selectedItem.id === loc.id;
              return (
                <div
                  key={loc.id}
                  onClick={() => onSelectItem({ type: 'location', id: loc.id })}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500 shadow-md'
                      : 'bg-navy-950/70 border-navy-800/90 hover:border-navy-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white">{loc.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {loc.locationType}
                      </span>
                      <button
                        onClick={(e) => handleDeleteLocation(loc, e)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-navy-800 rounded transition-colors"
                        title="ลบจุดพิกัดนี้"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {loc.description && (
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{loc.description}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-navy-800 bg-navy-950/60">
            <button
              onClick={onOpenCreateLocation}
              className="w-full py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 hover:shadow-glow-cyan transition-all"
            >
              <Plus className="w-4 h-4" />
              บันทึกฐาน/จุดพิกัดใหม่
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
