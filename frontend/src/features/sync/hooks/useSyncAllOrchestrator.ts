import { useCallback, useEffect, useRef, useState } from 'react';
import type { BankConnectionViewModel } from '@/features/plaid/components/ConnectionsList';
import { ApiError, RateLimitError } from '@/services/ApiClient';
import { PlaidService } from '@/services/PlaidService';
import { SimpleFinService } from '@/services/SimpleFinService';
import { TellerService } from '@/services/TellerService';
import type { FinancialProvider, Transaction } from '@/types/api';
import { dispatchFinancialAppRefresh } from '@/utils/events';
import { formatUserFacingApiError } from '@/utils/formatUserFacingApiError';
import { isSyncProvider } from '@/utils/queryInvalidation';
import type { SyncAllRow, SyncAllRowStatus } from '../types/syncAllStatus';
import { buildSyncAllRows, type SyncAllBank } from '../utils/buildSyncAllRows';
import { isProviderReconnectRequiredError } from '../utils/isProviderReconnectRequiredError';

interface UseSyncAllOrchestratorOptions {
  banks: BankConnectionViewModel[];
  primaryProvider: FinancialProvider;
  isOnline: boolean;
  onError?: (message: string | null) => void;
}

interface UseSyncAllOrchestratorResult {
  syncingAll: boolean;
  syncAllModalOpen: boolean;
  syncAllRows: SyncAllRow[];
  syncAll: () => Promise<void>;
  closeSyncAllModal: () => void;
}

const AUTO_CLOSE_DELAY_MS = 5000;

const isRateLimitError = (error: unknown): error is RateLimitError | ApiError =>
  error instanceof RateLimitError || (error instanceof ApiError && error.status === 429);

const mapBanksToSyncRows = (banks: BankConnectionViewModel[]): SyncAllRow[] => {
  const syncBanks: SyncAllBank[] = banks
    .filter((bank) => Boolean(bank.connectionId) && isSyncProvider(bank.provider))
    .map((bank) => ({
      id: bank.id,
      name: bank.name,
      provider: bank.provider as SyncAllBank['provider'],
      connectionId: bank.connectionId ?? null,
    }));

  return buildSyncAllRows(syncBanks);
};

const countNewTransactionsForBank = (
  transactions: Transaction[],
  bank: BankConnectionViewModel
): number => {
  const providerAccountIds = new Set(
    bank.accounts.map((account) => account.providerAccountId).filter((id): id is string => !!id)
  );

  if (providerAccountIds.size === 0) {
    return 0;
  }

  return transactions.filter((transaction) =>
    transaction.provider_account_id
      ? providerAccountIds.has(transaction.provider_account_id)
      : false
  ).length;
};

const buildRateLimitedRows = (rows: SyncAllRow[], retryAfterSeconds: number | null): SyncAllRow[] =>
  rows.map((row) =>
    row.status === 'synced' || row.status === 'skipped_hidden'
      ? row
      : {
          ...row,
          status: 'rate_limited',
          detail: null,
          retryAfterSeconds,
        }
  );

const hasFinishedSuccessState = (rows: SyncAllRow[]): boolean =>
  rows.every((row) => row.status === 'synced' || row.status === 'skipped_hidden');

const hasAppliedSuccessfulSync = (rows: SyncAllRow[]): boolean =>
  rows.some((row) => row.status === 'synced');

const updateRow = (
  rows: SyncAllRow[],
  rowId: string,
  status: SyncAllRowStatus,
  detail: string | null,
  transactionCount: number | null = null,
  retryAfterSeconds: number | null = null
): SyncAllRow[] =>
  rows.map((row) =>
    row.id === rowId
      ? {
          ...row,
          status,
          detail,
          transactionCount,
          retryAfterSeconds,
        }
      : row
  );

