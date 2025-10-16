import React from 'react'
import { GlassCard, cn, RequirementPill } from '@/ui/primitives'

interface Account {
  id: string
  name: string
  mask: string
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'other'
  balance?: number
  transactions?: number
}

interface AccountRowProps {
  account: Account
}

const cardContainerClasses = cn(
  'group relative overflow-hidden',
  'transition-transform duration-200 ease-out',
  'hover:-translate-y-[1px]'
)

const hoverOverlayClasses = cn(
  'pointer-events-none absolute inset-0 rounded-[inherit] opacity-0',
  'transition-opacity duration-200 ease-out',
  'bg-gradient-to-br from-sky-400/12 via-transparent to-violet-500/14',
  'group-hover:opacity-100',
  'dark:from-sky-400/18 dark:via-transparent dark:to-violet-500/18'
)

const accountMetaClasses = cn(
  'flex items-center gap-2',
  'text-xs font-medium capitalize',
  'text-slate-600 transition-colors duration-300 ease-out',
  'dark:text-slate-300'
)

const accountMaskClasses = cn(
  'font-mono text-slate-400 transition-colors duration-300 ease-out',
  'dark:text-slate-500'
)

const transactionsPillClasses = cn(
  'inline-flex items-center justify-center',
  'rounded-full border',
  'px-2.5 py-1 text-xs font-semibold',
  'border-slate-200 bg-slate-50 text-slate-600 transition-colors duration-300 ease-out',
  'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
)

const formatMoney = (amount?: number) => {
  if (typeof amount !== 'number') return 'PLACEHOLDER'
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

const AccountTypeDot: React.FC<{ type: Account['type'] }> = ({ type }) => {
  const colors: Record<Account['type'], string> = {
    checking: '#38bdf8',
    savings: '#22c55e',
    credit: '#f59e0b',
    loan: '#a78bfa',
    other: '#94a3b8',
  }

  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: colors[type] }}
    />
  )
}

export const AccountRow: React.FC<AccountRowProps> = ({ account }) => {
  const isDebtAccount = account.type === 'credit' || account.type === 'loan'
  const isOtherAccount = account.type === 'other'

  const rawBalance = account.balance
  const balanceText = formatMoney(rawBalance)

  const balanceColor = cn(
    'text-sm font-semibold tabular-nums',
    'transition-colors duration-300 ease-out',
    rawBalance == null && 'text-slate-400 dark:text-slate-500',
    rawBalance != null && !isDebtAccount && rawBalance > 0 && !isOtherAccount && 'text-emerald-500 dark:text-emerald-400',
    rawBalance != null && !isDebtAccount && rawBalance > 0 && isOtherAccount && 'text-slate-500 dark:text-slate-400',
    rawBalance != null && rawBalance < 0 && 'text-rose-500 dark:text-rose-400',
    isDebtAccount && rawBalance != null && 'text-red-500 dark:text-red-400',
    rawBalance === 0 && 'text-slate-500 dark:text-slate-600'
  )

  return (
    <GlassCard
      variant="accent"
      rounded="xl"
      padding="md"
      withInnerEffects={false}
      containerClassName={cardContainerClasses}
      className="relative z-10 space-y-3"
    >
      <div className={hoverOverlayClasses} aria-hidden />
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900 transition-colors duration-300 ease-out dark:text-white">
          {account.name}
        </div>
        <div className={balanceColor}>{balanceText}</div>
      </div>
      <div className="flex items-center justify-between">
        <div className={accountMetaClasses}>
          <AccountTypeDot type={account.type} />
          <span>{account.type}</span>
          <span className={accountMaskClasses}>••{account.mask}</span>
        </div>
        <RequirementPill className={transactionsPillClasses} status="pending">
          {account.transactions ?? 0} items
        </RequirementPill>
      </div>
    </GlassCard>
  )
}
