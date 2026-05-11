'use client';

import { useEffect } from 'react';
import { registerProductionServiceWorker } from '@/pwa/registerProductionServiceWorker';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    void registerProductionServiceWorker({
      register: (url, options) => navigator.serviceWorker.register(url, options),
      isProduction: process.env.NODE_ENV === 'production',
      hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    });
  }, []);
  return null;
}
