'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { cn } from '@/ui/primitives';
import { modalBackdrop } from '@/ui/recipes';

export function ProviderSdkLaunchBackdrop({ active }: { active: boolean }) {
  const { breakpoint } = useViewportBreakpoint();

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (active && breakpoint !== 'desktop') {
      document.body.dataset.providerSdkInset = breakpoint;
      return;
    }

    delete document.body.dataset.providerSdkInset;
  }, [active, breakpoint]);

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        delete document.body.dataset.providerSdkInset;
      }
    };
  }, []);

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
