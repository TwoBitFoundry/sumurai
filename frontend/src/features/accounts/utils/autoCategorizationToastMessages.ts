import type { AutoCategorizationJobState, AutoCategorizationJobStatus } from '@/types/api';

export function buildAutoCategorizationProgressTitle(status: AutoCategorizationJobStatus): string {
  return status === 'cancelling' ? 'Cancelling categorization…' : 'Categorizing transactions…';
}

export function getAutoCategorizationProgressPercent(processed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (processed / total) * 100));
}

export function formatAutoCategorizationProgressCaption(processed: number, total: number): string {
  if (total <= 0) {
    return 'Starting…';
  }
  const percent = Math.round(getAutoCategorizationProgressPercent(processed, total));
  return `${percent}% · ${processed.toLocaleString()} / ${total.toLocaleString()}`;
}

export function buildAutoCategorizationTerminalMessage(job: AutoCategorizationJobState): string {
  switch (job.status) {
    case 'completed':
      return `Categorization complete · ${job.updated} updated · ${job.skipped} skipped`;
    case 'cancelled':
      return `Categorization cancelled · ${job.processed} / ${job.total} processed`;
    case 'failed':
      return `Categorization failed · ${job.error_message ?? 'Try again'}`;
    default:
      return 'Categorization finished';
  }
}
