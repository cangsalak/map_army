'use client';

import React, { useState } from 'react';
import { X, Layers, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { LayerType } from '@geomonitor/shared';

interface CreateLayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onCreated: () => void;
}

export default function CreateLayerModal({
  isOpen,
  onClose,
  projectId,
  onCreated,
}: CreateLayerModalProps) {
  const [name, setName] = useState('');
  const [layerType, setLayerType] = useState<LayerType>('custom_vector');
  const [colorHex, setColorHex] = useState('#38bdf8');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiFetch('/layers', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          name,
          layerType,
          colorHex,
          visibility: true,
          opacity: 1.0,
          isEditable: true,
        }),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถสร้างเลเยอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-navy-900 border border-cyan-500/30 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in text-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-navy-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-white text-sm">สร้างเลเยอร์แผนที่ใหม่</h3>
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
            <label className="block text-slate-400 mb-1">ชื่อเลเยอร์ *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น แนวตรวจการณ์ฉุกเฉิน"
              className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">ประเภทเลเยอร์ *</label>
            <select
              value={layerType}
              onChange={(e) => setLayerType(e.target.value as any)}
              className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="custom_vector">เวกเตอร์ทั่วไป (Custom Vector)</option>
              <option value="hazard_zone">พื้นที่อันตราย / เขตหวงห้าม (Hazard Zone)</option>
              <option value="simulation_trail">เส้นทางจำลองการเคลื่อนที่ (Simulation Trail)</option>
              <option value="team_locations">จุดรวมพล / ฐานปฏิบัติการ (Team Locations)</option>
              <option value="boundary">ขอบเขตพื้นที่รับผิดชอบ (Boundary)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">สีประจำเลเยอร์ (Color HEX) *</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                className="w-8 h-8 rounded border border-navy-700 bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                className="flex-1 bg-navy-950 border border-navy-700 rounded-lg px-3 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500 uppercase"
              />
            </div>
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
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-navy-950 font-semibold hover:shadow-glow-cyan"
            >
              {loading ? 'กำลังบันทึก...' : 'สร้างเลเยอร์'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
