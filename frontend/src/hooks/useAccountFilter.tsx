import { useContext, useState, useMemo, useCallback, useEffect, useRef, ReactNode } from 'react'
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
  const [accounts, setAccounts] = useState<PlaidAccount[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const previousAllAccountIdsRef = useRef<string[]>([])

  const groupAccountsByBank = useCallback((items: PlaidAccount[]): AccountsByBank => {
    return items.reduce<AccountsByBank>((acc, account) => {
      const bankName = account.institution_name || 'Unknown Bank'
      if (!acc[bankName]) {
        acc[bankName] = []
      }
      acc[bankName].push(account)
      return acc
    }, {})
  }, [])

  const accountsByBank = useMemo(() => groupAccountsByBank(accounts), [accounts, groupAccountsByBank])
  const allAccountIds = useMemo(() => accounts.map(account => account.id), [accounts])
  const isAllAccountsSelected = allAccountIds.length > 0 && selectedAccountIds.length === allAccountIds.length

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true)
      const accountsResponse = await PlaidService.getAccounts()

      // Map API Account type to PlaidAccount type for account filter
      const mappedAccounts: PlaidAccount[] = (accountsResponse || []).map(account => ({
        id: account.id,
        name: account.name,
        account_type: account.account_type,
        balance_current: account.balance_current,
        mask: account.mask,
        institution_name:
          (account as any).institution_name ??
          (account as any).institutionName ??
          'Unknown Bank',
      }))

      setAccounts(mappedAccounts)

      const newAccountIds = mappedAccounts.map(account => account.id)

      setSelectedAccountIds(prev => {
        if (prev.length === 0) {
          return newAccountIds
        }

        const newIdSet = new Set(newAccountIds)
        const filteredSelection = prev.filter(id => newIdSet.has(id))

        const prevAllIds = previousAllAccountIdsRef.current
        const previouslyHadAllSelected =
          prevAllIds.length > 0 &&
          prev.length === prevAllIds.length &&
          prevAllIds.every(id => prev.includes(id))

        if (previouslyHadAllSelected) {
          return newAccountIds
        }

        if (arraysEqual(prev, filteredSelection)) {
          return prev
        }

        return filteredSelection
      })

      previousAllAccountIdsRef.current = newAccountIds
    } catch (error) {
      console.warn('Failed to fetch accounts for filter:', error)
      setAccounts([])
      setSelectedAccountIds([])
      previousAllAccountIdsRef.current = []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

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
  }, [accountsByBank])

  const toggleAccount = useCallback((accountId: string) => {
    setSelectedAccountIds(prev => {
      if (prev.includes(accountId)) {
        return prev.filter(id => id !== accountId)
      } else {
        return [...prev, accountId]
      }
    })
  }, [])

  const value = useMemo((): AccountFilterContextType => ({
    selectedAccountIds,
    allAccountIds,
    isAllAccountsSelected,
    accountsByBank,
    loading,
    setSelectedAccountIds,
    toggleBank,
    toggleAccount,
  }), [selectedAccountIds, allAccountIds, isAllAccountsSelected, accountsByBank, loading, toggleBank, toggleAccount])

  return (
    <AccountFilterContext.Provider value={value}>
      {children}
    </AccountFilterContext.Provider>
  )
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}
