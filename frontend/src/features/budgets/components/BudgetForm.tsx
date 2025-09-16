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
    <div className="flex items-center gap-2">
      <select
        data-testid="budget-category-select"
        value={value.category}
        onChange={e => onChange({ ...value, category: e.target.value })}
        className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
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
        className="w-28 px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
      />
      <button data-testid="budget-save" onClick={onSave} className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white inline-flex items-center gap-1">
        <CheckIcon className="w-4 h-4" />
        Save
      </button>
      <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 inline-flex items-center gap-1">
        <XMarkIcon className="w-4 h-4" />
        Cancel
      </button>
    </div>
  )
}

export default BudgetForm

