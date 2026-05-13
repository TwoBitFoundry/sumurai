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
      if (!acc[bankName]) {
        acc[bankName] = [];
      }
      acc[bankName].push(account);
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
    setSelectedAccountIds((prev) => {
      if (allAccountIds.length === 0) {
        return prev.length === 0 ? prev : [];
      }

      if (prev.length === 0) {
        return allAccountIds;
      }

      const newIdSet = new Set(allAccountIds);
      const filteredSelection = prev.filter((id) => newIdSet.has(id));

      const prevAllIds = previousAllAccountIdsRef.current;
      const previouslyHadAllSelected =
        prevAllIds.length > 0 &&
        prev.length === prevAllIds.length &&
        prevAllIds.every((id) => prev.includes(id));

      if (previouslyHadAllSelected) {
        return allAccountIds;
      }

      if (arraysEqual(prev, filteredSelection)) {
        return prev;
      }

      return filteredSelection;
    });

    previousAllAccountIdsRef.current = allAccountIds;
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

  const value = useMemo(
    (): AccountFilterContextType => ({
      selectedAccountIds,
      allAccountIds,
      isAllAccountsSelected,
      accountsByBank,
      loading: accountsQuery.isPending,
      setSelectedAccountIds,
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
    balance_ledger: number | null;
    balance_available?: number | null;
    balance_current?: number | string | null;
    mask: string | null;
    provider?: ProviderAccount['provider'];
    institution_name?: string | null;
    connection_id?: string | null;
    provider_connection_id?: string | null;
    plaid_connection_id?: string | null;
    transaction_count?: number | null;
  }[]
): ProviderAccount[] {
  return accounts.map((account) => {
    return {
      id: account.id,
      name: account.name,
      account_type: account.account_type,
      balance_ledger: parseBalance(account.balance_ledger),
      balance_available: parseBalance(account.balance_available ?? null),
      mask: account.mask ?? null,
      provider: account.provider ?? 'plaid',
      institution_name: account.institution_name ?? 'Unknown Bank',
      connection_id:
        account.connection_id ??
        account.provider_connection_id ??
        account.plaid_connection_id ??
        null,
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
