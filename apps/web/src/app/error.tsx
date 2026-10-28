'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isChunkError, setIsChunkError] = useState(false);

  useEffect(() => {
    console.error('[GeoMonitor App Error]', error);

    const isChunk =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('failed to fetch');

    setIsChunkError(!!isChunk);

    // Auto-reload once on ChunkLoadError to smoothly sync with newly compiled build assets
    if (isChunk && typeof window !== 'undefined') {
      const reloadKey = `chunk_reload_${error.message}`;
      const hasReloaded = sessionStorage.getItem(reloadKey);
      if (!hasReloaded) {
        sessionStorage.setItem(reloadKey, 'true');
        window.location.reload();
      }
    }
  }, [error]);

  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      // Hard refresh page to get fresh HTML and up-to-date Webpack chunk manifest
      window.location.reload();
    } else {
      reset();
    }
  };

  const handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    } else {
      reset();
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-navy-950 p-6 text-slate-200">
      <div className="max-w-md w-full gis-panel p-8 rounded-2xl border border-cyan-500/30 text-center shadow-2xl">
        <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-glow-cyan">
          {isChunkError ? <RefreshCw className="w-7 h-7 animate-spin" /> : <AlertTriangle className="w-7 h-7 text-rose-400" />}
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          {isChunkError
            ? 'กำลังปรับปรุงไฟล์ระบบเวอร์ชันใหม่ (New Version Detected)'
            : 'เกิดข้อผิดพลาดในการโหลดระบบ (GIS Client Error)'}
        </h2>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          {isChunkError
            ? 'ระบบตรวจพบการปรับปรุงชุดโปรแกรมเวอร์ชันล่าสุด กรุณากดปุ่มโหลดใหม่เพื่อรับข้อมูลอัปเดต'
            : error.message || 'ระบบไม่สามารถประมวลผลการแสดงผลแผนที่หรือข้อมูล 3D ได้ในขณะนี้'}
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={handleRetry}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-navy-950 font-bold rounded-lg text-sm flex items-center gap-2 transition-all shadow-glow-cyan cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            โหลดหน้าใหม่ (Refresh & Retry)
          </button>

          <button
            onClick={handleGoHome}
            className="px-4 py-2.5 bg-navy-800 hover:bg-navy-700 text-slate-200 font-medium rounded-lg text-sm flex items-center gap-2 transition-colors border border-slate-700 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    </div>
  );
}
