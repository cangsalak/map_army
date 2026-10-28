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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`dark ${inter.variable} ${sarabun.variable}`}>
      <body className="bg-navy-950 text-slate-100 min-h-screen font-sans antialiased overflow-hidden selection:bg-cyan-500 selection:text-navy-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
