'use client';

import React from 'react';
import {
  MapPin,
  Spline,
  Hexagon,
  Square,
  Circle,
  Type,
  Check,
  X,
  Undo2,
  Redo2,
  Trash2,
  Sliders,
  Sparkles,
} from 'lucide-react';

export type DrawingTool =
  | 'none'
  | 'symbol'
  | 'point'
  | 'polyline'
  | 'polygon'
  | 'rectangle'
  | 'circle'
  | 'text';

interface DrawingToolbarProps {
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  onOpenSymbolLibrary: () => void;
  selectedSymbolName?: string | null;
  vertexCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFinishDrawing: () => void;
  onCancelDrawing: () => void;
  activeLayerName?: string;
  isLayerReadOnly?: boolean;
}

export default function DrawingToolbar({
  activeTool,
  onSelectTool,
  onOpenSymbolLibrary,
  selectedSymbolName,
  vertexCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onFinishDrawing,
  onCancelDrawing,
  activeLayerName,
  isLayerReadOnly = false,
}: DrawingToolbarProps) {
  const isDrawing = activeTool !== 'none';

  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-auto">
      {/* Main Drawing Tools Strip */}
      <div className="bg-navy-900/90 backdrop-blur-md border border-cyan-500/30 rounded-xl p-1.5 flex items-center gap-1 shadow-2xl shadow-black/50">
        {/* Open Symbol Library button */}
        <button
          onClick={onOpenSymbolLibrary}
          disabled={isLayerReadOnly}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTool === 'symbol'
              ? 'bg-cyan-500 text-navy-950 shadow-md shadow-cyan-500/30'
              : 'bg-navy-950 text-cyan-300 hover:bg-navy-800 border border-cyan-500/30'
          } ${isLayerReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="เปิดคลังสัญลักษณ์ยุทธวิธีและแผนที่"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{selectedSymbolName ? `สัญลักษณ์: ${selectedSymbolName}` : 'คลังสัญลักษณ์'}</span>
        </button>

        <div className="w-[1px] h-6 bg-navy-700 mx-1" />

        {/* Vector Drawing Tools */}
        <button
          onClick={() => onSelectTool(activeTool === 'point' ? 'none' : 'point')}
          disabled={isLayerReadOnly}
          className={`p-2 rounded-lg text-xs transition-colors ${
            activeTool === 'point'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
              : 'text-slate-300 hover:text-white hover:bg-navy-800'
          } ${isLayerReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="จุดมาร์กเกอร์ (Point Marker)"
        >
          <MapPin className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTool(activeTool === 'polyline' ? 'none' : 'polyline')}
          disabled={isLayerReadOnly}
          className={`p-2 rounded-lg text-xs transition-colors ${
            activeTool === 'polyline'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
              : 'text-slate-300 hover:text-white hover:bg-navy-800'
          } ${isLayerReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="เส้นทาง / เส้นต่อจุด (Polyline)"
        >
          <Spline className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTool(activeTool === 'polygon' ? 'none' : 'polygon')}
          disabled={isLayerReadOnly}
          className={`p-2 rounded-lg text-xs transition-colors ${
            activeTool === 'polygon'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
              : 'text-slate-300 hover:text-white hover:bg-navy-800'
          } ${isLayerReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="รูปหลายเหลี่ยม / ขอบเขตพื้นที่ (Polygon)"
        >
          <Hexagon className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTool(activeTool === 'rectangle' ? 'none' : 'rectangle')}
          disabled={isLayerReadOnly}
          className={`p-2 rounded-lg text-xs transition-colors ${
            activeTool === 'rectangle'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
              : 'text-slate-300 hover:text-white hover:bg-navy-800'
          } ${isLayerReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="สี่เหลี่ยมผืนผ้า (Rectangle)"
        >
          <Square className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTool(activeTool === 'circle' ? 'none' : 'circle')}
          disabled={isLayerReadOnly}
          className={`p-2 rounded-lg text-xs transition-colors ${
            activeTool === 'circle'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
              : 'text-slate-300 hover:text-white hover:bg-navy-800'
          } ${isLayerReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="วงกลม / รัศมีปฏิบัติการ (Circle)"
        >
          <Circle className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTool(activeTool === 'text' ? 'none' : 'text')}
          disabled={isLayerReadOnly}
          className={`p-2 rounded-lg text-xs transition-colors ${
            activeTool === 'text'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
              : 'text-slate-300 hover:text-white hover:bg-navy-800'
          } ${isLayerReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="ข้อความกำกับแผนที่ (Text Annotation)"
        >
          <Type className="w-4 h-4" />
        </button>

        {/* Finish / Cancel when drawing */}
        {isDrawing && (
          <>
            <div className="w-[1px] h-6 bg-navy-700 mx-1" />

            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-2 text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-navy-800 transition-colors"
              title="เลิกทำจุดล่าสุด (Undo Vertex)"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-2 text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-navy-800 transition-colors"
              title="ทำซ้ำ (Redo)"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <button
              onClick={onFinishDrawing}
              disabled={
                (activeTool === 'polyline' && vertexCount < 2) ||
                (activeTool === 'polygon' && vertexCount < 3)
              }
              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs rounded-lg flex items-center gap-1 shadow-md shadow-emerald-500/20 disabled:opacity-40 transition-all"
              title="เสร็จสิ้นการวาด"
            >
              <Check className="w-4 h-4" />
              <span>เสร็จสิ้น</span>
            </button>

            <button
              onClick={onCancelDrawing}
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-navy-800 rounded-lg transition-colors"
              title="ยกเลิกการวาด (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Floating Status & Guidance Banner */}
      {isDrawing ? (
        <div className="bg-navy-950/95 border border-cyan-500/40 rounded-lg px-3 py-1.5 text-xs text-cyan-300 shadow-lg flex items-center gap-2 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>
            {activeTool === 'symbol' &&
              `คลิกบนแผนที่เพื่อวางสัญลักษณ์ "${selectedSymbolName || 'ที่เลือก'}" (กด Esc เพื่อยกเลิก)`}
            {activeTool === 'point' && 'คลิกบนแผนที่เพื่อวางจุดมาร์กเกอร์'}
            {activeTool === 'polyline' &&
              `คลิกเพื่อเพิ่มจุดเส้นทาง (บันทึกแล้ว ${vertexCount} จุด) ดับเบิ้ลคลิกหรือกดเสร็จสิ้น`}
            {activeTool === 'polygon' &&
              `คลิกเพื่อเพิ่มจุดขอบเขต (บันทึกแล้ว ${vertexCount} จุด ต้องมีอย่างน้อย 3 จุด)`}
            {activeTool === 'rectangle' && 'คลิกจุดมุมที่ 1 และจุดมุมทแยงเพื่อสร้างสี่เหลี่ยม'}
            {activeTool === 'circle' && 'คลิกจุดศูนย์กลาง และคลิกจุดขอบเพื่อกำหนดรัศมีวงกลม'}
            {activeTool === 'text' && 'คลิกบนแผนที่เพื่อวางป้ายข้อความ'}
          </span>
        </div>
      ) : isLayerReadOnly ? (
        <div className="bg-amber-950/90 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-amber-300 shadow-md">
          ⚠️ ชั้นข้อมูล &quot;{activeLayerName}&quot; เป็นแบบอ่านอย่างเดียว ไม่อนุญาตให้วาดหรือวางสัญลักษณ์
        </div>
      ) : activeLayerName ? (
        <div className="bg-navy-950/80 border border-navy-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 shadow-sm flex items-center gap-1.5">
          <span>บันทึกลงชั้นข้อมูล:</span>
          <span className="font-semibold text-cyan-400">{activeLayerName}</span>
        </div>
      ) : null}
    </div>
  );
}
