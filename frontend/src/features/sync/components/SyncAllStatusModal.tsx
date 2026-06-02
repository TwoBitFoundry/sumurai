import { AlertTriangle, CheckCircle2, Clock3, Loader2, XCircle } from 'lucide-react';
import type React from 'react';
import { Button, cn, GlassCard, Modal } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import type { SyncAllRow } from '../types/syncAllStatus';
import { formatSyncAllRowDetail } from '../utils/formatSyncAllRowDetail';

interface SyncAllStatusModalProps {
  isOpen: boolean;
  syncingAll: boolean;
  rows: SyncAllRow[];
  onClose: () => void;
}

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

export function SyncAllStatusModal({ isOpen, syncingAll, rows, onClose }: SyncAllStatusModalProps) {
  const hasIssues = rows.some(
    (row) =>
      row.status === 'auth_required' || row.status === 'rate_limited' || row.status === 'error'
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy="sync-all-modal-title" size="lg">
      <GlassCard
        variant="accent"
        rounded="xl"
        padding="lg"
        withInnerEffects={false}
        className="space-y-6"
      >
        <div className="space-y-2">
          <h2
            id="sync-all-modal-title"
            className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}
          >
            Sync all institutions
          </h2>
          <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
            {syncingAll
              ? 'Syncing institutions one by one. Completed rows will update as each request settles.'
              : hasIssues
                ? 'Some institutions need attention before all data is up to date.'
                : 'All institutions finished syncing.'}
          </p>
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className={cn(
                'flex',
                'items-start',
                'gap-3',
                'rounded-2xl',
                'border',
                ...uiBorderRecipes.elevatedGlass,
                'px-4',
                'py-3'
              )}
            >
              <span className={cn('mt-0.5', statusTextClass[row.status])}>
                {statusIconMap[row.status]}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.primary)}>
                    {row.institutionName}
                  </span>
                  <span
                    className={cn(
                      uiTypographyRecipes.caption,
                      statusTextClass[row.status],
                      'capitalize'
                    )}
                  >
                    {row.status.replace('_', ' ')}
                  </span>
                </div>
                <div className={cn(uiTypographyRecipes.caption, uiTextRecipes.body)}>
                  {formatSyncAllRowDetail(row)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={syncingAll}>
            {hasIssues ? 'Dismiss' : 'Close'}
          </Button>
        </div>
      </GlassCard>
    </Modal>
  );
}

export default SyncAllStatusModal;
