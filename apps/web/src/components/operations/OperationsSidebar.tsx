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
  const [activeTab, setActiveTab] = useState<'layers' | 'teams' | 'locations'>('layers');
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
    <aside className="w-80 h-full bg-card/95 border-r border-border flex flex-col z-20 backdrop-blur-md select-none text-foreground">
      {/* Sidebar Header & Tabs */}
      <div className="p-3 border-b border-border bg-card-secondary/70 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-xs tracking-wide text-foreground">
                ศูนย์ปฏิบัติการภาคสนาม
              </span>
              <p className="text-[10px] text-muted-foreground">Field Operations Center</p>
            </div>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 font-semibold font-mono">
            {layers.length} ชั้นข้อมูล
          </span>
        </div>

        {/* 3 Main Tactical Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab('layers')}
            className={`py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'layers'
                ? 'bg-card text-primary font-bold border border-border shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>ชั้นข้อมูล</span>
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'teams'
                ? 'bg-card text-primary font-bold border border-border shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>ทีม</span>
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className={`py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'locations'
                ? 'bg-card text-primary font-bold border border-border shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>ฐาน/จุด</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Layers Manager (Main Workspace) */}
      {activeTab === 'layers' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-border bg-card-secondary/70 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>คลิกเพื่อเลือก <strong>ชั้นข้อมูลที่ใช้งาน</strong> (Active Layer)</span>
            <span className="text-[10px] text-primary font-medium">รูปแปลง: บันทึกลงชั้นนี้</span>
          </div>

          {/* Layer Actions Toolbar: Add Layer & Import KML/KMZ */}
          <div className="p-2 border-b border-border bg-card-secondary/40 flex items-center gap-1.5">
            <button
              onClick={onOpenCreateLayer}
              className="flex-1 min-h-[34px] px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>สร้างชั้นข้อมูล</span>
            </button>

            {onOpenImportKml && (
              <button
                onClick={onOpenImportKml}
                className="flex-1 min-h-[34px] px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-muted text-foreground border border-border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="นำเข้าไฟล์ .kml หรือ .kmz จาก Google Earth หรือ GIS"
              >
                <Upload className="w-3.5 h-3.5 text-primary" />
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
                      ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20'
                      : 'bg-card-secondary/60 border-border hover:border-primary/40'
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
                            ? 'border-primary bg-primary/20'
                            : 'border-muted-foreground/40 hover:border-foreground'
                        }`}
                        title={isActive ? 'ชั้นข้อมูลที่กำลังใช้งานอยู่' : 'คลิกเพื่อตั้งเป็นชั้นข้อมูลใช้งาน'}
                      >
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>

                      {/* Visibility toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLayerVisibility(layer.id, layer.visibility);
                        }}
                        className={`p-1 rounded shrink-0 ${
                          layer.visibility ? 'text-primary hover:bg-muted' : 'text-muted-foreground/50'
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
                          className="bg-card border border-primary rounded-lg px-1.5 py-0.5 text-xs text-foreground focus:outline-none w-full"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`text-xs font-semibold truncate ${
                              isActive ? 'text-primary' : 'text-foreground'
                            }`}
                          >
                            {layer.name}
                          </span>
                          {isReadOnly && (
                            <span title="อ่านอย่างเดียว (Read Only)">
                              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Feature Count & Badges */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-card text-muted-foreground border border-border font-mono">
                        {layer.featureCount || 0}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-border shadow-2xs"
                        style={{ backgroundColor: layer.colorHex || 'var(--primary)' }}
                      />
                    </div>
                  </div>

                  {/* Middle row: Opacity Slider */}
                  <div
                    className="flex items-center gap-2 text-[10px] text-muted-foreground px-1"
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
                      className="flex-1 accent-primary h-1 bg-muted rounded-lg cursor-pointer"
                    />
                    <span className="w-7 text-right font-mono text-[9px] text-foreground">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>

                  {/* Bottom row: Tool actions (Reorder, Rename, Export, Import, Delete) */}
                  <div
                    className="flex items-center justify-between pt-1 border-t border-border/70 text-[10px] text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-0.5">
                      <button
                        disabled={index === 0}
                        onClick={() => handleMoveLayer(index, 'up')}
                        className="p-1 hover:text-foreground disabled:opacity-20 hover:bg-muted rounded transition-colors"
                        title="เลื่อนขึ้น"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        disabled={index === layers.length - 1}
                        onClick={() => handleMoveLayer(index, 'down')}
                        className="p-1 hover:text-foreground disabled:opacity-20 hover:bg-muted rounded transition-colors"
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
                          className="p-1 text-muted-foreground hover:text-emerald-500 hover:bg-muted rounded transition-colors"
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
                        className="p-1 text-muted-foreground hover:text-primary hover:bg-muted rounded"
                        title="เปลี่ยนชื่อชั้นข้อมูล"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {onExportGeoJson && (
                        <button
                          onClick={() => onExportGeoJson(layer.id, layer.name)}
                          className="p-1 text-muted-foreground hover:text-primary hover:bg-muted rounded"
                          title="ส่งออก GeoJSON"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      )}
                      {onExportKml && (
                        <button
                          onClick={() => onExportKml(layer.id, layer.name)}
                          className="p-1 text-muted-foreground hover:text-indigo-500 hover:bg-muted rounded font-mono text-[9px] font-bold"
                          title="ส่งออก OGC KML 2.2"
                        >
                          KML
                        </button>
                      )}
                      {onExportKmz && (
                        <button
                          onClick={() => onExportKmz(layer.id, layer.name)}
                          className="p-1 text-muted-foreground hover:text-indigo-500 hover:bg-muted rounded font-mono text-[9px] font-bold"
                          title="ส่งออก Compressed KMZ"
                        >
                          KMZ
                        </button>
                      )}
                      {onConvertToManagedArea && (
                        <button
                          onClick={() => onConvertToManagedArea(layer.id, layer.name)}
                          className="p-1 text-muted-foreground hover:text-amber-500 hover:bg-muted rounded transition-colors"
                          title="แปลงรูปแปลงเป็นพื้นที่รับผิดชอบ (Convert to Responsibility Area)"
                        >
                          <Shield className="w-3 h-3" />
                        </button>
                      )}
                      {onImportGeoJson && !isReadOnly && (
                        <button
                          onClick={() => onImportGeoJson(layer.id)}
                          className="p-1 text-muted-foreground hover:text-primary hover:bg-muted rounded"
                          title="นำเข้า GeoJSON"
                        >
                          <Upload className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteLayer(layer)}
                        className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
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
              <div className="p-8 text-center text-xs text-muted-foreground">
                ยังไม่มีชั้นข้อมูลแผนที่ คลิกปุ่มด้านล่างเพื่อสร้าง
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border bg-card-secondary/70">
            <button
              onClick={onOpenCreateLayer}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
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
          <div className="p-3 border-b border-border bg-card-secondary/70 flex flex-col gap-2">
            <input
              type="text"
              placeholder="ค้นหาชื่อทีม หรือรหัสประจำทีม..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredTeams.map((team) => {
              const isSelected = selectedItem?.type === 'team' && selectedItem.id === team.id;
              return (
                <div
                  key={team.id}
                  onClick={() => onSelectItem({ type: 'team', id: team.id })}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20'
                      : 'bg-card-secondary/60 border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{team.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono font-medium">
                        {team.identifier}
                      </span>
                      <button
                        onClick={(e) => handleDeleteTeam(team, e)}
                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-muted rounded transition-colors"
                        title="ลบชุดปฏิบัติการนี้"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span className="truncate max-w-[150px]">{team.description || 'ทีมปฏิบัติการ'}</span>
                    <span className="text-[10px] text-muted-foreground capitalize font-medium">{team.status}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-border bg-card-secondary/70">
            <button
              onClick={onOpenCreateTeam}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
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
          <div className="p-3 border-b border-border bg-card-secondary/70">
            <input
              type="text"
              placeholder="ค้นหาฐาน หรือจุดปฏิบัติการ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredLocations.map((loc) => {
              const isSelected = selectedItem?.type === 'location' && selectedItem.id === loc.id;
              return (
                <div
                  key={loc.id}
                  onClick={() => onSelectItem({ type: 'location', id: loc.id })}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20'
                      : 'bg-card-secondary/60 border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{loc.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                        {loc.locationType}
                      </span>
                      <button
                        onClick={(e) => handleDeleteLocation(loc, e)}
                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-muted rounded transition-colors"
                        title="ลบจุดพิกัดนี้"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {loc.description && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{loc.description}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-border bg-card-secondary/70">
            <button
              onClick={onOpenCreateLocation}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
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
