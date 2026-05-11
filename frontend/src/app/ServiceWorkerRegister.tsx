'use client';

import { useEffect } from 'react';
import { registerProductionServiceWorker } from '@/pwa/registerProductionServiceWorker';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    void registerProductionServiceWorker({
      register: (url, options) => navigator.serviceWorker.register(url, options),
      fetch: (input, init) => fetch(input, init),
      hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    });
  }, []);
  return null;
}