export function useSyncAllOrchestrator({
  banks,
  primaryProvider,
  isOnline,
  onError,
}: UseSyncAllOrchestratorOptions): UseSyncAllOrchestratorResult {
  const [syncAllRows, setSyncAllRows] = useState<SyncAllRow[]>([]);
  const [syncAllModalOpen, setSyncAllModalOpen] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const autoCloseTimerRef = useRef<number | null>(null);
  const hasAppliedRefreshRef = useRef(false);

  const clearAutoCloseTimer = useCallback(() => {
    if (autoCloseTimerRef.current != null) {
      window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearAutoCloseTimer();
    };
  }, [clearAutoCloseTimer]);

  const closeSyncAllModal = useCallback(() => {
    clearAutoCloseTimer();
    setSyncAllModalOpen(false);
  }, [clearAutoCloseTimer]);

  const applySuccessfulSyncRefresh = useCallback((rows: SyncAllRow[]) => {
    if (!hasAppliedSuccessfulSync(rows) || hasAppliedRefreshRef.current) {
      return;
    }
    hasAppliedRefreshRef.current = true;
    dispatchFinancialAppRefresh({ tab: 'accounts' });
  }, []);

  const scheduleAutoClose = useCallback(() => {
    clearAutoCloseTimer();
    autoCloseTimerRef.current = window.setTimeout(() => {
      setSyncAllModalOpen(false);
      autoCloseTimerRef.current = null;
    }, AUTO_CLOSE_DELAY_MS);
  }, [clearAutoCloseTimer]);

  const finalizeSuccessfulSyncBatch = useCallback(
    (rows: SyncAllRow[]) => {
      applySuccessfulSyncRefresh(rows);
      if (hasFinishedSuccessState(rows)) {
        scheduleAutoClose();
      }
    },
    [applySuccessfulSyncRefresh, scheduleAutoClose]
  );

  const syncAll = useCallback(async () => {
    if (!isOnline || syncingAll) {
      return;
    }

    const providerBanks = banks.filter(
      (bank) => bank.provider === primaryProvider && Boolean(bank.connectionId)
    );

    if (providerBanks.length === 0) {
      return;
    }

    clearAutoCloseTimer();
    hasAppliedRefreshRef.current = false;
    let currentRows = mapBanksToSyncRows(providerBanks);
    setSyncAllRows(currentRows);
    setSyncAllModalOpen(true);
    setSyncingAll(true);

    try {
      if (primaryProvider === 'simplefin') {
        const primaryConnectionId = providerBanks[0]?.connectionId;
        if (!primaryConnectionId) {
          return;
        }

        currentRows = updateRow(currentRows, providerBanks[0].id, 'syncing', null);
        setSyncAllRows(currentRows);

        const result = await SimpleFinService.syncBridge(primaryConnectionId);
        if (result.rateLimited) {
          currentRows = buildRateLimitedRows(currentRows, result.retryAfterSeconds ?? null);
          setSyncAllRows(currentRows);
          return;
        }

        currentRows = currentRows.map((row) => {
          const bank = providerBanks.find((entry) => entry.id === row.id);
          const matchingResult = result.simplefin_institution_results.find(
            (entry) =>
              entry.connection_id === row.connectionId ||
              entry.org_conn_id === row.connectionId ||
              entry.institution_name === row.institutionName
          );

          if (!matchingResult) {
            return {
              ...row,
              status: 'error',
              detail: 'No bridge result was returned for this institution.',
              transactionCount: null,
              retryAfterSeconds: null,
            };
          }

          return {
            ...row,
            status: matchingResult.status,
            detail: matchingResult.message ?? null,
            transactionCount:
              bank != null && matchingResult.status === 'synced'
                ? countNewTransactionsForBank(result.transactions, bank)
                : null,
            retryAfterSeconds: null,
          };
        });
        setSyncAllRows(currentRows);

        finalizeSuccessfulSyncBatch(currentRows);

        return;
      }

      for (const bank of providerBanks) {
        if (!bank.connectionId) {
          continue;
        }

        currentRows = updateRow(currentRows, bank.id, 'syncing', null);
        setSyncAllRows(currentRows);

        try {
          if (bank.provider === 'teller') {
            const result = await TellerService.syncTransactions(bank.connectionId);
            const transactionCount = result.transactions.length;
            currentRows = updateRow(
              currentRows,
              bank.id,
              'synced',
              `Synced ${transactionCount} new transaction${transactionCount === 1 ? '' : 's'}`,
              transactionCount
            );
          } else {
            const result = await PlaidService.syncTransactions(bank.connectionId);
            const transactionCount = result.transactions.length;
            currentRows = updateRow(
              currentRows,
              bank.id,
              'synced',
              `Synced ${transactionCount} new transaction${transactionCount === 1 ? '' : 's'}`,
              transactionCount
            );
          }

          setSyncAllRows(currentRows);
        } catch (error: unknown) {
          if (isRateLimitError(error)) {
            const retryAfterSeconds =
              error instanceof RateLimitError ? (error.retryAfterSeconds ?? null) : null;
            currentRows = updateRow(
              currentRows,
              bank.id,
              'rate_limited',
              null,
              null,
              retryAfterSeconds ?? null
            );
            const nextRows = buildRateLimitedRows(currentRows, retryAfterSeconds ?? null);
            setSyncAllRows(nextRows);
            break;
          }

          const isAuthRequired = isProviderReconnectRequiredError(error);
          const detail = isAuthRequired
            ? 'Re-authenticate this institution to continue syncing.'
            : formatUserFacingApiError(error, `Failed to sync ${bank.name}`);

          currentRows = updateRow(
            currentRows,
            bank.id,
            isAuthRequired ? 'auth_required' : 'error',
            detail
          );
          setSyncAllRows(currentRows);
        }
      }

      finalizeSuccessfulSyncBatch(currentRows);
    } catch (error: unknown) {
      currentRows = currentRows.map((row) =>
        row.status === 'syncing' || row.status === 'pending'
          ? {
              ...row,
              status: 'error',
              detail: formatUserFacingApiError(error, 'Failed to sync all accounts'),
            }
          : row
      );
      setSyncAllRows(currentRows);
      const message = formatUserFacingApiError(error, 'Failed to sync all accounts');
      onError?.(message);
    } finally {
      setSyncingAll(false);
    }
  }, [
    banks,
    clearAutoCloseTimer,
    isOnline,
    onError,
    primaryProvider,
    finalizeSuccessfulSyncBatch,
    syncingAll,
  ]);

  return {
    syncingAll,
    syncAllModalOpen,
    syncAllRows,
    syncAll,
    closeSyncAllModal,
  };
}
