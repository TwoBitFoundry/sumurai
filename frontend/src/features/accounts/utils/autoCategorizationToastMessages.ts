import type { AutoCategorizationJobState } from '@/types/api';

export function buildAutoCategorizationProgressMessage(job: AutoCategorizationJobState): string {
  const progress =
    job.total > 0
      ? `${job.processed} / ${job.total} processed`
      : `${job.updated} updated, ${job.skipped} skipped`;
  return `Categorizing transactions… ${progress} · ${job.updated} updated · ${job.skipped} skipped`;
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
