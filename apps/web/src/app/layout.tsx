import type { Metadata } from 'next';
import { Inter, Sarabun } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sarabun = Sarabun({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  variable: '--font-sarabun',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GeoMonitor 3D — ระบบติดตามและวิเคราะห์การเปลี่ยนแปลงพื้นที่ 3 มิติจากภาพถ่ายโดรน',
  description:
    'แพลตฟอร์มภูมิสารสนเทศ 3 มิติระดับโปรดักชันสำหรับการติดตามการเปลี่ยนแปลงพื้นที่ วิเคราะห์ภาพถ่ายและระดับความสูงจากโดรน คำนวณปริมาตรงานดินขุดถม (Cut/Fill)',
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('geomonitor_theme');
    var isDark = stored ? stored === 'dark' : false;
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.style.colorScheme = 'light';
    }
  } catch (e) {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${inter.variable} ${sarabun.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background text-foreground min-h-screen font-sans antialiased overflow-hidden selection:bg-primary selection:text-white transition-colors duration-150">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
