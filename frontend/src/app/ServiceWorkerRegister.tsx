'use client';

import { useEffect } from 'react';
import { registerProductionServiceWorker } from '@/pwa/registerProductionServiceWorker';
import { resetDevelopmentServiceWorkers } from '@/pwa/resetDevelopmentServiceWorkers';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        void resetDevelopmentServiceWorkers({
          getRegistrations: () => navigator.serviceWorker.getRegistrations(),
          hasController: navigator.serviceWorker.controller != null,
          reload: () => window.location.reload(),
          getReloadMarker: () => window.sessionStorage.getItem('sumurai-dev-sw-reset'),
          setReloadMarker: (value) => window.sessionStorage.setItem('sumurai-dev-sw-reset', value),
          clearReloadMarker: () => window.sessionStorage.removeItem('sumurai-dev-sw-reset'),
        });
      }
      return;
    }

    void registerProductionServiceWorker({
      register: (url, options) => navigator.serviceWorker.register(url, options),
      fetch: (input, init) => fetch(input, init),
      hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      isProduction: process.env.NODE_ENV === 'production',
    });
  }, []);
  return null;
}
