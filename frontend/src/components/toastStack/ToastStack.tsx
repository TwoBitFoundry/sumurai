import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getToastStackLayoutClassName } from '@/components/toastStack/toastStackLayout';
import {
  formatAutoCategorizationProgressCaption,
  getAutoCategorizationProgressPercent,
} from '@/features/accounts/utils/autoCategorizationToastMessages';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { GlassCard, IconButton } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import {
  budgetProgress as budgetProgressRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

const AUTO_DISMISS_MS = 5000;

export type ToastStackTransientItem = {
  id: string;
  message: string;
  type?: 'error' | 'success';
};

export type ToastStackProgress = {
  processed: number;
  total: number;
};

export type ToastStackPinnedToast = {
  message: string;
  autoDismiss: boolean;
  progress?: ToastStackProgress;
};

type ToastProgressBarProps = {
  processed: number;
  total: number;
};

function ToastProgressBar({ processed, total }: ToastProgressBarProps) {
  const percent = getAutoCategorizationProgressPercent(processed, total);
  const fillWidthPercent = percent > 0 && percent < 4 ? 4 : percent;

  return (
    <div className={cn('space-y-1.5')}>
      <div
        className={cn(...budgetProgressRecipes.track)}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label="Categorization progress"
      >
        <div
          className={cn(...budgetProgressRecipes.fillBase, ...budgetProgressRecipes.fillWithin)}
          style={{ width: `${fillWidthPercent}%` }}
        />
      </div>
      <div className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted, 'tabular-nums')}>
        {formatAutoCategorizationProgressCaption(processed, total)}
      </div>
    </div>
  );
}

type ToastCardProps = {
  message: string;
  progress?: ToastStackProgress;
  onClose: () => void;
  autoDismiss: boolean;
  dismissKey: string;
  type?: 'error' | 'success';
};

function ToastCard({ message, progress, onClose, autoDismiss, dismissKey, type }: ToastCardProps) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: dismissKey resets the dismiss timer intentionally
  useEffect(() => {
    if (!autoDismiss) {
      return;
    }
    const id = window.setTimeout(onClose, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [autoDismiss, dismissKey, onClose]);

  const isError = type === 'error';

  return (
    <GlassCard
      variant={isError ? 'danger' : 'accent'}
      rounded="xl"
      padding="md"
      className={cn('relative', 'flex', 'items-start', 'gap-4', 'pr-12')}
      withInnerEffects={false}
    >
      <div className={cn('min-w-0', 'flex-1', progress ? 'space-y-2.5' : undefined)}>
        <div
          className={cn(
            progress ? undefined : 'whitespace-normal break-words',
            uiTypographyRecipes.captionStrong,
            isError ? uiTextRecipes.danger : uiTextRecipes.primary
          )}
        >
          {message}
        </div>
        {progress ? (
          <ToastProgressBar processed={progress.processed} total={progress.total} />
        ) : null}
      </div>
      <IconButton
        type="button"
        variant="ghost"
        size="sm"
        className={cn('absolute', 'right-3', 'top-3', 'shrink-0')}
        onClick={onClose}
        aria-label="Close toast"
      >
        <X />
      </IconButton>
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

  const pinnedDismissKey = pinnedToast?.progress
    ? `${pinnedToast.message}:${pinnedToast.progress.processed}:${pinnedToast.progress.total}`
    : pinnedToast?.message;

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
          progress={pinnedToast.progress}
          onClose={onDismissPinned}
          autoDismiss={pinnedToast.autoDismiss}
          dismissKey={pinnedDismissKey ?? pinnedToast.message}
        />
      ) : null}
      {transients.map((toast) => (
        <ToastCard
          key={toast.id}
          message={toast.message}
          onClose={() => onDismissTransient(toast.id)}
          autoDismiss
          dismissKey={`${toast.id}:${toast.message}`}
          type={toast.type}
        />
      ))}
    </div>,
    document.body
  );
}
