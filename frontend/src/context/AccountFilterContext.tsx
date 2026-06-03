import { createContext } from 'react';
import type { Account } from '../types/api';

export interface ProviderAccount {
  id: string;
  name: string;
  account_type: string;
  balance_current: number | null;
  balance_ledger: number | null;
  balance_available: number | null;
  mask: string | null;
  provider: Account['provider'] | null;
  institution_name: string;
  connection_id: string | null;
  provider_account_id: string | null;
  transaction_count: number | null;
}

export interface AccountsByBank {
  [bankName: string]: ProviderAccount[];
}

export interface AccountFilterContextType {
  selectedAccountIds: string[];
  allAccountIds: string[];
  isAllAccountsSelected: boolean;
  accountsByBank: AccountsByBank;
  loading: boolean;
  setSelectedAccountIds: (accountIds: string[]) => void;
  toggleBank: (bankName: string) => void;
  toggleAccount: (accountId: string) => void;
  removeAccountsByIds: (accountIds: string[]) => void;
}

export const AccountFilterContext = createContext<AccountFilterContextType | undefined>(undefined);
