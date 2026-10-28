'use client';

import React, { useState } from 'react';
import { X, MapPin, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { LocationType } from '@geomonitor/shared';

interface CreateLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onCreated: () => void;
}

export default function CreateLocationModal({
  isOpen,
  onClose,
  projectId,
  onCreated,
}: CreateLocationModalProps) {
  const [name, setName] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('staging_area');
  const [latitude, setLatitude] = useState('12.678');
  const [longitude, setLongitude] = useState('101.145');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError('พิกัดละติจูด/ลองจิจูดไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    try {
      await apiFetch('/locations', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          name,
          locationType,
          geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          description: description || null,
          status: 'active',
        }),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถบันทึกสถานที่ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-navy-900 border border-blue-500/30 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in text-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-navy-800">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">บันทึกฐานปฏิบัติการ / จุดพิกัดสำคัญ</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-400 mb-1">ชื่อสถานที่ / ฐาน *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ฐานส่วนหน้า มาบตาพุด"
              className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">ประเภทสถานที่ *</label>
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value as any)}
              className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
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
              <label className="block text-slate-400 mb-1">ละติจูด (Latitude) *</label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="เช่น 12.678"
                className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">ลองจิจูด (Longitude) *</label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="เช่น 101.145"
                className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">รายละเอียดเพิ่มเติม</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุสิ่งอำนวยความสะดวก หรือข้อมูลความปลอดภัย"
              className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-navy-800 text-slate-300 hover:bg-navy-700"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold hover:shadow-glow-cyan"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกสถานที่'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
