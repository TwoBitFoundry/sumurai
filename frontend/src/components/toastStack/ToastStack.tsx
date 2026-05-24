import type React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getToastStackLayoutClassName } from '@/components/toastStack/toastStackLayout';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { Button, GlassCard } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

const AUTO_DISMISS_MS = 5000;

export type ToastStackTransientItem = {
  id: string;
  message: string;
};

export type ToastStackPinnedToast = {
  message: string;
  autoDismiss: boolean;
};

type ToastCardProps = {
  message: string;
  onClose: () => void;
  autoDismiss: boolean;
  dismissKey: string;
};

function ToastCard({ message, onClose, autoDismiss, dismissKey }: ToastCardProps) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: dismissKey resets the dismiss timer intentionally
  useEffect(() => {
    if (!autoDismiss) {
      return;
    }
    const id = window.setTimeout(onClose, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [autoDismiss, dismissKey, onClose]);

  return (
    <GlassCard
      variant="accent"
      rounded="xl"
      padding="md"
      className={cn('flex', 'items-start', 'gap-4')}
      withInnerEffects={false}
    >
      <div
        className={cn(
          'flex-1',
          'whitespace-normal',
          'break-words',
          uiTypographyRecipes.captionStrong,
          uiTextRecipes.primary
        )}
      >
        {message}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={cn('shrink-0', 'uppercase', 'tracking-[0.2em]')}
        onClick={onClose}
      >
        Close
      </Button>
    </GlassCard>
  );
}

export type ToastStackProps = {
  transients: ToastStackTransientItem[];
  pinnedToast: ToastStackPinnedToast | null;
  onDismissTransient: (id: string) => void;
  onDismissPinned: () => void;
};

export function ToastStack({
  transients,
  pinnedToast,
  onDismissTransient,
  onDismissPinned,
}: ToastStackProps) {
  const [mounted, setMounted] = useState(false);
  const { breakpoint } = useViewportBreakpoint();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || (transients.length === 0 && !pinnedToast)) {
    return null;
  }

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={getToastStackLayoutClassName(breakpoint)}
      data-testid="toast-stack"
      data-breakpoint={breakpoint}
    >
      {pinnedToast ? (
        <ToastCard
          message={pinnedToast.message}
          onClose={onDismissPinned}
          autoDismiss={pinnedToast.autoDismiss}
          dismissKey={pinnedToast.message}
        />
      ) : null}
      {transients.map((toast) => (
        <ToastCard
          key={toast.id}
          message={toast.message}
          onClose={() => onDismissTransient(toast.id)}
          autoDismiss
          dismissKey={`${toast.id}:${toast.message}`}
        />
      ))}
    </div>,
    document.body
  );
}
