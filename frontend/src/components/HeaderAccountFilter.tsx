import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Building2 } from 'lucide-react'
import { useAccountFilter } from '@/hooks/useAccountFilter'

interface HeaderAccountFilterProps {
  scrolled: boolean
}

export function HeaderAccountFilter({ scrolled }: HeaderAccountFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const {
    isAllAccountsSelected,
    selectedAccountIds,
    accountsByBank,
    loading,
    setSelectedAccountIds,
    setAllAccountsSelected,
    selectAllAccounts,
    toggleBank,
    toggleAccount
  } = useAccountFilter()

  const displayText = isAllAccountsSelected ? 'All accounts' : `${selectedAccountIds.length} accounts`

  const closePopover = () => {
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      closePopover()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsOpen(!isOpen)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const dialog = document.querySelector('[role="dialog"]')

      if (triggerRef.current &&
          !triggerRef.current.contains(target) &&
          dialog &&
          !dialog.contains(target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`${
          scrolled ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        } rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-700/80 backdrop-blur-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 flex items-center gap-2`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Building2 className="h-4 w-4" />
        <span>{displayText}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Account filter"
          onKeyDown={(e) => e.key === 'Escape' && closePopover()}
          className="absolute top-full right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-600 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg z-50"
        >
          <div className="p-4">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">
              Filter by account
            </div>

            {loading ? (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Loading accounts...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="all-accounts"
                    checked={isAllAccountsSelected}
                    onChange={() => {
                      if (isAllAccountsSelected) {
                        setSelectedAccountIds([])
                        setAllAccountsSelected(false)
                      } else {
                        selectAllAccounts()
                      }
                    }}
                    className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="all-accounts" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    All accounts
                  </label>
                </div>

                {Object.entries(accountsByBank).map(([bankName, accounts]) => {
                  const bankAccountIds = accounts.map(account => account.id)
                  const allBankAccountsSelected = bankAccountIds.every(id => selectedAccountIds.includes(id))
                  const someBankAccountsSelected = bankAccountIds.some(id => selectedAccountIds.includes(id))

                  return (
                    <div key={bankName} className="border-t border-slate-200 dark:border-slate-700 pt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          id={`bank-${bankName}`}
                          checked={allBankAccountsSelected}
                          ref={input => {
                            if (input) input.indeterminate = someBankAccountsSelected && !allBankAccountsSelected
                          }}
                          onChange={() => toggleBank(bankName)}
                          className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                        />
                        <label htmlFor={`bank-${bankName}`} className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {bankName}
                        </label>
                      </div>

                      <div className="ml-6 space-y-2">
                        {accounts.map((account) => (
                          <div key={account.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`account-${account.id}`}
                              checked={selectedAccountIds.includes(account.id)}
                              onChange={() => toggleAccount(account.id)}
                              className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor={`account-${account.id}`} className="text-sm text-slate-600 dark:text-slate-400">
                              {account.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}