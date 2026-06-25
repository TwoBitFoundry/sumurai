import { AlertTriangle, CheckCircle2, Clock3, Loader2, XCircle } from 'lucide-react';
import type React from 'react';
import { cn } from '@/ui/primitives/utils';
import { syncStatusRow, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import type { SyncAllRow } from '../types/syncAllStatus';
import { formatSyncAllRowDetail } from '../utils/formatSyncAllRowDetail';

const statusIconMap: Record<SyncAllRow['status'], React.ReactNode> = {
  pending: <Clock3 className={cn('h-4', 'w-4')} />,
  syncing: <Loader2 className={cn('h-4', 'w-4', 'animate-spin')} />,
  synced: <CheckCircle2 className={cn('h-4', 'w-4')} />,
  auth_required: <AlertTriangle className={cn('h-4', 'w-4')} />,
  rate_limited: <Clock3 className={cn('h-4', 'w-4')} />,
  error: <XCircle className={cn('h-4', 'w-4')} />,
  skipped_hidden: <Clock3 className={cn('h-4', 'w-4')} />,
  no_accounts: <Clock3 className={cn('h-4', 'w-4')} />,
};

const statusTextClass: Record<SyncAllRow['status'], string> = {
  pending: uiTextRecipes.muted,
  syncing: uiTextRecipes.info,
  synced: uiTextRecipes.success,
  auth_required: uiTextRecipes.warning,
  rate_limited: uiTextRecipes.warning,
  error: uiTextRecipes.danger,
  skipped_hidden: uiTextRecipes.subtle,
  no_accounts: uiTextRecipes.subtle,
};

export function SyncStatusRow({ row }: { row: SyncAllRow }) {
  return (
    <div
      data-testid="sync-status-row"
      className={cn(...syncStatusRow.shell, 'flex', 'items-start', 'gap-3', 'px-3', 'py-2.5')}
    >
      <span className={cn('mt-0.5', statusTextClass[row.status])}>{statusIconMap[row.status]}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(uiTypographyRecipes.bodyStrong, syncStatusRow.institutionName)}>
            {row.institutionName}
          </span>
          <span
            className={cn(uiTypographyRecipes.caption, statusTextClass[row.status], 'capitalize')}
          >
            {row.status.replace('_', ' ')}
          </span>
        </div>
        <div className={cn(uiTypographyRecipes.caption, syncStatusRow.detail)}>
          {formatSyncAllRowDetail(row)}
        </div>
      </div>
    </div>
  );
}

export default SyncStatusRow;
