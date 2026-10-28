'use client';

import React, { useState } from 'react';
import {
  X,
  MapPin,
  Users,
  Compass,
  Navigation,
  Clock,
  Shield,
  Activity,
  PhoneCall,
  UserCheck,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { TeamDTO, TeamLocationDTO, LocationType, TeamStatus } from '@geomonitor/shared';
import { apiFetch } from '@/lib/api';

interface LocationInspectorProps {
  selectedItem: { type: 'team' | 'location' | 'simulation'; id: string } | null;
  onClose: () => void;
  teams: TeamDTO[];
  locations: TeamLocationDTO[];
  onFlyTo: (coords: { longitude: number; latitude: number }) => void;
  onLocationUpdated?: () => void;
  onLocationDeleted?: () => void;
  onTeamUpdated?: () => void;
  onTeamDeleted?: () => void;
}

export default function LocationInspector({
  selectedItem,
  onClose,
  teams,
  locations,
  onFlyTo,
  onLocationUpdated,
  onLocationDeleted,
  onTeamUpdated,
  onTeamDeleted,
}: LocationInspectorProps) {
  if (!selectedItem) return null;

  const team = selectedItem.type === 'team' ? teams.find((t) => t.id === selectedItem.id) : null;
  const location = selectedItem.type === 'location' ? locations.find((l) => l.id === selectedItem.id) : null;

  // Edit states for Location
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editLocName, setEditLocName] = useState('');
  const [editLocType, setEditLocType] = useState<LocationType>('staging_area');
  const [editLocLat, setEditLocLat] = useState('');
  const [editLocLon, setEditLocLon] = useState('');
  const [editLocDesc, setEditLocDesc] = useState('');

  // Edit states for Team
  const [isEditingTeam, setIsEditingTeam] = useState(false);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamIdentifier, setEditTeamIdentifier] = useState('');
  const [editTeamStatus, setEditTeamStatus] = useState<TeamStatus>('standby');
  const [editTeamDesc, setEditTeamDesc] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize edit form when starting edit for Location
  const handleStartEditLocation = (loc: TeamLocationDTO) => {
    setEditLocName(loc.name);
    setEditLocType(loc.locationType as LocationType);
    if (loc.geometry && loc.geometry.type === 'Point') {
      setEditLocLon(String((loc.geometry as any).coordinates[0]));
      setEditLocLat(String((loc.geometry as any).coordinates[1]));
    } else {
      setEditLocLon('');
      setEditLocLat('');
    }
    setEditLocDesc(loc.description || '');
    setError(null);
    setIsEditingLocation(true);
  };

  // Save edited Location
  const handleSaveLocation = async () => {
    if (!location) return;
    setError(null);
    setSaving(true);

    const lat = parseFloat(editLocLat);
    const lon = parseFloat(editLocLon);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError('พิกัดละติจูด/ลองจิจูดไม่ถูกต้อง');
      setSaving(false);
      return;
    }

    try {
      await apiFetch(`/locations/${location.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editLocName.trim(),
          locationType: editLocType,
          description: editLocDesc.trim() || null,
          geometry: {
            type: 'Point',
            coordinates: [lon, lat],
          },
        }),
      });

      setIsEditingLocation(false);
      if (onLocationUpdated) onLocationUpdated();
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถแก้ไขจุดพิกัดได้');
    } finally {
      setSaving(false);
    }
  };

  // Delete Location
  const handleDeleteLocation = async () => {
    if (!location) return;
    if (!confirm(`คุณต้องการลบจุดพิกัด/ฐาน "${location.name}" หรือไม่?`)) return;

    setError(null);
    setDeleting(true);
    try {
      await apiFetch(`/locations/${location.id}`, {
        method: 'DELETE',
      });
      onClose();
      if (onLocationDeleted) onLocationDeleted();
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถลบจุดพิกัดได้');
    } finally {
      setDeleting(false);
    }
  };

  // Initialize edit form for Team
  const handleStartEditTeam = (t: TeamDTO) => {
    setEditTeamName(t.name);
    setEditTeamIdentifier(t.identifier);
    setEditTeamStatus(t.status as TeamStatus);
    setEditTeamDesc(t.description || '');
    setError(null);
    setIsEditingTeam(true);
  };

  // Save edited Team
  const handleSaveTeam = async () => {
    if (!team) return;
    setError(null);
    setSaving(true);

    try {
      await apiFetch(`/teams/${team.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editTeamName.trim(),
          identifier: editTeamIdentifier.trim().toUpperCase(),
          status: editTeamStatus,
          description: editTeamDesc.trim() || null,
        }),
      });

      setIsEditingTeam(false);
      if (onTeamUpdated) onTeamUpdated();
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถแก้ไขข้อมูลทีมได้');
    } finally {
      setSaving(false);
    }
  };

  // Delete Team
  const handleDeleteTeam = async () => {
    if (!team) return;
    if (!confirm(`คุณต้องการลบชุดปฏิบัติการ "${team.name}" (${team.identifier}) หรือไม่?`)) return;

    setError(null);
    setDeleting(true);
    try {
      await apiFetch(`/teams/${team.id}`, {
        method: 'DELETE',
      });
      onClose();
      if (onTeamDeleted) onTeamDeleted();
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถลบทีมได้');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <aside className="w-84 h-full bg-navy-900/95 border-l border-cyan-500/20 flex flex-col z-20 backdrop-blur-md select-none text-slate-200 shadow-2xl">
      {/* Header */}
      <div className="p-3.5 border-b border-navy-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {team ? <Users className="w-4 h-4 text-cyan-400" /> : <MapPin className="w-4 h-4 text-blue-400" />}
          <span className="font-semibold text-xs tracking-wide text-white">
            {team ? 'รายละเอียดชุดปฏิบัติการ (Team)' : 'รายละเอียดฐาน/จุดพิกัด (Location)'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
          title="ปิดหน้าต่าง"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Error message */}
        {error && (
          <div className="p-2.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. TEAM DETAILS & EDITING */}
        {team && !isEditingTeam && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-bold text-white">{team.name}</div>
                <div className="text-cyan-400 font-mono text-xs mt-0.5">{team.identifier}</div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleStartEditTeam(team)}
                  className="p-1.5 rounded-lg bg-navy-800 text-slate-300 hover:text-cyan-300 hover:bg-navy-700 transition-colors"
                  title="แก้ไขข้อมูลทีม"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDeleteTeam}
                  disabled={deleting}
                  className="p-1.5 rounded-lg bg-navy-800 text-slate-400 hover:text-red-400 hover:bg-navy-700 transition-colors"
                  title="ลบทีม"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {team.description && (
              <p className="text-slate-400 text-[11px] leading-relaxed bg-navy-950/50 p-2.5 rounded-lg border border-navy-800">
                {team.description}
              </p>
            )}

            {/* Status & Freshness Grid */}
            <div className="grid grid-cols-2 gap-2 bg-navy-950 p-2.5 rounded-lg border border-navy-800">
              <div>
                <span className="text-[10px] text-slate-400 block">สถานะทีม</span>
                <span className="font-semibold text-cyan-300 capitalize">{team.status}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">ความสดใหม่ของพิกัด</span>
                <span className="font-semibold text-emerald-400 uppercase">
                  {team.latestLocation?.freshness || 'พร้อมรบ'}
                </span>
              </div>
            </div>

            {/* Latest Position & FlyTo */}
            {team.latestLocation && (
              <div className="bg-navy-950 p-3 rounded-lg border border-navy-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    พิกัดล่าสุด
                  </span>
                  <button
                    onClick={() =>
                      onFlyTo({
                        longitude: team.latestLocation!.longitude,
                        latitude: team.latestLocation!.latitude,
                      })
                    }
                    className="px-2.5 py-1 text-[11px] font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/30 transition-colors flex items-center gap-1"
                  >
                    <Navigation className="w-3 h-3" />
                    บินไปที่จุดนี้
                  </button>
                </div>
                <div className="font-mono text-cyan-400 text-xs font-semibold">
                  {team.latestLocation.latitude.toFixed(6)}°N, {team.latestLocation.longitude.toFixed(6)}°E
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  อัปเดตเมื่อ: {new Date(team.latestLocation.timestamp).toLocaleTimeString('th-TH')}
                </div>
              </div>
            )}

            {/* Members Section */}
            <div>
              <span className="text-[11px] font-semibold text-slate-300 block mb-2">
                กำลังพลในชุดปฏิบัติการ ({team.members?.length || team.memberCount || 0} นาย)
              </span>
              <div className="space-y-1.5">
                {team.members && team.members.length > 0 ? (
                  team.members.map((m) => (
                    <div
                      key={m.id}
                      className="p-2 rounded bg-navy-950 border border-navy-800/80 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-white">{m.callsign}</div>
                        <div className="text-[10px] text-slate-400 capitalize">{m.roleInTeam}</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        พร้อมปฏิบัติการ
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-slate-500 bg-navy-950/40 rounded border border-navy-800 text-[11px]">
                    ยังไม่มีข้อมูลกำลังพลรายบุคคล
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* TEAM EDIT FORM */}
        {team && isEditingTeam && (
          <div className="space-y-3 bg-navy-950 p-3.5 rounded-lg border border-cyan-500/30">
            <div className="text-xs font-bold text-cyan-300 uppercase tracking-wide">
              แก้ไขข้อมูลชุดปฏิบัติการ
            </div>

            <div>
              <label className="block text-slate-400 mb-1 text-[11px]">ชื่อทีมปฏิบัติการ *</label>
              <input
                type="text"
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 text-[11px]">รหัสประจำทีม (Callsign) *</label>
              <input
                type="text"
                value={editTeamIdentifier}
                onChange={(e) => setEditTeamIdentifier(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-white uppercase font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 text-[11px]">สถานะทีม</label>
              <select
                value={editTeamStatus}
                onChange={(e) => setEditTeamStatus(e.target.value as TeamStatus)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="active">Active (ปฏิบัติการอยู่)</option>
                <option value="standby">Standby (เตรียมพร้อม)</option>
                <option value="deployed">Deployed (ออกพื้นที่)</option>
                <option value="inactive">Inactive (ระงับชั่วคราว)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 text-[11px]">รายละเอียด / ภารกิจ</label>
              <textarea
                rows={3}
                value={editTeamDesc}
                onChange={(e) => setEditTeamDesc(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingTeam(false)}
                className="px-3 py-1.5 rounded-lg bg-navy-800 text-slate-300 hover:bg-navy-700 text-xs"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveTeam}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 text-xs flex items-center gap-1 shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        )}

        {/* 2. LOCATION DETAILS & EDITING */}
        {location && !isEditingLocation && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-bold text-white">{location.name}</div>
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] uppercase font-semibold">
                  {location.locationType}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleStartEditLocation(location)}
                  className="p-1.5 rounded-lg bg-navy-800 text-slate-300 hover:text-blue-300 hover:bg-navy-700 transition-colors"
                  title="แก้ไขจุดพิกัดนี้"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDeleteLocation}
                  disabled={deleting}
                  className="p-1.5 rounded-lg bg-navy-800 text-slate-400 hover:text-red-400 hover:bg-navy-700 transition-colors"
                  title="ลบจุดพิกัดนี้"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {location.description && (
              <p className="text-slate-400 text-[11px] leading-relaxed bg-navy-950/50 p-2.5 rounded-lg border border-navy-800">
                {location.description}
              </p>
            )}

            {location.geometry?.type === 'Point' && (
              <div className="bg-navy-950 p-3 rounded-lg border border-navy-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-blue-400" />
                    พิกัดภูมิศาสตร์ (WGS84)
                  </span>
                  <button
                    onClick={() =>
                      onFlyTo({
                        longitude: (location.geometry as any).coordinates[0],
                        latitude: (location.geometry as any).coordinates[1],
                      })
                    }
                    className="px-2.5 py-1 text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                  >
                    <Navigation className="w-3 h-3" />
                    บินไปที่จุดนี้
                  </button>
                </div>
                <div className="font-mono text-blue-400 text-xs font-semibold">
                  {(location.geometry as any).coordinates[1].toFixed(6)}°N,{' '}
                  {(location.geometry as any).coordinates[0].toFixed(6)}°E
                </div>
              </div>
            )}
          </>
        )}

        {/* LOCATION EDIT FORM */}
        {location && isEditingLocation && (
          <div className="space-y-3 bg-navy-950 p-3.5 rounded-lg border border-blue-500/30">
            <div className="text-xs font-bold text-blue-300 uppercase tracking-wide">
              แก้ไขจุดพิกัด / ฐานปฏิบัติการ
            </div>

            <div>
              <label className="block text-slate-400 mb-1 text-[11px]">ชื่อสถานที่ / ฐาน *</label>
              <input
                type="text"
                value={editLocName}
                onChange={(e) => setEditLocName(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 text-[11px]">ประเภทสถานที่ *</label>
              <select
                value={editLocType}
                onChange={(e) => setEditLocType(e.target.value as any)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="base_camp">ศูนย์บัญชาการหลัก (Base Camp)</option>
                <option value="staging_area">พื้นที่รวมพล/เตรียมการ (Staging Area)</option>
                <option value="observation_post">จุดตรวจการณ์ (Observation Post)</option>
                <option value="checkpoint">จุดตรวจ / สกัด (Checkpoint)</option>
                <option value="incident_site">จุดเกิดเหตุฉุกเฉิน (Incident Site)</option>
                <option value="work_zone">พื้นที่ปฏิบัติงานภาคสนาม (Work Zone)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1 text-[11px]">ละติจูด (Lat) *</label>
                <input
                  type="number"
                  step="any"
                  value={editLocLat}
                  onChange={(e) => setEditLocLat(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 text-[11px]">ลองจิจูด (Lon) *</label>
                <input
                  type="number"
                  step="any"
                  value={editLocLon}
                  onChange={(e) => setEditLocLon(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 text-[11px]">รายละเอียด</label>
              <textarea
                rows={3}
                value={editLocDesc}
                onChange={(e) => setEditLocDesc(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingLocation(false)}
                className="px-3 py-1.5 rounded-lg bg-navy-800 text-slate-300 hover:bg-navy-700 text-xs"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveLocation}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-400 text-xs flex items-center gap-1 shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
