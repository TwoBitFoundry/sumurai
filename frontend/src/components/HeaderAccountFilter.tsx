import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import { useAccountFilter } from '@/hooks/useAccountFilter'

interface HeaderAccountFilterProps {
  scrolled: boolean
}

export function HeaderAccountFilter({ scrolled }: HeaderAccountFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [collapsedBanks, setCollapsedBanks] = useState<Set<string>>(new Set())
  const triggerRef = useRef<HTMLButtonElement>(null)
  const {
    isAllAccountsSelected,
    selectedAccountIds,
    allAccountIds,
    accountsByBank,
    loading,
    toggleBank,
    toggleAccount
  } = useAccountFilter()

  const totalAccounts = allAccountIds.length
  const selectedCount = selectedAccountIds.length

  const displayText = (() => {
    if (totalAccounts === 0) {
      return loading ? 'Loading accounts...' : 'No accounts'
    }
    if (selectedCount === 0) {
      return 'No accounts selected'
    }
    if (isAllAccountsSelected) {
      return 'All accounts'
    }
    return `${selectedCount} ${selectedCount === 1 ? 'account' : 'accounts'}`
  })()

  const closePopover = () => {
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const toggleBankCollapse = (bankName: string) => {
    setCollapsedBanks(prev => {
      const next = new Set(prev)
      if (next.has(bankName)) {
        next.delete(bankName)
      } else {
        next.add(bankName)
      }
      return next
    })
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label="Account filter"
            onKeyDown={(e) => e.key === 'Escape' && closePopover()}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute top-full right-0 mt-2 w-80 max-h-96 flex flex-col rounded-xl border border-slate-200 dark:border-slate-600 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg z-50 origin-top"
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Filter by account
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {loading ? (
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Loading accounts...
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(accountsByBank).map(([bankName, accounts]) => {
                    const bankAccountIds = accounts.map(account => account.id)
                    const allBankAccountsSelected = bankAccountIds.every(id => selectedAccountIds.includes(id))
                    const someBankAccountsSelected = bankAccountIds.some(id => selectedAccountIds.includes(id))
                    const isCollapsed = collapsedBanks.has(bankName)

                    return (
                      <div key={bankName} className="border-t border-slate-200 dark:border-slate-700 pt-2 first:border-t-0 first:pt-0">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleBankCollapse(bankName)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                            aria-label={isCollapsed ? `Expand ${bankName}` : `Collapse ${bankName}`}
                          >
                            <ChevronRight
                              className={`h-4 w-4 text-slate-600 dark:text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                            />
                          </button>
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
                          <label htmlFor={`bank-${bankName}`} className="text-sm font-medium text-slate-900 dark:text-slate-100 flex-1 cursor-pointer">
                            {bankName}
                          </label>
                        </div>

                        <AnimatePresence initial={false}>
                          {!isCollapsed && (
                            <motion.div
                              key="accounts"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.18, ease: 'easeOut' }}
                              className="ml-11 mt-2 space-y-2 overflow-hidden"
                            >
                              {accounts.map((account) => (
                                <div key={account.id} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`account-${account.id}`}
                                    checked={selectedAccountIds.includes(account.id)}
                                    onChange={() => toggleAccount(account.id)}
                                    className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                                  />
                                  <label htmlFor={`account-${account.id}`} className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                                    {account.name}
                                  </label>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                  {Object.keys(accountsByBank).length === 0 && !loading && (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      No accounts available.
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
