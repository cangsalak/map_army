'use client';

import React, { useState } from 'react';
import { X, Users, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onCreated: () => void;
}

export default function CreateTeamModal({
  isOpen,
  onClose,
  projectId,
  onCreated,
}: CreateTeamModalProps) {
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'standby' | 'deployed' | 'inactive'>('standby');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiFetch('/teams', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          name,
          identifier: identifier.toUpperCase().trim(),
          description: description || null,
          status,
        }),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถสร้างทีมได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-navy-900 border border-cyan-500/30 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in text-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-navy-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-white text-sm">เพิ่มทีมปฏิบัติการภาคสนาม</h3>
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
            <label className="block text-slate-400 mb-1">ชื่อทีมปฏิบัติการ *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ชุดปฏิบัติการค้นหาและกู้ภัย 1"
              className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">รหัสประจำทีม (Callsign / Identifier) *</label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="เช่น SAR-ALPHA-01"
              className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white uppercase font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">สถานะเริ่มต้น</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="standby">พร้อมปฏิบัติการ (Standby)</option>
              <option value="active">เปิดใช้งาน (Active)</option>
              <option value="deployed">ลงพื้นที่แล้ว (Deployed)</option>
              <option value="inactive">ไม่พร้อมใช้งาน (Inactive)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">คำอธิบายภารกิจ</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุหน้าที่ความรับผิดชอบหรือขอบเขตงาน"
              className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
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
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-navy-950 font-semibold hover:shadow-glow-cyan"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกทีม'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
