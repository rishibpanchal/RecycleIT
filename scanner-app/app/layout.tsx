import type { Metadata, Viewport } from 'next';
import './globals.css';
import PWARegister from '@/components/PWARegister';
import InstallBanner from '@/components/InstallBanner';

export const metadata: Metadata = {
  title: 'RacePass Scanner',
  description: 'On-ground event check-in & QR scanner for RacePass ground personnel',
  manifest: '/manifest.json',
  applicationName: 'RacePass Scanner',
  keywords: ['racepass', 'scanner', 'qr', 'checkin', 'event'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RacePass Scanner',
    startupImage: '/icons/icon-512.png',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#ffffff' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  viewportFit: 'cover',
  interactiveWidget: 'resizes-visual',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Apple-specific PWA tags not covered by Next.js metadata */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RacePass" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />

        {/* Prevent phone number formatting */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body style={{ margin: 0, background: '#ffffff', overscrollBehavior: 'none' }}>
        {children}
        <InstallBanner />
        <PWARegister />
      </body>
    </html>
  );
}
