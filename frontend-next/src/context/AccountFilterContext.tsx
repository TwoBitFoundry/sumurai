import { createContext } from 'react';
import type { Account } from '../types/api';

export interface ProviderAccount {
  id: string;
  name: string;
  account_type: string;
  balance_ledger: number | null;
  balance_available: number | null;
  mask: string | null;
  provider: Account['provider'];
  institution_name: string;
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
}

export const AccountFilterContext = createContext<AccountFilterContextType | undefined>(undefined);
