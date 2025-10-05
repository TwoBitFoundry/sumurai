import React from 'react'
import { fmtUSD } from '../../../utils/format'

export function BudgetProgress({ amount, spent }: { amount: number; spent: number }) {
  const percent = amount > 0 ? Math.min(100, (spent / amount) * 100) : 0
  const isOver = spent > amount
  const remaining = Math.max(0, amount - spent)
  return (
    <div className="space-y-2.5">
      <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200/70 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-colors duration-300 dark:bg-slate-700/60 dark:shadow-[inset_0_1px_2px_rgba(2,6,23,0.35)]">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
            isOver
              ? 'bg-gradient-to-r from-rose-400 via-rose-500 to-rose-600 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
              : 'bg-gradient-to-r from-sky-400 via-cyan-400 to-violet-500 shadow-[0_0_12px_rgba(14,165,233,0.35)]'
          }`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[0.75rem] text-slate-500 transition-colors duration-300 dark:text-slate-400">
        <span className="font-medium tracking-wide">{percent.toFixed(0)}% used</span>
        <span className={isOver ? 'font-semibold text-red-600 dark:text-red-300' : 'font-semibold text-slate-600 dark:text-slate-300'}>
          {isOver ? `-${fmtUSD(spent - amount)} over` : `${fmtUSD(remaining)} left`}
        </span>
      </div>
    </div>
  )
}

export default BudgetProgress
