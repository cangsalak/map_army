import React from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/primitives';

export function DemoNoticeBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/70 border border-amber-500/40 text-amber-300 text-[11px] font-mono shadow-md backdrop-blur-md">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>ข้อมูลจำลองสำหรับสาธิต (Simulated Demo Data) — ไม่ใช่ข้อมูลโทรมาตรการบินจริง</span>
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = 'ไม่พบข้อมูลในระบบ',
  description = 'ยังไม่มีข้อมูลการสำรวจหรือรูปแปลงในส่วนนี้ สามารถเริ่มต้นด้วยการเพิ่มพื้นที่ใหม่',
  actionText,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 bg-navy-950/40 border border-slate-800/80 rounded-xl my-4">
      <div className="w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700 text-slate-400 flex items-center justify-center">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-slate-200">{title}</h4>
        <p className="text-xs text-slate-400 max-w-sm">{description}</p>
      </div>
      {actionText && onAction && (
        <Button variant="cyan" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'กำลังโหลดข้อมูลภูมิสารสนเทศ...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-3 text-center">
      <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
      <span className="text-xs font-mono text-cyan-300/80">{message}</span>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'เกิดข้อผิดพลาดในการโหลดข้อมูล',
  message = 'ไม่สามารถเชื่อมต่อกับบริการ API หรือระบบฐานข้อมูล PostGIS ได้ กรุณาลองใหม่อีกครั้ง',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 bg-rose-950/20 border border-rose-500/30 rounded-xl my-4">
      <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center">
        <AlertCircle className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-rose-300">{title}</h4>
        <p className="text-xs text-slate-400 max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 text-xs text-rose-300 border-rose-500/40">
          <RefreshCw className="w-3.5 h-3.5" /> ลองใหม่อีกครั้ง
        </Button>
      )}
    </div>
  );
}
