import type { ReactNode } from 'react';
import {
  AccountFilterContext,
  type AccountFilterContextType,
  type ProviderAccount,
} from '@/context/AccountFilterContext';
import type { Account } from '@/types/api';

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

export function accountToProviderAccount(account: Account): ProviderAccount {
  return {
    id: account.id,
    name: account.name,
    account_type: account.account_type,
    balance_current: parseBalance(account.balance_current ?? null),
    balance_ledger: account.balance_ledger,
    balance_available: account.balance_available ?? null,
    mask: account.mask,
    provider: account.provider ?? null,
    institution_name: account.institution_name ?? 'Unknown Bank',
    connection_id:
      account.connection_id ??
      account.provider_connection_id ??
      account.plaid_connection_id ??
      null,
    provider_account_id: account.provider_account_id ?? null,
    transaction_count: account.transaction_count ?? null,
  };
}

export function buildMockAccountFilterContext(
  partial: Partial<AccountFilterContextType> & Pick<AccountFilterContextType, 'accountsByBank'>
): AccountFilterContextType {
  const derivedIds =
    partial.allAccountIds ??
    Object.values(partial.accountsByBank)
      .flat()
      .map((a) => a.id);
  const selected = partial.selectedAccountIds ?? derivedIds;
  return {
    accountsByBank: partial.accountsByBank,
    allAccountIds: derivedIds,
    selectedAccountIds: selected,
    isAllAccountsSelected:
      partial.isAllAccountsSelected ??
      (derivedIds.length > 0 && selected.length === derivedIds.length),
    loading: partial.loading ?? false,
    setSelectedAccountIds: partial.setSelectedAccountIds ?? (() => {}),
    toggleBank: partial.toggleBank ?? (() => {}),
    toggleAccount: partial.toggleAccount ?? (() => {}),
    removeAccountsByIds: partial.removeAccountsByIds ?? (() => {}),
  };
}

export function MockAccountFilterProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AccountFilterContextType;
}) {
  return <AccountFilterContext.Provider value={value}>{children}</AccountFilterContext.Provider>;
}
