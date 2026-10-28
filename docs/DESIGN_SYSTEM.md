# GeoMonitor 3D — Global Design System Specification

> **Reference Baseline**: NextAdmin Design System (https://demo.nextadmin.co/)  
> **Status**: Active & Implemented  
> **Last Updated**: October 2026

---

## 1. Overview & Architectural Philosophy

GeoMonitor 3D unites all administrative, mission planning, tactical analysis, and GIS operations under a unified **NextAdmin-inspired Design System**. Prior to this unification, disparate pages used diverging color palettes, hardcoded gradients, varying border radii, and fragmented modal styles.

The Design System achieves:
- **Centralized Semantic Tokens**: 100% of surface, text, border, and interaction colors derive from CSS variables mapped into Tailwind CSS utilities.
- **Dual Mode (Light & Dark)**: Full seamless switching between Dark (Navy/Slate) and Light (Clean White/Zinc) modes without hydration mismatch or theme flash.
- **Strict Canvas Protection**: Complete isolation of CesiumJS WebGL 3D globe canvases and HUD overlays from global styling bleed.
- **Component Uniformity**: Universal adoption of shared primitives (`Button`, `Card`, `Table`, `Badge`, `Modal`, `FormField`, `PageHeader`, `DashboardLayout`).

---

## 2. Color Palette & Semantic Tokens

### 2.1 CSS Variables Definition (`globals.css`)

Tokens are declared on `:root` (Light mode) and `.dark` (Dark mode):

```css
:root {
  /* Core Base Colors (Light Mode) */
  --background: #F8FAFC;         /* slate-50 */
  --foreground: #0F172A;         /* slate-900 */
  --card: #FFFFFF;               /* pure white */
  --card-foreground: #0F172A;
  --popover: #FFFFFF;
  --popover-foreground: #0F172A;
  
  /* Brand / Primary */
  --primary: #0284C7;            /* sky-600 */
  --primary-hover: #0369A1;      /* sky-700 */
  --primary-foreground: #FFFFFF;
  
  /* Secondary / Surface */
  --secondary: #F1F5F9;          /* slate-100 */
  --secondary-hover: #E2E8F0;    /* slate-200 */
  --secondary-foreground: #1E293B;/* slate-800 */
  
  /* Muted / Subdued */
  --muted: #F1F5F9;
  --muted-foreground: #64748B;   /* slate-500 */
  
  /* Borders, Dividers & Inputs */
  --border: #E2E8F0;             /* slate-200 */
  --input: #F8FAFC;
  --input-border: #CBD5E1;       /* slate-300 */
  --ring: #0284C7;               /* sky-600 focus ring */
  
  /* Semantic Status Indicators */
  --destructive: #EF4444;        /* red-500 */
  --destructive-foreground: #FFFFFF;
  --success: #10B981;            /* emerald-500 */
  --success-foreground: #FFFFFF;
  --warning: #F59E0B;            /* amber-500 */
  --warning-foreground: #FFFFFF;
  --info: #06B6D4;               /* cyan-500 */
  --info-foreground: #FFFFFF;
  
  /* NextAdmin Layout Elements */
  --sidebar: #FFFFFF;
  --sidebar-foreground: #1E293B;
  --sidebar-border: #E2E8F0;
  --sidebar-active: #F0F9FF;     /* sky-50 */
  --sidebar-active-foreground: #0284C7;
  
  --header: #FFFFFF;
  --header-foreground: #0F172A;
  --header-border: #E2E8F0;
}

.dark {
  /* Core Base Colors (Dark Mode — NextAdmin Deep Slate/Navy) */
  --background: #0B132B;         /* deep navy/slate-950 */
  --foreground: #F8FAFC;         /* slate-50 */
  --card: #111C44;               /* navy card container */
  --card-foreground: #F8FAFC;
  --popover: #111C44;
  --popover-foreground: #F8FAFC;
  
  /* Brand / Primary */
  --primary: #38BDF8;            /* sky-400 */
  --primary-hover: #0EA5E9;      /* sky-500 */
  --primary-foreground: #0B132B;
  
  /* Secondary / Surface */
  --secondary: #1C2B59;          /* slate-800 tint */
  --secondary-hover: #243469;
  --secondary-foreground: #F1F5F9;
  
  /* Muted / Subdued */
  --muted: #162447;
  --muted-foreground: #94A3B8;   /* slate-400 */
  
  /* Borders, Dividers & Inputs */
  --border: #1F2E5C;             /* subtle navy border */
  --input: #0E1738;
  --input-border: #23356A;
  --ring: #38BDF8;               /* sky-400 focus ring */
  
  /* Semantic Status Indicators */
  --destructive: #F87171;        /* red-400 */
  --destructive-foreground: #FFFFFF;
  --success: #34D399;            /* emerald-400 */
  --success-foreground: #0B132B;
  --warning: #FBBF24;            /* amber-400 */
  --warning-foreground: #0B132B;
  --info: #22D3EE;               /* cyan-400 */
  --info-foreground: #0B132B;
  
  /* NextAdmin Layout Elements */
  --sidebar: #0D1638;
  --sidebar-foreground: #94A3B8;
  --sidebar-border: #1A2854;
  --sidebar-active: #162657;
  --sidebar-active-foreground: #38BDF8;
  
  --header: #0D1638;
  --header-foreground: #F8FAFC;
  --header-border: #1A2854;
}
```

### 2.2 Tailwind CSS Mappings (`tailwind.config.ts`)

All CSS variables are accessible via standard Tailwind classes:
- Backgrounds: `bg-background`, `bg-card`, `bg-secondary`, `bg-sidebar`, `bg-header`, `bg-primary`, `bg-destructive`, `bg-success`
- Text: `text-foreground`, `text-muted-foreground`, `text-primary`, `text-secondary-foreground`, `text-destructive`, `text-success`
- Borders: `border-border`, `border-sidebar-border`, `border-header-border`, `border-input-border`
- Rings & Focus: `focus:ring-ring`, `focus:ring-primary`

---

## 3. Typography Hierarchy

The system defines bilingual font families:
- **Latin Font**: Inter (loaded via Google Fonts in Next.js Font Optimization)
- **Thai Font**: Sarabun (loaded via Google Fonts, ensuring flawless glyph rendering and zero mojibake)

### Type Scale

| Level | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title** | `text-2xl` (1.5rem / 24px) | `font-bold` (700) | 1.25 | Main page title inside `PageHeader` |
| **Section Title** | `text-lg` (1.125rem / 18px) | `font-semibold` (600) | 1.35 | Card titles, modal headers, table titles |
| **Subtitle / Description** | `text-sm` (0.875rem / 14px) | `font-normal` (400) | 1.5 | Subtext in `PageHeader`, helper descriptions |
| **Body** | `text-sm` (0.875rem / 14px) | `font-normal` (400) | 1.5 | Standard copy, table cell content, forms |
| **Caption / Meta** | `text-xs` (0.75rem / 12px) | `font-medium` (500) | 1.4 | Badges, timestamps, breadcrumbs, tags |
| **HUD Metric** | `text-xl` to `text-3xl` | `font-mono font-bold` | 1.1 | Numerical telemetry, coordinates, areas |

---

## 4. Spacing, Geometry & Shadows

Following NextAdmin standard specifications:
- **Page Container Padding**: `p-4 sm:p-6 lg:p-8`
- **Card Padding**: `p-5 sm:p-6`
- **Flex & Grid Gap**: `gap-4 sm:gap-6`
- **Border Radius**:
  - Buttons, Inputs, Badges: `rounded-xl` (12px)
  - Cards, Containers, Modals: `rounded-2xl` (16px)
  - Inner tags/pills: `rounded-full` (9999px)
- **Border Width**: Standard `1px` crisp border (`border border-border`)
- **Shadows**:
  - Standard Card: `shadow-sm`
  - Floating Panels / Dropdowns: `shadow-lg`
  - Modals / Dialogs: `shadow-2xl`

---

## 5. Theme State & Hydration Strategy

1. **Storage Persistence**:
   - Stored in `localStorage` under the key `'geomonitor_theme'`.
   - Permitted values: `'light' | 'dark'`.
   - Default: `'dark'` (optimized for military GIS operations and nighttime flight tracking).

2. **Zero-Flash Pre-hydration Script**:
   - `apps/web/src/app/layout.tsx` embeds a synchronous `<script>` in `<head>` that runs before DOM render:
   ```javascript
   (function() {
     try {
       var t = localStorage.getItem('geomonitor_theme') || 'dark';
       if (t === 'dark') {
         document.documentElement.classList.add('dark');
       } else {
         document.documentElement.classList.remove('dark');
       }
     } catch (e) {}
   })()
   ```
   - `html` has `suppressHydrationWarning` to eliminate server-client hydration divergence warnings.

3. **Context Hook**:
   - Components interact with the theme using `useTheme()` from `@/lib/theme-context`:
   ```tsx
   const { theme, toggleTheme, setTheme } = useTheme();
   ```

---

## 6. Layout Specifications

### 6.1 `DashboardLayout`
Used for all administrative, management, and reporting routes:
- **Sidebar**:
  - Left-docked, fixed height `h-screen`, `sticky top-0`.
  - Expanded width: `w-64` (256px).
  - Collapsed width: `w-20` (80px).
  - Groups: Operations, Mission Data, System & Security.
  - Active item indicator: Left sky-400 accent bar with tinted background pill.
- **Header (`Navbar`)**:
  - Height: `h-16` (64px).
  - Sticky top with backdrop blur (`backdrop-blur-md bg-header/90`).
  - Contains: Live status indicator, quick action shortcuts, `ThemeToggle`, and User/Logout menu.
- **Main Viewport**:
  - Auto scrollable (`flex-1 overflow-y-auto`).
  - Standardized max-width container (`max-w-7xl mx-auto`).

### 6.2 Specialized Fullscreen GIS Layout
Used for `/`, `/missions`, and `/operations/map`:
- Edge-to-edge canvas container with strict zero margin/padding.
- Floating HUDs and side-drawers positioned with absolute/fixed coordinates.
- `.cesium-viewer-bottom { display: none !important; }` protects navigation ergonomics.
- Explicit initial Cesium camera bearing locked to `-90°` / `270°` for consistent orientation.
