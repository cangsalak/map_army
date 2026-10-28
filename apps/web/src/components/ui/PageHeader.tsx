'use client';

import React from 'react';
import { Breadcrumbs, BreadcrumbItem, cn } from './primitives';

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border',
        className
      )}
    >
      <div className="space-y-1.5">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="mb-2">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-sm">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
