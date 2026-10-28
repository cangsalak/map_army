'use client';

import React from 'react';
import {
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Maximize2,
} from 'lucide-react';

import { toSignedBearing } from '@geomonitor/shared';

interface GoogleEarthCompassProps {
  heading: number; // in degrees (0 = North, 270 = West / -90)
  pitch: number; // in degrees (-90 = Top-down nadir, 0 = Horizon)
  onResetNorth: () => void;
  onResetNadir: () => void;
  onPan: (direction: 'north' | 'south' | 'east' | 'west') => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotateHeading?: (deltaDeg: number) => void;
  onAdjustTilt?: (deltaDeg: number) => void;
  className?: string;
}

export default function GoogleEarthCompass({
  heading,
  pitch,
  onResetNorth,
  onResetNadir,
  onPan,
  onZoomIn,
  onZoomOut,
  onRotateHeading,
  onAdjustTilt,
  className = '',
}: GoogleEarthCompassProps) {
  // Normalize heading to 0-360 and compute signed bearing (-180..+180)
  const normalizedHeading = ((heading % 360) + 360) % 360;
  const signedBearing = Math.round(toSignedBearing(normalizedHeading));

  return (
    <div
      className={`relative select-none flex flex-col items-center gap-2 p-2 bg-[#101A2D]/95 border border-[rgba(148,163,184,0.25)] rounded-3xl shadow-2xl backdrop-blur-md ${className}`}
      role="region"
      aria-label="Google Earth Pro 3D Navigation Controls"
    >
      {/* 1. Compass & Orbit Gimbal Ring */}
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* Outer Circular Ring with ticks */}
        <div
          className="absolute inset-0 rounded-full border-2 border-[rgba(148,163,184,0.3)] bg-[#080F20]/70 shadow-inner flex items-center justify-center"
          style={{ transform: `rotate(${-normalizedHeading}deg)`, transition: 'transform 0.15s ease-out' }}
        >
          {/* North Pointer Needle (Clicking resets True North) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResetNorth();
            }}
            title="คลิกเพื่อรีเซ็ตทิศเหนือ (Reset to True North - N)"
            aria-label="รีเซ็ตทิศเหนือ"
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-7 flex flex-col items-center justify-start text-[#F43F5E] hover:text-[#FB7185] transition-transform hover:scale-110 cursor-pointer focus:outline-none"
          >
            <span className="text-[10px] font-black font-mono leading-none tracking-tighter">N</span>
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[9px] border-b-[#F43F5E]" />
          </button>

          {/* East Tick */}
          <div className="absolute right-1 text-[8px] font-mono text-[#94A3B8] font-bold">E</div>
          {/* South Tick */}
          <div className="absolute bottom-1 text-[8px] font-mono text-[#94A3B8] font-bold">S</div>
          {/* West Tick */}
          <div className="absolute left-1 text-[8px] font-mono text-[#94A3B8] font-bold">W</div>

          {/* Tick Marks around ring */}
          <div className="absolute top-1/2 left-0 w-1.5 h-0.5 bg-[rgba(148,163,184,0.4)]" />
          <div className="absolute top-1/2 right-0 w-1.5 h-0.5 bg-[rgba(148,163,184,0.4)]" />
          <div className="absolute top-0 left-1/2 w-0.5 h-1.5 bg-[rgba(148,163,184,0.4)]" />
          <div className="absolute bottom-0 left-1/2 w-0.5 h-1.5 bg-[rgba(148,163,184,0.4)]" />
        </div>

        {/* Inner Pan Cross Controller (Google Earth Pro joystick) */}
        <div className="relative z-10 w-16 h-16 rounded-full bg-[#162238] border border-[rgba(148,163,184,0.3)] shadow-lg flex items-center justify-center">
          {/* Center: Reset Nadir (Top-Down Pitch -90°) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResetNadir();
            }}
            title="คลิกเพื่อรีเซ็ตมุมมองแนวระนาบดิ่ง (Reset Tilt to Top-Down - R/U)"
            aria-label="รีเซ็ตมุมมองแนวระนาบดิ่ง"
            className="w-7 h-7 rounded-full bg-[#101A2D] hover:bg-[#06B6D4] text-[#22D3EE] hover:text-[#080F20] transition-all flex items-center justify-center font-mono font-bold text-[9px] shadow-sm cursor-pointer"
          >
            {Math.round(pitch)}°
          </button>

          {/* Pan North */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPan('north');
            }}
            title="เลื่อนแผนที่ขึ้นเหนือ (Pan North)"
            aria-label="เลื่อนขึ้นเหนือ"
            className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[#94A3B8] hover:text-[#06B6D4] transition-colors p-0.5"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          {/* Pan South */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPan('south');
            }}
            title="เลื่อนแผนที่ลงใต้ (Pan South)"
            aria-label="เลื่อนลงใต้"
            className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[#94A3B8] hover:text-[#06B6D4] transition-colors p-0.5"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Pan West */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPan('west');
            }}
            title="เลื่อนแผนที่ไปทิศตะวันตก (Pan West)"
            aria-label="เลื่อนไปทิศตะวันตก"
            className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#06B6D4] transition-colors p-0.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          {/* Pan East */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPan('east');
            }}
            title="เลื่อนแผนที่ไปทิศตะวันออก (Pan East)"
            aria-label="เลื่อนไปทิศตะวันออก"
            className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#06B6D4] transition-colors p-0.5"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Tilt & Heading Angle HUD */}
      <div className="w-full flex items-center justify-between px-2 text-[10px] font-mono text-[#94A3B8] border-t border-[rgba(148,163,184,0.15)] pt-1.5">
        <span title="องศาทิศทางหัวกล้อง (Bearing -180..+180° / Heading 0-360°)">
          B: <b className="text-[#06B6D4]">{signedBearing >= 0 ? `+${signedBearing}°` : `${signedBearing}°`}</b>
          <span className="text-[#64748B] text-[9px] ml-0.5 font-normal">({Math.round(normalizedHeading)}°)</span>
        </span>
        <span title="องศามุมก้มเงย (Pitch/Tilt)">
          P: <b className="text-[#10B981]">{Math.round(pitch)}°</b>
        </span>
      </div>

      {/* 3. Zoom & Quick Orbit Bar */}
      <div className="flex items-center gap-1 w-full justify-between pt-1">
        {/* Rotate Left 15° */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onRotateHeading) onRotateHeading(-15);
          }}
          title="หมุนทิศทวนเข็มนาฬิกา 15°"
          aria-label="หมุนซ้าย"
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#162238] hover:bg-[#1C2940] text-[#CBD5E1] hover:text-[#22D3EE] transition-all text-xs font-mono"
        >
          ↺
        </button>

        {/* Zoom In (+) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onZoomIn();
          }}
          title="ขยายมุมมอง (Zoom In - Key: +)"
          aria-label="ขยายมุมมอง"
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#162238] hover:bg-[#1C2940] text-[#CBD5E1] hover:text-[#22D3EE] transition-all"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Out (-) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onZoomOut();
          }}
          title="ย่อมุมมอง (Zoom Out - Key: -)"
          aria-label="ย่อมุมมอง"
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#162238] hover:bg-[#1C2940] text-[#CBD5E1] hover:text-[#22D3EE] transition-all"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        {/* Rotate Right 15° */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onRotateHeading) onRotateHeading(15);
          }}
          title="หมุนทิศตามเข็มนาฬิกา 15°"
          aria-label="หมุนขวา"
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#162238] hover:bg-[#1C2940] text-[#CBD5E1] hover:text-[#22D3EE] transition-all text-xs font-mono"
        >
          ↻
        </button>
      </div>
    </div>
  );
}
