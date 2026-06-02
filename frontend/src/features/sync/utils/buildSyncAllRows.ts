import type { SyncAllRow } from '../types/syncAllStatus';

export interface SyncAllBank {
  id: string;
  name: string;
  provider: 'plaid' | 'teller' | 'simplefin';
  connectionId: string | null;
}

export function buildSyncAllRows(banks: SyncAllBank[]): SyncAllRow[] {
  return banks.map((bank) => ({
    id: bank.id,
    provider: bank.provider,
    institutionName: bank.name,
    connectionId: bank.connectionId,
    status: 'pending',
    detail: null,
    transactionCount: null,
    retryAfterSeconds: null,
  }));
}
