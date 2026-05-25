import type { Metadata, Viewport } from 'next';
import { PWA_THEME_COLOR, pwaMetadataIcons } from '@/pwa/manifestConstants';
import ServiceWorkerRegister from './ServiceWorkerRegister';
import './globals.css';

export const viewport: Viewport = {
  themeColor: PWA_THEME_COLOR,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Sumurai',
  description: 'Personal finance with provider-aware onboarding',
  icons: pwaMetadataIcons(),
  appleWebApp: {
    capable: true,
    title: 'Sumurai',
    statusBarStyle: 'black-translucent',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <ServiceWorkerRegister />
        <div id="app-shell" className="min-h-dvh">
          {children}
        </div>
      </body>
    </html>
  );
}
