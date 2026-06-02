import type { FinancialProvider } from '@/types/api';

export type SyncAllRowStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'auth_required'
  | 'rate_limited'
  | 'error'
  | 'skipped_hidden'
  | 'no_accounts';

export interface SyncAllRow {
  id: string;
  provider: FinancialProvider;
  institutionName: string;
  connectionId: string | null;
  status: SyncAllRowStatus;
  detail: string | null;
  transactionCount: number | null;
  retryAfterSeconds: number | null;
}
