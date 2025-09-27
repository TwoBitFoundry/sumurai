import { createContext } from 'react'
import type { Account } from '../types/api'

export interface PlaidAccount {
  id: string
  name: string
  account_type: string
  balance_current: number | null
  mask: string | null
  institution_name: string
}

export interface AccountsByBank {
  [bankName: string]: PlaidAccount[]
}

export interface AccountFilterContextType {
  selectedAccountIds: string[]
  isAllAccountsSelected: boolean
  accountsByBank: AccountsByBank
  loading: boolean
  setSelectedAccountIds: (accountIds: string[]) => void
  setAllAccountsSelected: (isAll: boolean) => void
  selectAllAccounts: () => void
  toggleBank: (bankName: string) => void
  toggleAccount: (accountId: string) => void
}

export const AccountFilterContext = createContext<AccountFilterContextType | undefined>(undefined)