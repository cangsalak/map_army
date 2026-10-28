'use client';

import React, { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { AreaFeature } from '../map/CesiumMap';
import { cn } from '../ui/primitives';

interface DashboardLayoutProps {
  children: React.ReactNode;
  areas?: AreaFeature[];
  selectedAreaId?: string | null;
  onSelectArea?: (id: string) => void;
  onOpenCreateArea?: () => void;
  className?: string;
  noPadding?: boolean;
}

export default function DashboardLayout({
  children,
  areas = [],
  selectedAreaId,
  onSelectArea,
  onOpenCreateArea,
  className,
  noPadding = false,
}: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans selection:bg-primary selection:text-white transition-colors duration-150">
      {/* 1. Left Full-Height NextAdmin Sidebar */}
      <Sidebar
        areas={areas}
        selectedAreaId={selectedAreaId}
        onSelectArea={onSelectArea}
        onOpenCreateArea={onOpenCreateArea}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 2. Right Workspace Container: Top Navbar + Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* NextAdmin Header */}
        <Navbar
          areas={areas}
          selectedAreaId={selectedAreaId}
          onSelectArea={onSelectArea}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Dynamic Content Canvas */}
        <main
          className={cn(
            'flex-1 bg-background text-foreground transition-all duration-200 min-w-0',
            noPadding ? 'p-0 overflow-hidden flex flex-col h-full' : 'overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6',
            className
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
