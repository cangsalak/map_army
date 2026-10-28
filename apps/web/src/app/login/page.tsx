'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Compass, Lock, Mail, ShieldCheck, ArrowRight, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/primitives';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      const searchParams = new URLSearchParams(window.location.search);
      const destination = searchParams.get('from') || '/';
      window.location.href = destination;
    } catch (err: any) {
      setError(err?.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickRole = (rEmail: string, rPass: string) => {
    setEmail(rEmail);
    setPassword(rPass);
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-navy-950 p-4 font-sans text-slate-100 select-none relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md gis-panel rounded-2xl p-8 border border-cyan-500/20 shadow-2xl relative z-10">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow-cyan mb-3">
            <Compass className="w-7 h-7 text-navy-950" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-1.5">
            GeoMonitor <span className="text-cyan-400">3D</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ระบบเข้าสู่ระบบศูนย์บัญชาการแผนที่ 3 มิติและตรวจจับการเปลี่ยนแปลง (On-Premises)
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              อีเมลผู้ใช้งาน (Username / Email)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@geomonitor.local"
                className="w-full bg-navy-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-navy-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 text-xs font-bold gap-2"
          >
            {isLoading ? 'กำลังตรวจสอบสิทธิ์...' : 'เข้าสู่ระบบ (Sign In)'}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>

        {/* Quick Role Fillers for Development/Testing */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 mb-2 flex items-center justify-between">
            <span>เข้าสู่ระบบด่วนตามบทบาท (Quick Roles):</span>
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <button
              type="button"
              onClick={() => handleQuickRole('admin@geomonitor.local', 'Password123!')}
              className={`p-2 rounded border text-left transition-colors ${
                email.includes('admin')
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                  : 'border-slate-800 bg-navy-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-bold text-white flex items-center justify-between">
                <span>ผู้ดูแลระบบ</span>
                {email.includes('admin') && <Check className="w-3 h-3 text-cyan-400" />}
              </div>
              <div className="text-slate-500 text-[9px]">Role: admin</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickRole('pm@geomonitor.local', 'Password123!')}
              className={`p-2 rounded border text-left transition-colors ${
                email.includes('pm')
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                  : 'border-slate-800 bg-navy-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-bold text-white flex items-center justify-between">
                <span>ผู้จัดการโครงการ</span>
                {email.includes('pm') && <Check className="w-3 h-3 text-cyan-400" />}
              </div>
              <div className="text-slate-500 text-[9px]">Role: project_manager</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickRole('analyst@geomonitor.local', 'Password123!')}
              className={`p-2 rounded border text-left transition-colors ${
                email.includes('analyst')
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                  : 'border-slate-800 bg-navy-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-bold text-white flex items-center justify-between">
                <span>นักวิเคราะห์ภาพ</span>
                {email.includes('analyst') && <Check className="w-3 h-3 text-cyan-400" />}
              </div>
              <div className="text-slate-500 text-[9px]">Role: analyst</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickRole('viewer@geomonitor.local', 'Password123!')}
              className={`p-2 rounded border text-left transition-colors ${
                email.includes('viewer')
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                  : 'border-slate-800 bg-navy-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-bold text-white flex items-center justify-between">
                <span>ผู้ตรวจดูข้อมูล</span>
                {email.includes('viewer') && <Check className="w-3 h-3 text-cyan-400" />}
              </div>
              <div className="text-slate-500 text-[9px]">Role: viewer</div>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 text-[10px] text-slate-500 text-center font-mono">
        GeoMonitor 3D Enterprise On-Premises Edition • Air-Gapped Network Ready
      </div>
    </div>
  );
}
