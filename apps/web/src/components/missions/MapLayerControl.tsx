'use client';

import React, { useState } from 'react';
import {
  Layers,
  Check,
  Eye,
  EyeOff,
  Plane,
  Camera,
  MapPin,
  Box,
  Compass,
  Globe,
  Mountain,
  Map,
  X,
} from 'lucide-react';
import { DroneMapLayerVisibility } from '@/components/map/CesiumMap';

interface MapLayerControlProps {
  visibility: DroneMapLayerVisibility;
  onChange: (visibility: DroneMapLayerVisibility) => void;
  flightLinesCount?: number;
  photoCount?: number;
  waypointsCount?: number;
  hasPolygon?: boolean;
}

export default function MapLayerControl({
  visibility,
  onChange,
  flightLinesCount = 0,
  photoCount = 0,
  waypointsCount = 0,
  hasPolygon = false,
}: MapLayerControlProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Helper toggle
  const toggleLayer = (key: keyof DroneMapLayerVisibility) => {
    onChange({
      ...visibility,
      [key]: visibility[key] === false ? true : false,
    });
  };

  // Active layer counter
  const activeCount = Object.values(visibility).filter((v) => v !== false).length;

  return (
    <div className="relative">
      {/* Floating Layers Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="จัดการและแยกชั้นข้อมูลแผนที่ (Map Layers Controller)"
        className={`h-9 px-3 rounded-xl border flex items-center gap-2 text-xs font-semibold shadow-lg backdrop-blur-md transition-all cursor-pointer ${
          isOpen
            ? 'bg-primary text-white border-primary shadow-primary/20'
            : 'bg-card/95 border-border text-foreground hover:bg-muted hover:text-primary'
        }`}
      >
        <Layers className="w-4 h-4 text-primary group-hover:text-primary" />
        <span>ชั้นข้อมูลแผนที่ (Layers)</span>
        <span
          className={`w-5 h-5 rounded-full text-[10px] font-mono flex items-center justify-center font-bold transition-colors ${
            isOpen ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
          }`}
        >
          {activeCount}
        </span>
      </button>

      {/* Dropdown / Floating Layer Panel */}
      {isOpen && (
        <div className="absolute left-0 top-11 w-76 bg-card/95 border border-border rounded-2xl shadow-2xl backdrop-blur-md p-3.5 space-y-3 z-40 text-foreground animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">แยกชั้นข้อมูลแผนที่</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Group 1: Drone Mission Layers */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
              ชั้นข้อมูลภารกิจบินโดรน
            </div>

            {/* 1. Survey Area */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-card-secondary/70 border border-border hover:bg-card-secondary transition-colors cursor-pointer text-xs">
              <div className="flex items-center gap-2">
                <Box className="w-3.5 h-3.5 text-cyan-500" />
                <span className="font-medium">ขอบเขตแปลงสำรวจ</span>
              </div>
              <input
                type="checkbox"
                checked={visibility.surveyArea !== false}
                onChange={() => toggleLayer('surveyArea')}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
              />
            </label>

            {/* 2. Flight Lines */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-card-secondary/70 border border-border hover:bg-card-secondary transition-colors cursor-pointer text-xs">
              <div className="flex items-center gap-2">
                <Plane className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium">แนวบินโดรน (Flight Lines)</span>
                {flightLinesCount > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground">({flightLinesCount})</span>
                )}
              </div>
              <input
                type="checkbox"
                checked={visibility.flightLines !== false}
                onChange={() => toggleLayer('flightLines')}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
              />
            </label>

            {/* 3. Photo Capture Positions */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-card-secondary/70 border border-border hover:bg-card-secondary transition-colors cursor-pointer text-xs">
              <div className="flex items-center gap-2">
                <Camera className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-medium">จุดถ่ายภาพ (Photos)</span>
                {photoCount > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground">({photoCount})</span>
                )}
              </div>
              <input
                type="checkbox"
                checked={visibility.photoPositions !== false}
                onChange={() => toggleLayer('photoPositions')}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
              />
            </label>

            {/* 4. Waypoints */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-card-secondary/70 border border-border hover:bg-card-secondary transition-colors cursor-pointer text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-medium">จุดพิกัด Waypoints</span>
                {waypointsCount > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground">({waypointsCount})</span>
                )}
              </div>
              <input
                type="checkbox"
                checked={visibility.waypoints !== false}
                onChange={() => toggleLayer('waypoints')}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
              />
            </label>

            {/* 5. Camera Footprints */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-card-secondary/70 border border-border hover:bg-card-secondary transition-colors cursor-pointer text-xs">
              <div className="flex items-center gap-2">
                <Box className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-medium">กรอบครอบภาพ (Footprints)</span>
              </div>
              <input
                type="checkbox"
                checked={visibility.footprints !== false}
                onChange={() => toggleLayer('footprints')}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
              />
            </label>

            {/* 6. Home / Takeoff / Landing Markers */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-card-secondary/70 border border-border hover:bg-card-secondary transition-colors cursor-pointer text-xs">
              <div className="flex items-center gap-2">
                <Compass className="w-3.5 h-3.5 text-rose-500" />
                <span className="font-medium">จุด Home / ขึ้นบิน / ลงจอด</span>
              </div>
              <input
                type="checkbox"
                checked={visibility.markers !== false}
                onChange={() => toggleLayer('markers')}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
              />
            </label>
          </div>

          {/* Group 2: Base Maps & GIS Layers */}
          <div className="space-y-1.5 pt-1 border-t border-border">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
              ชั้นข้อมูลภูมิศาสตร์และแปลงที่ดิน
            </div>

            {/* Managed Areas */}
            <label className="flex items-center justify-between p-2 rounded-xl bg-card-secondary/70 border border-border hover:bg-card-secondary transition-colors cursor-pointer text-xs">
              <div className="flex items-center gap-2">
                <Map className="w-3.5 h-3.5 text-cyan-600" />
                <span className="font-medium">พื้นที่รับผิดชอบ (Managed Areas)</span>
              </div>
              <input
                type="checkbox"
                checked={visibility.managedAreas !== false}
                onChange={() => toggleLayer('managedAreas')}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
              />
            </label>
          </div>

          {/* Quick Actions Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-border text-[11px]">
            <button
              onClick={() =>
                onChange({
                  surveyArea: true,
                  flightLines: true,
                  waypoints: true,
                  photoPositions: true,
                  footprints: true,
                  markers: true,
                  managedAreas: true,
                })
              }
              className="text-primary hover:underline font-medium"
            >
              เปิดทั้งหมด
            </button>
            <button
              onClick={() =>
                onChange({
                  surveyArea: false,
                  flightLines: false,
                  waypoints: false,
                  photoPositions: false,
                  footprints: false,
                  markers: false,
                  managedAreas: false,
                })
              }
              className="text-muted-foreground hover:text-foreground hover:underline font-medium"
            >
              ปิดทั้งหมด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
