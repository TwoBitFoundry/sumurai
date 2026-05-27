'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/ui/primitives';
import { modalBackdrop } from '@/ui/recipes';

export function ProviderSdkLaunchBackdrop({ active }: { active: boolean }) {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (active) {
      document.body.dataset.providerSdkInset = 'active';
      return () => {
        delete document.body.dataset.providerSdkInset;
      };
    }

    delete document.body.dataset.providerSdkInset;
    return undefined;
  }, [active]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      data-testid="provider-sdk-launch-backdrop"
      aria-hidden
      className={cn(
        'pointer-events-none',
        'fixed',
        'inset-0',
        'z-40',
        'transition-opacity',
        'duration-200',
        active ? [...modalBackdrop.provider, 'opacity-100'] : 'opacity-0'
      )}
    />,
    document.body
  );
}

export default ProviderSdkLaunchBackdrop;
