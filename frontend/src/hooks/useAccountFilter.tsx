/**
 * Account selection and per-institution grouping for filtered views.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccountFilterContext,
  type AccountFilterContextType,
  type AccountsByBank,
  type ProviderAccount,
} from '@/context/AccountFilterContext';
import { ProviderCatalog } from '@/services/ProviderCatalog';
import {
  ACCOUNT_FILTER_CHANNEL,
  type AccountFilterMessage,
  canUseBroadcastChannel,
} from '@/utils/accountFilterChannel';
import { ACCOUNTS_CHANGED_EVENT } from '@/utils/events';

const EMPTY_PROVIDER_ACCOUNTS: ProviderAccount[] = [];

export function useAccountFilter(): AccountFilterContextType {
  const context = useContext(AccountFilterContext);
  if (context === undefined) {
    throw new Error('useAccountFilter must be used within an AccountFilterProvider');
  }
  return context;
}

interface AccountFilterProviderProps {
  children: ReactNode;
}

export function AccountFilterProvider({ children }: AccountFilterProviderProps) {
  const queryClient = useQueryClient();
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const previousAllAccountIdsRef = useRef<string[]>([]);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const shouldBroadcastRef = useRef(false);
  const hasRequestedInitialSyncRef = useRef(false);
  const hasAppliedInitialSyncRef = useRef(false);
  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => mapProviderAccounts(await ProviderCatalog.getAccounts()),
    staleTime: 0,
  });
  const accounts = useMemo(
    () => accountsQuery.data ?? EMPTY_PROVIDER_ACCOUNTS,
    [accountsQuery.data]
  );

  const groupAccountsByBank = useCallback((items: ProviderAccount[]): AccountsByBank => {
    return items.reduce<AccountsByBank>((acc, account) => {
      const bankName = account.institution_name || 'Unknown Bank';
      const bankKey =
        account.provider === 'simplefin' && account.connection_id
          ? `${bankName}::${account.connection_id}`
          : bankName;

      if (!acc[bankKey]) {
        acc[bankKey] = [];
      }
      acc[bankKey].push(account);
      return acc;
    }, {});
  }, []);

  const accountsByBank = useMemo(
    () => groupAccountsByBank(accounts),
    [accounts, groupAccountsByBank]
  );
  const allAccountIds = useMemo(() => accounts.map((account) => account.id), [accounts]);
  const isAllAccountsSelected =
    allAccountIds.length > 0 && selectedAccountIds.length === allAccountIds.length;

  useEffect(() => {
    if (!canUseBroadcastChannel()) return;
    const ch = new BroadcastChannel(ACCOUNT_FILTER_CHANNEL);
    channelRef.current = ch;
    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    const handleMessage = (event: MessageEvent<AccountFilterMessage>) => {
      const msg = event.data;
      if (msg.type === 'filter-changed') {
        if (allAccountIds.length === 0) return;
        const valid = msg.selectedIds.filter((id) => allAccountIds.includes(id));
        setSelectedAccountIds(valid);
      } else if (msg.type === 'filter-request') {
        channel.postMessage({ type: 'filter-response', selectedIds: selectedAccountIds });
      } else if (msg.type === 'filter-response' && !hasAppliedInitialSyncRef.current) {
        hasAppliedInitialSyncRef.current = true;
        if (allAccountIds.length === 0) return;
        const valid = msg.selectedIds.filter((id) => allAccountIds.includes(id));
        if (valid.length > 0) {
          setSelectedAccountIds(valid);
        }
      }
    };

    channel.addEventListener('message', handleMessage);
    return () => channel.removeEventListener('message', handleMessage);
  }, [allAccountIds, selectedAccountIds]);

  useEffect(() => {
    if (!shouldBroadcastRef.current) return;
    shouldBroadcastRef.current = false;
    channelRef.current?.postMessage({ type: 'filter-changed', selectedIds: selectedAccountIds });
  }, [selectedAccountIds]);

  useEffect(() => {
    const previousAllAccountIds = previousAllAccountIdsRef.current;

    setSelectedAccountIds((prev) => {
      if (allAccountIds.length === 0) {
        return prev.length === 0 ? prev : [];
      }

      if (prev.length === 0) {
        return allAccountIds;
      }

      const prevIdSet = new Set(prev);
      const previousAllIdSet = new Set(previousAllAccountIds);
      const nextSelection = allAccountIds.filter(
        (id) => prevIdSet.has(id) || !previousAllIdSet.has(id)
      );

      if (arraysEqual(prev, nextSelection)) {
        return prev;
      }

      return nextSelection;
    });

    previousAllAccountIdsRef.current = allAccountIds;

    if (allAccountIds.length > 0 && !hasRequestedInitialSyncRef.current) {
      hasRequestedInitialSyncRef.current = true;
      channelRef.current?.postMessage({ type: 'filter-request' });
    }
  }, [allAccountIds]);

  useEffect(() => {
    const handleAccountsChanged = () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
    };

    window.addEventListener(ACCOUNTS_CHANGED_EVENT, handleAccountsChanged);
    return () => window.removeEventListener(ACCOUNTS_CHANGED_EVENT, handleAccountsChanged);
  }, [queryClient]);

  const toggleBank = useCallback(
    (bankName: string) => {
      const bankAccounts = accountsByBank[bankName] || [];
      const bankAccountIds = bankAccounts.map((account) => account.id);

      shouldBroadcastRef.current = true;
      setSelectedAccountIds((prev) => {
        const allBankAccountsSelected = bankAccountIds.every((id) => prev.includes(id));

        if (allBankAccountsSelected) {
          return prev.filter((id) => !bankAccountIds.includes(id));
        } else {
          const newIds = [...prev];
          bankAccountIds.forEach((id) => {
            if (!newIds.includes(id)) {
              newIds.push(id);
            }
          });
          return newIds;
        }
      });
    },
    [accountsByBank]
  );

  const toggleAccount = useCallback((accountId: string) => {
    shouldBroadcastRef.current = true;
    setSelectedAccountIds((prev) => {
      if (prev.includes(accountId)) {
        return prev.filter((id) => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
  }, []);

  const removeAccountsByIds = useCallback(
    (accountIds: string[]) => {
      if (accountIds.length === 0) {
        return;
      }

      const idSet = new Set(accountIds);
      queryClient.setQueryData<ProviderAccount[]>(['accounts'], (current = []) =>
        current.filter((account) => !idSet.has(account.id))
      );
      setSelectedAccountIds((prev) => prev.filter((id) => !idSet.has(id)));
      previousAllAccountIdsRef.current = previousAllAccountIdsRef.current.filter(
        (id) => !idSet.has(id)
      );
    },
    [queryClient]
  );

  const setSelectedAccountIdsPublic = useCallback((accountIds: string[]) => {
    shouldBroadcastRef.current = true;
    setSelectedAccountIds(accountIds);
  }, []);

  const value = useMemo(
    (): AccountFilterContextType => ({
      selectedAccountIds,
      allAccountIds,
      isAllAccountsSelected,
      accountsByBank,
      loading: accountsQuery.isPending,
      setSelectedAccountIds: setSelectedAccountIdsPublic,
      toggleBank,
      toggleAccount,
      removeAccountsByIds,
    }),
    [
      selectedAccountIds,
      allAccountIds,
      isAllAccountsSelected,
      accountsByBank,
      accountsQuery.isPending,
      setSelectedAccountIdsPublic,
      toggleBank,
      toggleAccount,
      removeAccountsByIds,
    ]
  );

  return <AccountFilterContext.Provider value={value}>{children}</AccountFilterContext.Provider>;
}

function mapProviderAccounts(
  accounts: {
    id: string;
    name: string;
    account_type: string;
    balance_current?: number | string | null;
    balance_ledger: number | null;
    balance_available?: number | null;
    mask: string | null;
    provider?: ProviderAccount['provider'];
    institution_name?: string | null;
    connection_id?: string | null;
    provider_connection_id?: string | null;
    plaid_connection_id?: string | null;
    provider_account_id?: string | null;
    transaction_count?: number | null;
  }[]
): ProviderAccount[] {
  return accounts.map((account) => {
    return {
      id: account.id,
      name: account.name,
      account_type: account.account_type,
      balance_current: parseBalance(account.balance_current ?? null),
      balance_ledger: parseBalance(account.balance_ledger),
      balance_available: parseBalance(account.balance_available ?? null),
      mask: account.mask ?? null,
      provider: account.provider ?? null,
      institution_name: account.institution_name ?? 'Unknown Bank',
      connection_id:
        account.connection_id ??
        account.provider_connection_id ??
        account.plaid_connection_id ??
        null,
      provider_account_id: account.provider_account_id ?? null,
      transaction_count: parseTransactionCount(account.transaction_count),
    };
  });
}

function parseBalance(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const isNegativeParenthetical = trimmed.startsWith('(') && trimmed.endsWith(')');
    const normalized = trimmed.replace(/[^0-9.-]/g, '');
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return isNegativeParenthetical ? -parsed : parsed;
  }

  return null;
}

function parseTransactionCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const stripped = value.trim().replace(/[^0-9.-]/g, '');
    if (stripped.length === 0) {
      return null;
    }
    const parsed = Number(stripped);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
