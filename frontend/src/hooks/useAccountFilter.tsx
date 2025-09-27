import { useContext, useState, useMemo, useCallback, useEffect, ReactNode } from 'react'
import { AccountFilterContext, AccountFilterContextType, PlaidAccount, AccountsByBank } from '@/context/AccountFilterContext'
import { PlaidService } from '@/services/PlaidService'

export function useAccountFilter(): AccountFilterContextType {
  const context = useContext(AccountFilterContext)
  if (context === undefined) {
    throw new Error('useAccountFilter must be used within an AccountFilterProvider')
  }
  return context
}

interface AccountFilterProviderProps {
  children: ReactNode
}

export function AccountFilterProvider({ children }: AccountFilterProviderProps) {
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [isAllAccountsSelected, setAllAccountsSelected] = useState(true)
  const [accountsByBank, setAccountsByBank] = useState<AccountsByBank>({})
  const [loading, setLoading] = useState(false)

  const groupAccountsByBank = useCallback((accounts: PlaidAccount[]): AccountsByBank => {
    return accounts.reduce((acc: AccountsByBank, account: PlaidAccount) => {
      const bankName = account.institution_name
      if (!acc[bankName]) {
        acc[bankName] = []
      }
      acc[bankName].push(account)
      return acc
    }, {})
  }, [])

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true)
      const accounts = await PlaidService.getAccounts()
      const grouped = groupAccountsByBank(accounts)
      setAccountsByBank(grouped)
    } catch (error) {
      console.warn('Failed to fetch accounts for filter:', error)
      setAccountsByBank({})
    } finally {
      setLoading(false)
    }
  }, [groupAccountsByBank])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const selectAllAccounts = useCallback(() => {
    setSelectedAccountIds([])
    setAllAccountsSelected(true)
  }, [])

  const toggleBank = useCallback((bankName: string) => {
    const bankAccounts = accountsByBank[bankName] || []
    const bankAccountIds = bankAccounts.map(account => account.id)

    setSelectedAccountIds(prev => {
      const allBankAccountsSelected = bankAccountIds.every(id => prev.includes(id))

      if (allBankAccountsSelected) {
        return prev.filter(id => !bankAccountIds.includes(id))
      } else {
        const newIds = [...prev]
        bankAccountIds.forEach(id => {
          if (!newIds.includes(id)) {
            newIds.push(id)
          }
        })
        return newIds
      }
    })

    setAllAccountsSelected(false)
  }, [accountsByBank])

  const toggleAccount = useCallback((accountId: string) => {
    setSelectedAccountIds(prev => {
      if (prev.includes(accountId)) {
        return prev.filter(id => id !== accountId)
      } else {
        return [...prev, accountId]
      }
    })
    setAllAccountsSelected(false)
  }, [])

  const value = useMemo((): AccountFilterContextType => ({
    selectedAccountIds,
    isAllAccountsSelected,
    accountsByBank,
    loading,
    setSelectedAccountIds,
    setAllAccountsSelected,
    selectAllAccounts,
    toggleBank,
    toggleAccount,
  }), [selectedAccountIds, isAllAccountsSelected, accountsByBank, loading, selectAllAccounts, toggleBank, toggleAccount])

  return (
    <AccountFilterContext.Provider value={value}>
      {children}
    </AccountFilterContext.Provider>
  )
}