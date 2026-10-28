'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  MoveRight,
  Sliders,
  Type,
  Palette,
  RotateCw,
  Folder,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { MapLayerDTO, PlacedMapFeatureDTO, FeatureStyle } from '@geomonitor/shared';
import { apiFetch } from '@/lib/api';
import { SymbolIcon } from './SymbolIcon';

interface FeatureEditorPanelProps {
  feature: PlacedMapFeatureDTO | null;
  layers: MapLayerDTO[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  onDuplicated: () => void;
}

const PRESET_COLORS = [
  '#00f0ff', // Cyan
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#eab308', // Amber
  '#ef4444', // Red
  '#a855f7', // Purple
  '#f97316', // Orange
  '#ffffff', // White
];

export default function FeatureEditorPanel({
  feature,
  layers,
  onClose,
  onUpdated,
  onDeleted,
  onDuplicated,
}: FeatureEditorPanelProps) {
  if (!feature) return null;

  const currentLayer = layers.find((l) => l.id === feature.layerId);
  const isReadOnly = currentLayer ? !currentLayer.isEditable : false;

  const initialStyle: FeatureStyle = feature.style || {};

  const [name, setName] = useState(feature.name || '');
  const [description, setDescription] = useState(feature.description || '');
  const [targetLayerId, setTargetLayerId] = useState(feature.layerId);

  // Style attributes
  const [color, setColor] = useState(
    initialStyle.color || initialStyle.fillColor || initialStyle.strokeColor || '#00f0ff'
  );
  const [size, setSize] = useState(initialStyle.size || 24);
  const [rotation, setRotation] = useState(initialStyle.rotation || 0);
  const [opacity, setOpacity] = useState(
    initialStyle.opacity !== undefined ? initialStyle.opacity : 1.0
  );
  const [visible, setVisible] = useState(
    initialStyle.visible !== undefined ? initialStyle.visible : true
  );

  // Label attributes
  const [labelText, setLabelText] = useState(initialStyle.labelText || feature.name || '');
  const [showLabel, setShowLabel] = useState(
    initialStyle.showLabel !== undefined ? initialStyle.showLabel : true
  );
  const [labelSize, setLabelSize] = useState(initialStyle.labelSize || 12);

  // Stroke / Fill for vector shapes
  const [strokeWidth, setStrokeWidth] = useState(initialStyle.strokeWidth || 2);
  const [fillOpacity, setFillOpacity] = useState(
    initialStyle.fillOpacity !== undefined ? initialStyle.fillOpacity : 0.3
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(feature.name || '');
    setDescription(feature.description || '');
    setTargetLayerId(feature.layerId);

    const s = feature.style || {};
    setColor(s.color || s.fillColor || s.strokeColor || '#00f0ff');
    setSize(s.size || 24);
    setRotation(s.rotation || 0);
    setOpacity(s.opacity !== undefined ? s.opacity : 1.0);
    setVisible(s.visible !== undefined ? s.visible : true);
    setLabelText(s.labelText || feature.name || '');
    setShowLabel(s.showLabel !== undefined ? s.showLabel : true);
    setLabelSize(s.labelSize || 12);
    setStrokeWidth(s.strokeWidth || 2);
    setFillOpacity(s.fillOpacity !== undefined ? s.fillOpacity : 0.3);
  }, [feature]);

