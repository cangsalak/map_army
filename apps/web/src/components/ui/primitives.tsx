'use client';

import * as React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ==========================================
// 1. BUTTON COMPONENT (NextAdmin Design)
// ==========================================
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'danger'
    | 'destructive'
    | 'success'
    | 'cyan'
    | 'surface';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'map-icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center font-medium transition-all select-none rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer active:scale-[0.98]';

    const variants: Record<string, string> = {
      primary:
        'bg-primary hover:opacity-90 text-primary-foreground shadow-sm font-semibold',
      secondary:
        'bg-secondary hover:bg-muted text-secondary-foreground border border-border shadow-sm',
      outline:
        'bg-transparent hover:bg-muted/60 text-foreground border border-border hover:border-primary/40',
      ghost:
        'bg-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground',
      danger:
        'bg-destructive hover:opacity-90 text-destructive-foreground shadow-sm font-semibold',
      destructive:
        'bg-destructive hover:opacity-90 text-destructive-foreground shadow-sm font-semibold',
      success:
        'bg-success hover:opacity-90 text-success-foreground shadow-sm font-semibold',
      cyan:
        'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30',
      surface:
        'bg-card hover:bg-card-secondary text-card-foreground border border-border shadow-sm',
    };

    const sizes: Record<string, string> = {
      sm: 'text-xs min-h-[36px] px-3.5 py-1.5 gap-1.5 rounded-lg',
      md: 'text-sm min-h-[44px] px-4 py-2.5 gap-2 rounded-xl',
      lg: 'text-base min-h-[48px] px-5 py-3 gap-2.5 rounded-xl',
      icon: 'min-h-[44px] min-w-[44px] h-11 w-11 p-2.5 rounded-xl',
      'map-icon': 'min-h-[48px] min-w-[48px] h-12 w-12 p-3 rounded-xl',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(base, variants[variant] || variants.primary, sizes[size] || sizes.md, className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="opacity-90">{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ==========================================
// 2. BADGE COMPONENT
// ==========================================
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | 'default'
    | 'primary'
    | 'cyan'
    | 'emerald'
    | 'success'
    | 'amber'
    | 'warning'
    | 'rose'
    | 'danger'
    | 'destructive'
    | 'info'
    | 'blue'
    | 'slate'
    | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants: Record<string, string> = {
    default: 'bg-primary/10 text-primary border-primary/20',
    primary: 'bg-primary/10 text-primary border-primary/20',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    emerald: 'bg-success/10 text-success border-success/30',
    success: 'bg-success/10 text-success border-success/30',
    amber: 'bg-warning/10 text-warning border-warning/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    rose: 'bg-destructive/10 text-destructive border-destructive/30',
    danger: 'bg-destructive/10 text-destructive border-destructive/30',
    destructive: 'bg-destructive/10 text-destructive border-destructive/30',
    info: 'bg-info/10 text-info border-info/30',
    blue: 'bg-info/10 text-info border-info/30',
    slate: 'bg-muted text-muted-foreground border-border',
    outline: 'bg-transparent text-muted-foreground border-border',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border tracking-wide uppercase',
        variants[variant] || variants.default,
        className
      )}
      {...props}
    />
  );
}

// ==========================================
// 3. CARD COMPONENTS
// ==========================================
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card text-card-foreground shadow-card transition-all overflow-hidden',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 p-5 border-b border-border/80', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-xs text-muted-foreground mt-1', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center p-5 pt-0 border-t border-border/80 mt-4', className)}
      {...props}
    />
  );
}

// ==========================================
// 4. FORM FIELD & INPUT PRIMITIVES
// ==========================================
export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string | null;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  required = false,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        <label className="font-semibold text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'w-full rounded-xl border border-border bg-card p-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 min-h-[88px] resize-y',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer min-h-[44px]',
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

// ==========================================
// 5. TABLE COMPONENTS
// ==========================================
export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto rounded-xl border border-border">
      <table className={cn('w-full caption-bottom text-sm border-collapse', className)} {...props} />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider', className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-border/60 bg-card', className)} {...props} />
  );
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted',
        className
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('h-11 px-4 text-left align-middle font-medium text-muted-foreground select-none', className)}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('p-4 align-middle text-foreground', className)} {...props} />;
}

export function TableEmpty({
  colSpan = 5,
  message = 'ไม่พบข้อมูลในตาราง',
}: {
  colSpan?: number;
  message?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-10 text-muted-foreground text-xs">
        {message}
      </td>
    </tr>
  );
}

// ==========================================
// 6. MODAL / DIALOG COMPONENT
// ==========================================
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}: ModalProps) {
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-foreground',
          maxWidths[maxWidth]
        )}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-card-secondary/50">
          <div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ==========================================
// 7. TABS COMPONENT
// ==========================================
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export function Tabs({
  items,
  activeTab,
  onChange,
  className,
}: {
  items: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border w-fit select-none',
        className
      )}
      role="tablist"
    >
      {items.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px]',
              isActive
                ? 'bg-card text-foreground shadow-sm border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-mono',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ==========================================
// 8. BREADCRUMBS COMPONENT
// ==========================================
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-primary transition-colors hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast && 'font-medium text-foreground')}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
