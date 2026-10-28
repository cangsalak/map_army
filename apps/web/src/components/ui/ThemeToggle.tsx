'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { cn } from './primitives';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={cn(
        'relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-border bg-card hover:bg-card-secondary text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm cursor-pointer',
        className
      )}
      title={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง (Light Mode)' : 'เปลี่ยนเป็นโหมดมืด (Dark Mode)'}
      aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45 duration-300" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700 transition-transform hover:-rotate-12 duration-300" />
      )}
    </button>
  );
}
