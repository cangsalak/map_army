'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Clock,
  Activity,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { SimulationSessionDTO, SimulatedPositionDTO } from '@geomonitor/shared';

interface SimulationTimelineProps {
  sessions: SimulationSessionDTO[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  trackpoints: SimulatedPositionDTO[];
  onTimeChange: (isoTime: string | null) => void;
}

export default function SimulationTimeline({
  sessions,
  selectedSessionId,
  onSelectSession,
  trackpoints = [],
  onTimeChange,
}: SimulationTimelineProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeSession = sessions.find((s) => s.id === selectedSessionId);

  // Reset index when session or trackpoints change
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
    if (trackpoints.length > 0) {
      onTimeChange(trackpoints[0].timestamp);
    } else {
      onTimeChange(null);
    }
  }, [selectedSessionId, trackpoints]);

  // Playback Loop
  useEffect(() => {
    if (isPlaying && trackpoints.length > 1) {
      const intervalMs = Math.max(100, Math.round(1000 / speed));
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= trackpoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const nextIdx = prev + 1;
          onTimeChange(trackpoints[nextIdx].timestamp);
          return nextIdx;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, trackpoints]);

  const handlePlayPause = () => {
    if (currentIndex >= trackpoints.length - 1) {
      setCurrentIndex(0);
      onTimeChange(trackpoints[0]?.timestamp || null);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
    if (trackpoints.length > 0) {
      onTimeChange(trackpoints[0].timestamp);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    setCurrentIndex(idx);
    if (trackpoints[idx]) {
      onTimeChange(trackpoints[idx].timestamp);
    }
  };

  const currentPoint = trackpoints[currentIndex];

  if (!selectedSessionId || trackpoints.length === 0) {
    return (
      <div className="h-16 bg-card/95 border-t border-border px-4 flex items-center justify-between z-20 backdrop-blur-md text-foreground">
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground font-medium">รอบการฝึกซ้อมจำลอง:</div>
          <select
            value={selectedSessionId || ''}
            onChange={(e) => onSelectSession(e.target.value)}
            className="bg-card-secondary border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-medium"
          >
            <option value="">-- เลือกรอบการจำลองการเคลื่อนที่ --</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>
        </div>
        <div className="text-[11px] text-muted-foreground">
          ยังไม่ได้เลือกเซสชัน หรือไม่มีชุดพิกัดจำลอง
        </div>
      </div>
    );
  }

  return (
    <div className="h-20 bg-card/95 border-t border-border px-4 py-2 flex flex-col justify-between z-20 backdrop-blur-md select-none text-foreground">
      {/* Top Bar: Session, Time Display, Speed */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <select
            value={selectedSessionId}
            onChange={(e) => onSelectSession(e.target.value)}
            className="bg-card-secondary border border-border rounded-lg px-2.5 py-1 text-xs text-foreground font-medium focus:outline-none focus:border-primary max-w-[260px] truncate"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Synthetic Data Label */}
          <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 font-semibold">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            ข้อมูลจำลองการเคลื่อนที่ (SYNTHETIC ONLY)
          </span>
        </div>

        {/* Timestamp & Playback Metrics */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-mono text-foreground bg-card-secondary px-2.5 py-1 rounded-lg border border-border">
            <Clock className="w-3.5 h-3.5 text-primary" />
            {currentPoint
              ? new Date(currentPoint.timestamp).toLocaleTimeString('th-TH')
              : '--:--:--'}
          </div>

          {currentPoint && (
            <div className="text-[11px] text-muted-foreground">
              ความเร็ว: <span className="text-foreground font-mono font-bold">{currentPoint.speedMps} m/s</span> | ทิศ: <span className="text-foreground font-mono font-bold">{currentPoint.headingDeg}°</span>
            </div>
          )}

          {/* Speed Multiplier */}
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border">
            {[1, 2, 5, 10].map((sp) => (
              <button
                key={sp}
                onClick={() => setSpeed(sp)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer ${
                  speed === sp
                    ? 'bg-card text-primary font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {sp}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Bar: Play Controls & Scrub Slider */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePlayPause}
            className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90 text-white flex items-center justify-center shadow-sm transition-transform active:scale-95 cursor-pointer"
            title={isPlaying ? 'หยุดชั่วคราว (Pause)' : 'เล่น (Play)'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="รีเซ็ตไปที่จุดเริ่มต้น (Reset)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Scrub Slider */}
        <div className="flex-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, trackpoints.length - 1)}
            value={currentIndex}
            onChange={handleScrub}
            className="flex-1 accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
          />
          <span className="font-mono text-[10px] text-muted-foreground w-12 text-right">
            {currentIndex + 1} / {trackpoints.length}
          </span>
        </div>
      </div>
    </div>
  );
}
