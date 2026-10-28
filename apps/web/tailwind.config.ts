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
        // NextAdmin Semantic Design Tokens
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
          secondary: 'var(--card-secondary)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          hover: 'var(--primary-hover)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: 'var(--success-foreground)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: 'var(--warning-foreground)',
        },
        info: {
          DEFAULT: 'var(--info)',
          foreground: 'var(--info-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          border: 'var(--sidebar-border)',
          muted: 'var(--sidebar-muted)',
          'active-bg': 'var(--sidebar-active-bg)',
          'active-text': 'var(--sidebar-active-text)',
        },
        header: {
          DEFAULT: 'var(--header)',
          foreground: 'var(--header-foreground)',
          border: 'var(--header-border)',
          'search-bg': 'var(--header-search-bg)',
        },

        // Enterprise & GIS Design Tokens (Preserved for compatibility)
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
          950: '#080F20',
          900: '#101A2D',
          850: '#162238',
          800: '#1C2940',
          700: '#233552',
          600: '#2D4367',
        },
        cyan: {
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        cut: {
          DEFAULT: '#F43F5E',
          glow: 'rgba(244, 63, 94, 0.4)',
        },
        fill: {
          DEFAULT: '#10B981',
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
        'page-title': ['1.375rem', { lineHeight: '1.75rem', fontWeight: '700' }],
        'section-title': ['1.0625rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        body: ['0.9375rem', { lineHeight: '1.375rem', fontWeight: '400' }],
        button: ['0.9375rem', { lineHeight: '1.375rem', fontWeight: '600' }],
        meta: ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '400' }],
      },
      boxShadow: {
        'glow-cyan': '0 0 16px rgba(6, 182, 212, 0.3)',
        'glow-cut': '0 0 16px rgba(244, 63, 94, 0.35)',
        'glow-fill': '0 0 16px rgba(16, 185, 129, 0.35)',
        enterprise: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
};

export default config;
