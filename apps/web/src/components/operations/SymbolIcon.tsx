'use client';

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { MapPin } from 'lucide-react';

interface SymbolIconProps {
  iconKey?: string;
  svgContent?: string | null;
  className?: string;
  size?: number;
  color?: string;
}

// Convert kebab-case (e.g. 'map-pin') to PascalCase (e.g. 'MapPin')
function kebabToPascal(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

export function SymbolIcon({
  iconKey,
  svgContent,
  className = '',
  size = 20,
  color,
}: SymbolIconProps) {
  // If custom SVG content exists, render sanitized SVG directly
  if (svgContent && svgContent.trim().startsWith('<svg')) {
    return (
      <div
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size, color }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    );
  }

  if (iconKey) {
    const componentName = kebabToPascal(iconKey);
    const IconComponent = (LucideIcons as Record<string, any>)[componentName] || (LucideIcons as Record<string, any>)[iconKey];

    if (IconComponent && typeof IconComponent === 'function') {
      return <IconComponent size={size} color={color} className={className} />;
    }
  }

  return <MapPin size={size} color={color} className={className} />;
}

/**
 * Helper to generate an SVG data URL for Cesium billboard rendering
 */
export function getSymbolSvgDataUrl(
  iconKey: string,
  color: string = '#00f0ff',
  size: number = 32,
  svgContent?: string | null
): string {
  if (svgContent && svgContent.trim().startsWith('<svg')) {
    // If it's custom SVG, encode it
    const encoded = encodeURIComponent(svgContent);
    return `data:image/svg+xml;charset=utf-8,${encoded}`;
  }

  // Fallback to simple colored circle with pin marker
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