  // Apply Changes
  const handleApply = async () => {
    if (isReadOnly) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updatedStyle: FeatureStyle = {
        ...feature.style,
        color,
        fillColor: color,
        strokeColor: color,
        size,
        rotation,
        opacity,
        visible,
        labelText,
        showLabel,
        labelSize,
        strokeWidth,
        fillOpacity,
      };

      await apiFetch(`/features/${feature.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          layerId: targetLayerId !== feature.layerId ? targetLayerId : undefined,
          style: updatedStyle,
        }),
      });

      onUpdated();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'ไม่สามารถบันทึกการเปลี่ยนแปลงได้');
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate Feature
  const handleDuplicate = async () => {
    if (isReadOnly) return;
    setIsDuplicating(true);
    try {
      await apiFetch(`/features/${feature.id}/duplicate`, { method: 'POST' });
      onDuplicated();
      onClose();
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถคัดลอกวัตถุได้');
    } finally {
      setIsDuplicating(false);
    }
  };

  // Delete Feature
  const handleDelete = async () => {
    if (isReadOnly) return;
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "${name || 'วัตถุนี้'}" ออกจากแผนที่?`)) return;

    setIsDeleting(true);
    try {
      await apiFetch(`/features/${feature.id}`, { method: 'DELETE' });
      onDeleted();
      onClose();
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถลบวัตถุได้');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-30 w-80 max-h-[90vh] bg-navy-900/95 backdrop-blur-md border border-cyan-500/40 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-slideLeft">
      {/* Header */}
      <div className="px-4 py-3 bg-navy-950/80 border-b border-navy-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {feature.symbol ? (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${color}20`,
                border: `1px solid ${color}60`,
              }}
            >
              <SymbolIcon
                iconKey={feature.symbol.iconKey}
                svgContent={feature.symbol.svgContent}
                color={color}
                size={16}
              />
            </div>
          ) : (
            <div className="p-1 rounded bg-cyan-500/10 text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-white truncate max-w-[180px]">
              {name || 'แก้ไขวัตถุแผนที่'}
            </div>
            <div className="text-[10px] text-slate-400">
              {feature.symbol?.category || `ประเภท: ${feature.featureType}`}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-navy-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Read-Only Alert */}
      {isReadOnly && (
        <div className="px-3 py-2 bg-amber-950/90 border-b border-amber-500/30 text-[11px] text-amber-300 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>ชั้นข้อมูลนี้เป็นแบบอ่านอย่างเดียว ไม่อนุญาตให้แก้ไข</span>
        </div>
      )}

      {errorMessage && (
        <div className="px-3 py-2 bg-red-950/90 border-b border-red-500/30 text-[11px] text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {/* Name */}
        <div>
          <label className="block text-slate-400 mb-1">ชื่อวัตถุ / สัญลักษณ์</label>
          <input
            type="text"
            disabled={isReadOnly}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-navy-950 border border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-slate-400 mb-1">คำอธิบาย</label>
          <textarea
            rows={2}
            disabled={isReadOnly}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-navy-950 border border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none disabled:opacity-50"
          />
        </div>

        {/* Layer Assignment */}
        <div>
          <label className="block text-slate-400 mb-1 flex items-center gap-1">
            <Folder className="w-3 h-3 text-cyan-400" />
            <span>ชั้นข้อมูล (Layer)</span>
          </label>
          <select
            disabled={isReadOnly}
            value={targetLayerId}
            onChange={(e) => setTargetLayerId(e.target.value)}
            className="w-full bg-navy-950 border border-navy-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          >
            {layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} {!l.isEditable ? '(อ่านอย่างเดียว)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Color Palette */}
        <div>
          <label className="block text-slate-400 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Palette className="w-3 h-3 text-cyan-400" />
              <span>สีสัญลักษณ์ / เวกเตอร์</span>
            </span>
            <span className="font-mono text-[10px] text-cyan-400">{color}</span>
          </label>
          <div className="flex items-center gap-1.5 mb-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={isReadOnly}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full border transition-transform ${
                  color === c ? 'border-white scale-110 shadow-md' : 'border-black/40 hover:scale-105'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              disabled={isReadOnly}
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded border border-navy-700 bg-navy-950 cursor-pointer disabled:opacity-50"
            />
            <input
              type="text"
              disabled={isReadOnly}
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full bg-navy-950 border border-navy-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Size Slider (For points / symbols) */}
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span>ขนาดไอคอน</span>
            <span className="text-cyan-400 font-mono">{size}px</span>
          </div>
          <input
            type="range"
            min="12"
            max="64"
            disabled={isReadOnly}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full accent-cyan-400 disabled:opacity-50"
          />
        </div>

        {/* Rotation Slider */}
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <RotateCw className="w-3 h-3 text-cyan-400" />
              <span>การหมุน (Rotation)</span>
            </span>
            <span className="text-cyan-400 font-mono">{rotation}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            disabled={isReadOnly}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="w-full accent-cyan-400 disabled:opacity-50"
          />
        </div>

        {/* Opacity Slider */}
        <div>
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span>ความโปร่งแสง (Opacity)</span>
            <span className="text-cyan-400 font-mono">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            disabled={isReadOnly}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full accent-cyan-400 disabled:opacity-50"
          />
        </div>

        {/* Polygon / Polyline Style */}
        {feature.featureType !== 'Point' && (
          <div className="p-2.5 bg-navy-950/70 border border-navy-800 rounded-lg space-y-2">
            <span className="text-[11px] font-semibold text-slate-300">
              คุณสมบัติเส้นและพื้นที่ (Geometry Style)
            </span>
            <div>
              <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                <span>ความหนาเส้น (Stroke Width)</span>
                <span className="text-cyan-400 font-mono">{strokeWidth}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                disabled={isReadOnly}
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-full accent-cyan-400 disabled:opacity-50"
              />
            </div>
            {feature.featureType === 'Polygon' && (
              <div>
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span>ความทึบของสีพื้น (Fill Opacity)</span>
                  <span className="text-cyan-400 font-mono">{Math.round(fillOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  disabled={isReadOnly}
                  value={fillOpacity}
                  onChange={(e) => setFillOpacity(Number(e.target.value))}
                  className="w-full accent-cyan-400 disabled:opacity-50"
                />
              </div>
            )}
          </div>
        )}

        {/* Label Settings */}
        <div className="p-2.5 bg-navy-950/70 border border-navy-800 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <Type className="w-3 h-3 text-cyan-400" />
              <span>ป้ายข้อความกำกับ (Label)</span>
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                disabled={isReadOnly}
                checked={showLabel}
                onChange={(e) => setShowLabel(e.target.checked)}
                className="rounded accent-cyan-400"
              />
              <span className="text-[10px] text-slate-400">แสดงข้อความ</span>
            </label>
          </div>

          {showLabel && (
            <>
              <div>
                <label className="block text-slate-400 text-[10px] mb-1">ข้อความป้าย</label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={labelText}
                  onChange={(e) => setLabelText(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                  <span>ขนาดฟอนต์</span>
                  <span className="text-cyan-400 font-mono">{labelSize}px</span>
                </div>
                <input
                  type="range"
                  min="9"
                  max="24"
                  disabled={isReadOnly}
                  value={labelSize}
                  onChange={(e) => setLabelSize(Number(e.target.value))}
                  className="w-full accent-cyan-400 disabled:opacity-50"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 bg-navy-950 border-t border-navy-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={handleDuplicate}
            disabled={isReadOnly || isDuplicating}
            className="p-1.5 text-slate-300 hover:text-cyan-400 hover:bg-navy-800 rounded transition-colors disabled:opacity-40"
            title="คัดลอกวัตถุ (Duplicate)"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isReadOnly || isDeleting}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-navy-800 rounded transition-colors disabled:opacity-40"
            title="ลบวัตถุออกจากแผนที่ (Delete)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-navy-700 text-xs text-slate-300 hover:bg-navy-800 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleApply}
            disabled={isReadOnly || isSaving}
            className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-navy-950 font-semibold text-xs rounded-lg shadow-md shadow-cyan-500/20 flex items-center gap-1 disabled:opacity-40 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSaving ? 'กำลังบันทึก...' : 'ปรับใช้ (Apply)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
