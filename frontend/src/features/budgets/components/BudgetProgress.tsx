import React from 'react'
import { fmtUSD } from '../../../utils/format'

export function BudgetProgress({ amount, spent }: { amount: number; spent: number }) {
  const percent = amount > 0 ? Math.min(100, (spent / amount) * 100) : 0
  const isOver = spent > amount
  return (
    <div>
      <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-600">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${isOver ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
        {percent.toFixed(0)}% used {isOver && (
          <span className="text-red-500 dark:text-red-400 ml-1">({fmtUSD(spent - amount)} over)</span>
        )}
      </div>
    </div>
  )
}

export default BudgetProgress

