import * as React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Enterprise Button Primitive (Min 44x44px Touch Target)
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'cyan' | 'surface';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'map-icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-semibold transition-all select-none rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080F20] disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const variants = {
      primary:
        'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold shadow-glow-cyan active:scale-[0.98]',
      cyan:
        'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 active:scale-[0.98]',
      secondary:
        'bg-[#162238] hover:bg-[#1C2940] text-[#F1F5F9] border border-[rgba(148,163,184,0.20)] active:scale-[0.98]',
      surface:
        'bg-[#1C2940] hover:bg-[#233552] text-[#F1F5F9] border border-[rgba(148,163,184,0.25)] active:scale-[0.98]',
      outline:
        'bg-transparent hover:bg-[#162238] text-[#CBD5E1] hover:text-white border border-[rgba(148,163,184,0.25)] hover:border-cyan-500/40 active:scale-[0.98]',
      ghost:
        'bg-transparent hover:bg-[#162238] text-[#94A3B8] hover:text-[#F1F5F9] active:scale-[0.98]',
      danger:
        'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 hover:border-rose-400 active:scale-[0.98]',
    };

    const sizes = {
      sm: 'text-xs min-h-[44px] px-3.5 py-2 gap-2',
      md: 'text-sm min-h-[44px] px-4 py-2.5 gap-2.5',
      lg: 'text-base min-h-[48px] px-5 py-3 gap-3',
      icon: 'min-h-[44px] min-w-[44px] h-11 w-11 p-2.5',
      'map-icon': 'min-h-[48px] min-w-[48px] h-12 w-12 p-3',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="opacity-80">{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';

// Badge Primitive
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate' | 'outline';
}

export function Badge({ className, variant = 'cyan', ...props }: BadgeProps) {
  const variants = {
    cyan: 'bg-cyan-950/70 text-cyan-400 border-cyan-500/40 shadow-glow-cyan',
    emerald: 'bg-emerald-950/70 text-emerald-400 border-emerald-500/40 shadow-glow-fill',
    amber: 'bg-amber-950/70 text-amber-400 border-amber-500/40',
    rose: 'bg-rose-950/70 text-rose-400 border-rose-500/40 shadow-glow-cut',
    slate: 'bg-[#1C2940] text-[#CBD5E1] border-[rgba(148,163,184,0.20)]',
    outline: 'bg-transparent text-[#CBD5E1] border-[rgba(148,163,184,0.30)]',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold tracking-wide border uppercase',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

// Card Primitive
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'gis-panel rounded-2xl border border-[rgba(148,163,184,0.20)] text-[#F1F5F9] shadow-enterprise overflow-hidden',
        className
      )}
      {...props}
    />
  );
}

// Accessible Form Field Component
export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string | null;
  children: React.ReactNode;
}

export function FormField({ label, required = false, error, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <label className="font-semibold text-[#CBD5E1]">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
        {hint && <span className="text-[11px] text-[#94A3B8]">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
    </div>
  );
}
