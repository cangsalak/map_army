'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Compass, Lock, Mail, ShieldCheck, ArrowRight, AlertCircle, Check } from 'lucide-react';
import { Button, Card, FormField, Input, cn } from '@/components/ui/primitives';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

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
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-background p-4 font-sans text-foreground select-none relative overflow-hidden transition-colors duration-200">
      {/* Top Bar with Theme Toggle */}
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle />
      </div>

      {/* Decorative background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <Card className="w-full max-w-md p-8 border border-border shadow-2xl relative z-10">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-sm mb-3">
            <Compass className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
            GeoMonitor <span className="text-primary font-black">3D</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            ระบบเข้าสู่ระบบศูนย์บัญชาการแผนที่ 3 มิติและตรวจจับการเปลี่ยนแปลง (On-Premises)
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-2.5 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="อีเมลผู้ใช้งาน (Username / Email)" required>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@geomonitor.local"
                className="pl-10"
              />
            </div>
          </FormField>

          <FormField label="รหัสผ่าน (Password)" required>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10"
              />
            </div>
          </FormField>

          <Button
            type="submit"
            disabled={isLoading}
            isLoading={isLoading}
            variant="primary"
            className="w-full mt-2 py-3 text-xs font-bold gap-2 shadow-sm"
          >
            <span>เข้าสู่ระบบ (Sign In)</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>

        {/* Quick Role Fillers for Development/Testing */}
        <div className="mt-6 pt-5 border-t border-border">
          <div className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center justify-between">
            <span>เข้าสู่ระบบด่วนตามบทบาท (Quick Roles):</span>
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <button
              type="button"
              onClick={() => handleQuickRole('admin@geomonitor.local', 'Password123!')}
              className={cn(
                'p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                email.includes('admin')
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                  : 'border-border bg-card-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="font-bold flex items-center justify-between">
                <span>ผู้ดูแลระบบ</span>
                {email.includes('admin') && <Check className="w-3 h-3 text-primary" />}
              </div>
              <div className="text-[9px] opacity-75">Role: admin</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickRole('pm@geomonitor.local', 'Password123!')}
              className={cn(
                'p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                email.includes('pm')
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                  : 'border-border bg-card-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="font-bold flex items-center justify-between">
                <span>ผู้จัดการโครงการ</span>
                {email.includes('pm') && <Check className="w-3 h-3 text-primary" />}
              </div>
              <div className="text-[9px] opacity-75">Role: project_manager</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickRole('analyst@geomonitor.local', 'Password123!')}
              className={cn(
                'p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                email.includes('analyst')
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                  : 'border-border bg-card-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="font-bold flex items-center justify-between">
                <span>นักวิเคราะห์ภาพ</span>
                {email.includes('analyst') && <Check className="w-3 h-3 text-primary" />}
              </div>
              <div className="text-[9px] opacity-75">Role: analyst</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickRole('viewer@geomonitor.local', 'Password123!')}
              className={cn(
                'p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                email.includes('viewer')
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                  : 'border-border bg-card-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="font-bold flex items-center justify-between">
                <span>ผู้ตรวจดูข้อมูล</span>
                {email.includes('viewer') && <Check className="w-3 h-3 text-primary" />}
              </div>
              <div className="text-[9px] opacity-75">Role: viewer</div>
            </button>
          </div>
        </div>
      </Card>

      <div className="mt-4 text-[10px] text-muted-foreground text-center font-mono">
        GeoMonitor 3D Enterprise On-Premises Edition • Air-Gapped Network Ready
      </div>
    </div>
  );
}
