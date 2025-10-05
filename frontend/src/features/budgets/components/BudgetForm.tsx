import React from 'react'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { formatCategoryName } from '../../../utils/categories'

export interface BudgetFormValue { category: string; amount: string }

export function BudgetForm({
  categories,
  usedCategories,
  value,
  onChange,
  onSave,
  onCancel,
}: {
  categories: string[]
  usedCategories: Set<string>
  value: BudgetFormValue
  onChange: (v: BudgetFormValue) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <select
        data-testid="budget-category-select"
        value={value.category}
        onChange={e => onChange({ ...value, category: e.target.value })}
        className="min-w-[180px] flex-1 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.5)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400/80 focus:ring-offset-2 focus:ring-offset-white dark:border-white/12 dark:bg-[#111a2f]/80 dark:text-slate-100 dark:focus:ring-offset-[#0f172a]"
      >
        <option value="" disabled>Select category</option>
        {categories.map(cat => (
          <option key={cat} value={cat} disabled={usedCategories.has(cat)}>
            {formatCategoryName(cat)}{usedCategories.has(cat) ? ' (used)' : ''}
          </option>
        ))}
      </select>
      <input
        data-testid="budget-amount-input"
        type="number"
        min={0}
        step="0.01"
        placeholder="Amount"
        value={value.amount}
        onChange={e => onChange({ ...value, amount: e.target.value })}
        className="min-w-[140px] rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.5)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400/80 focus:ring-offset-2 focus:ring-offset-white dark:border-white/12 dark:bg-[#111a2f]/80 dark:text-slate-100 dark:focus:ring-offset-[#0f172a]"
      />
      <button
        data-testid="budget-save"
        onClick={onSave}
        className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400 px-5 py-2 text-sm font-semibold text-white shadow-[0_20px_55px_-28px_rgba(16,185,129,0.65)] transition-transform duration-300 hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]"
      >
        <CheckIcon className="h-4 w-4" />
        Save
      </button>
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1 rounded-full border border-white/55 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.5)] transition-transform duration-300 hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/12 dark:bg-[#111a2f]/70 dark:text-slate-100 dark:focus-visible:ring-offset-[#0f172a]"
      >
        <XMarkIcon className="h-4 w-4" />
        Cancel
      </button>
    </div>
  )
}

export default BudgetForm
