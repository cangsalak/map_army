import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Enterprise Design Tokens
        app: {
          bg: '#080F20',
          panel: '#101A2D',
          'panel-secondary': '#162238',
          surface: '#1C2940',
          border: 'rgba(148, 163, 184, 0.20)',
          ring: '#22D3EE',
        },
        enterprise: {
          bg: '#080F20',
          panel: '#101A2D',
          panelSecondary: '#162238',
          surface: '#1C2940',
          accent: '#06B6D4',
          accentSecondary: '#3B82F6',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#F43F5E',
          text: '#F1F5F9',
          textSecondary: '#CBD5E1',
          textMuted: '#94A3B8',
          border: 'rgba(148, 163, 184, 0.20)',
          ring: '#22D3EE',
        },
        navy: {
          950: '#080F20', // Harmonized Application Background
          900: '#101A2D', // Primary Panel
          850: '#162238', // Secondary Panel
          800: '#1C2940', // Elevated Surface
          700: '#233552',
          600: '#2D4367',
        },
        cyan: {
          300: '#67e8f9',
          400: '#22d3ee', // Focus Ring
          500: '#06b6d4', // Primary Accent
          600: '#0891b2',
        },
        cut: {
          DEFAULT: '#F43F5E', // Danger / Cut
          glow: 'rgba(244, 63, 94, 0.4)',
        },
        fill: {
          DEFAULT: '#10B981', // Success / Fill
          glow: 'rgba(16, 185, 129, 0.4)',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-sarabun)',
          'var(--font-inter)',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'page-title': ['1.375rem', { lineHeight: '1.75rem', fontWeight: '700' }], // 22px
        'section-title': ['1.0625rem', { lineHeight: '1.5rem', fontWeight: '600' }], // 17px
        body: ['0.9375rem', { lineHeight: '1.375rem', fontWeight: '400' }], // 15px
        button: ['0.9375rem', { lineHeight: '1.375rem', fontWeight: '600' }], // 15px
        meta: ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '400' }], // 13px
      },
      boxShadow: {
        'glow-cyan': '0 0 16px rgba(6, 182, 212, 0.3)',
        'glow-cut': '0 0 16px rgba(244, 63, 94, 0.35)',
        'glow-fill': '0 0 16px rgba(16, 185, 129, 0.35)',
        enterprise: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
      },
    },
  },
  plugins: [],
};

export default config;
