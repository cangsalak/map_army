'use client';

import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';

interface ChangeLegendProps {
  visibleLayers: {
    cut: boolean;
    fill: boolean;
    construction: boolean;
    boundary: boolean;
  };
  onToggleLayer: (layerKey: 'cut' | 'fill' | 'construction' | 'boundary') => void;
}

export default function ChangeLegend({ visibleLayers, onToggleLayer }: ChangeLegendProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div
      className="absolute bottom-16 right-4 z-20 bg-card/95 rounded-2xl p-3 border border-border shadow-2xl backdrop-blur-md select-none text-xs w-64 text-foreground transition-all"
      role="region"
      aria-label="คำอธิบายสัญลักษณ์และเลเยอร์แผนที่"
    >
      <div
        className="min-h-[44px] flex items-center justify-between cursor-pointer px-2 rounded-xl hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsOpen(!isOpen);
          }
        }}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 font-bold text-foreground">
          <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span>สัญลักษณ์และเลเยอร์ (Legend)</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="space-y-1.5 pt-2 border-t border-border mt-1">
          {/* Item 1: Cut */}
          <button
            onClick={() => onToggleLayer('cut')}
            className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              visibleLayers.cut
                ? 'bg-card-secondary hover:bg-muted text-foreground border border-border'
                : 'opacity-50 hover:opacity-80 bg-transparent text-muted-foreground'
            }`}
            aria-pressed={visibleLayers.cut}
            aria-label="สลับการแสดงผลเลเยอร์พื้นที่ขุดดิน Cut"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded bg-destructive shadow-sm border border-destructive/60 flex-shrink-0" />
              <span className="font-medium text-xs">พื้นที่ขุดดิน (Cut)</span>
            </div>
            {visibleLayers.cut ? (
              <Eye className="w-4 h-4 text-primary" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {/* Item 2: Fill */}
          <button
            onClick={() => onToggleLayer('fill')}
            className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              visibleLayers.fill
                ? 'bg-card-secondary hover:bg-muted text-foreground border border-border'
                : 'opacity-50 hover:opacity-80 bg-transparent text-muted-foreground'
            }`}
            aria-pressed={visibleLayers.fill}
            aria-label="สลับการแสดงผลเลเยอร์พื้นที่ถมดิน Fill"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded bg-success shadow-sm border border-success/60 flex-shrink-0" />
              <span className="font-medium text-xs">พื้นที่ถมดิน (Fill)</span>
            </div>
            {visibleLayers.fill ? (
              <Eye className="w-4 h-4 text-primary" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {/* Item 3: Construction */}
          <button
            onClick={() => onToggleLayer('construction')}
            className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              visibleLayers.construction
                ? 'bg-card-secondary hover:bg-muted text-foreground border border-border'
                : 'opacity-50 hover:opacity-80 bg-transparent text-muted-foreground'
            }`}
            aria-pressed={visibleLayers.construction}
            aria-label="สลับการแสดงผลเลเยอร์สิ่งปลูกสร้างและวัตถุใหม่"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded bg-warning shadow-sm border border-warning/60 flex-shrink-0" />
              <span className="font-medium text-xs">สิ่งปลูกสร้าง/วัตถุใหม่</span>
            </div>
            {visibleLayers.construction ? (
              <Eye className="w-4 h-4 text-primary" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {/* Item 4: Boundary */}
          <button
            onClick={() => onToggleLayer('boundary')}
            className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              visibleLayers.boundary
                ? 'bg-card-secondary hover:bg-muted text-foreground border border-border'
                : 'opacity-50 hover:opacity-80 bg-transparent text-muted-foreground'
            }`}
            aria-pressed={visibleLayers.boundary}
            aria-label="สลับการแสดงผลขอบเขต PostGIS"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-1.5 rounded-sm bg-primary shadow-sm flex-shrink-0" />
              <span className="font-medium text-xs">ขอบเขต PostGIS</span>
            </div>
            {visibleLayers.boundary ? (
              <Eye className="w-4 h-4 text-primary" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

