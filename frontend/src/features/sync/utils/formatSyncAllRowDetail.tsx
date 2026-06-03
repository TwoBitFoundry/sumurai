import type React from 'react';
import { SIMPLEFIN_BRIDGE_ACCOUNT_URL } from '@/features/simplefin/constants';
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import type { SyncAllRow } from '../types/syncAllStatus';

const formatRateLimitCopy = (retryAfterSeconds: number | null): string => {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) {
    return 'Daily sync limit reached. Try again tomorrow.';
  }

  const nextRetry = new Date(Date.now() + retryAfterSeconds * 1000);
  const localTime = nextRetry.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `Daily sync limit reached. Try again tomorrow after ${localTime}.`;
};

export function formatSyncAllRowDetail(row: SyncAllRow): React.ReactNode {
  if (row.status === 'synced') {
    if (typeof row.transactionCount === 'number') {
      return `Synced ${row.transactionCount} new transaction${row.transactionCount === 1 ? '' : 's'}`;
    }

    return 'Synced successfully';
  }

  if (row.status === 'skipped_hidden') {
    return row.detail ?? 'Hidden institution was skipped';
  }

  if (row.status === 'no_accounts') {
    return row.detail ?? 'No accounts were returned for this institution.';
  }

  if (row.status === 'rate_limited') {
    return formatRateLimitCopy(row.retryAfterSeconds);
  }

  if (row.status === 'auth_required') {
    if (row.provider !== 'simplefin') {
      return row.detail ?? 'Re-authenticate this institution to continue syncing.';
    }

    return (
      <span className={cn(uiTypographyRecipes.caption, uiTextRecipes.body)}>
        {row.detail ?? 'Re-authenticate in your SimpleFIN dashboard.'}{' '}
        <a
          href={SIMPLEFIN_BRIDGE_ACCOUNT_URL}
          target="_blank"
          rel="noreferrer"
          className={cn(uiTextRecipes.accent, 'underline', 'underline-offset-2')}
        >
          Open dashboard
        </a>
        .
      </span>
    );
  }

  return row.detail ?? null;
}
