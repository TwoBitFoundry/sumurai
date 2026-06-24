import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getToastStackLayoutClassName } from '@/components/toastStack/toastStackLayout';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { Button, GlassCard } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import type { SyncAllRow } from '../types/syncAllStatus';
import { SyncStatusRow } from './SyncStatusRow';

interface SyncInstitutionStatusToastProps {
  row: SyncAllRow | null;
  onClose: () => void;
}

const AUTO_DISMISS_MS = 5000;

export function SyncInstitutionStatusToast({ row, onClose }: SyncInstitutionStatusToastProps) {
  const { breakpoint } = useViewportBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [dismissRemainingMs, setDismissRemainingMs] = useState(AUTO_DISMISS_MS);
  const hasIssues =
    row != null &&
    (row.status === 'auth_required' || row.status === 'rate_limited' || row.status === 'error');
  const canAutoDismiss =
    row != null &&
    (row.status === 'synced' || row.status === 'skipped_hidden' || row.status === 'no_accounts');
  const dismissSecondsRemaining = Math.max(Math.ceil(dismissRemainingMs / 1000), 0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!row || !canAutoDismiss || hasIssues) {
      setDismissRemainingMs(AUTO_DISMISS_MS);
      return;
    }

    setDismissRemainingMs(AUTO_DISMISS_MS);
    const dismissTimer = window.setTimeout(onClose, AUTO_DISMISS_MS);
    const countdownTimer = window.setInterval(() => {
      setDismissRemainingMs((current) => Math.max(current - 1000, 0));
    }, 1000);

    return () => {
      window.clearTimeout(dismissTimer);
      window.clearInterval(countdownTimer);
    };
  }, [canAutoDismiss, hasIssues, onClose, row]);

  if (!mounted || !row) {
    return null;
  }

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={getToastStackLayoutClassName(breakpoint)}
      data-testid="sync-institution-toast"
    >
      <GlassCard
        variant={hasIssues ? 'danger' : 'accent'}
        rounded="xl"
        padding="md"
        withInnerEffects={false}
        className="space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h2 className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}>
              Sync institution
            </h2>
            <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
              {row.status === 'syncing'
                ? `Syncing ${row.institutionName}…`
                : hasIssues
                  ? `${row.institutionName} needs attention before it is up to date.`
                  : `${row.institutionName} finished syncing.`}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="pill"
            onClick={onClose}
            disabled={row.status === 'syncing' || row.status === 'pending'}
            aria-label={
              canAutoDismiss && !hasIssues
                ? `Close sync results in ${dismissSecondsRemaining}s`
                : 'Close sync results'
            }
            title={row.status === 'syncing' ? 'Unavailable while syncing' : undefined}
            className={cn('shrink-0', canAutoDismiss && !hasIssues ? 'min-w-[4.5rem]' : 'min-w-0')}
          >
            <span className="flex items-center gap-1.5">
              <X className="shrink-0" />
              {canAutoDismiss && !hasIssues ? (
                <span className={cn(uiTypographyRecipes.caption, 'lowercase', 'tabular-nums')}>
                  {dismissSecondsRemaining}s
                </span>
              ) : null}
            </span>
          </Button>
        </div>

        <SyncStatusRow row={row} />
      </GlassCard>
    </div>,
    document.body
  );
}

export default SyncInstitutionStatusToast;
