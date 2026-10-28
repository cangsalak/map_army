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
      <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl p-1.5 flex items-center gap-1 shadow-xl text-foreground">
        {/* Open Symbol Library button */}
        <button
          onClick={onOpenSymbolLibrary}
          disabled={isLayerReadOnly}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTool === 'symbol'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-card-secondary text-primary hover:bg-muted border border-border'
          } ${isLayerReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="เปิดคลังสัญลักษณ์ยุทธวิธีและแผนที่"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{selectedSymbolName ? `สัญลักษณ์: ${selectedSymbolName}` : 'คลังสัญลักษณ์'}</span>
        </button>

        <div className="w-[1px] h-6 bg-border mx-1" />

        {/* Vector Drawing Tools */}
        <button
          onClick={() => onSelectTool(activeTool === 'point' ? 'none' : 'point')}
          disabled={isLayerReadOnly}
          className={`p-2 rounded-lg text-xs transition-colors ${
            activeTool === 'point'
              ? 'bg-primary/10 text-primary border border-primary/30 font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
              ? 'bg-primary/10 text-primary border border-primary/30 font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
              ? 'bg-primary/10 text-primary border border-primary/30 font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
              ? 'bg-primary/10 text-primary border border-primary/30 font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
              ? 'bg-primary/10 text-primary border border-primary/30 font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
              ? 'bg-primary/10 text-primary border border-primary/30 font-bold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          } ${isLayerReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="ข้อความกำกับแผนที่ (Text Annotation)"
        >
          <Type className="w-4 h-4" />
        </button>

        {/* Finish / Cancel when drawing */}
        {isDrawing && (
          <>
            <div className="w-[1px] h-6 bg-border mx-1" />

            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              title="เลิกทำจุดล่าสุด (Undo Vertex)"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-lg hover:bg-muted transition-colors cursor-pointer"
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
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm disabled:opacity-40 transition-all cursor-pointer"
              title="เสร็จสิ้นการวาด"
            >
              <Check className="w-4 h-4" />
              <span>เสร็จสิ้น</span>
            </button>

            <button
              onClick={onCancelDrawing}
              className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
              title="ยกเลิกการวาด (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Floating Status & Guidance Banner */}
      {isDrawing ? (
        <div className="bg-card/95 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground shadow-lg flex items-center gap-2 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
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
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200 shadow-xs">
          ⚠️ ชั้นข้อมูล &quot;{activeLayerName}&quot; เป็นแบบอ่านอย่างเดียว ไม่อนุญาตให้วาดหรือวางสัญลักษณ์
        </div>
      ) : activeLayerName ? (
        <div className="bg-card/95 border border-border rounded-xl px-3 py-1 text-[11px] text-muted-foreground shadow-xs flex items-center gap-1.5">
          <span>บันทึกลงชั้นข้อมูล:</span>
          <span className="font-semibold text-primary">{activeLayerName}</span>
        </div>
      ) : null}
    </div>
  );
}
