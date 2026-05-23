import type React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button, GlassCard } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

interface ToastProps {
  message: string;
  onClose: () => void;
}

const AUTO_DISMISS_MS = 5000;

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: message resets the dismiss timer intentionally
  useEffect(() => {
    const id = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [message, onClose]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed',
        'z-[60]',
        'max-w-sm',
        'right-[calc(1rem+env(safe-area-inset-right))]',
        'bottom-[calc(5.75rem+env(safe-area-inset-bottom))]',
        'md:right-6',
        'md:bottom-6'
      )}
    >
      <GlassCard
        variant="accent"
        rounded="xl"
        padding="md"
        className={cn('flex', 'items-center', 'gap-4')}
        withInnerEffects={false}
      >
        <div className={cn('flex-1', uiTypographyRecipes.captionStrong, uiTextRecipes.primary)}>
          {message}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn('uppercase', 'tracking-[0.2em]')}
          onClick={onClose}
        >
          Close
        </Button>
      </GlassCard>
    </div>,
    document.body
  );
};
