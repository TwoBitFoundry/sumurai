import React from 'react'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { formatCategoryName } from '../../../utils/categories'
import { Button, Input } from '../../../ui/primitives'
import { cn } from '@/ui/primitives'

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
    <div className={cn('flex', 'w-full', 'flex-wrap', 'items-center', 'gap-2')}>
      <select
        data-testid="budget-category-select"
        value={value.category}
        onChange={e => onChange({ ...value, category: e.target.value })}
        className={cn('min-w-[180px]', 'flex-1', 'rounded-full', 'border', 'border-white/60', 'bg-white/80', 'px-4', 'py-2', 'text-sm', 'font-medium', 'text-slate-700', 'shadow-[0_18px_45px_-32px_rgba(15,23,42,0.5)]', 'transition-colors', 'duration-200', 'focus:outline-none', 'focus:ring-2', 'focus:ring-sky-400/80', 'focus:ring-offset-2', 'focus:ring-offset-white', 'dark:border-white/12', 'dark:bg-[#111a2f]/80', 'dark:text-slate-100', 'dark:focus:ring-offset-[#0f172a]')}
      >
        <option value="" disabled>Select category</option>
        {categories.map(cat => (
          <option key={cat} value={cat} disabled={usedCategories.has(cat)}>
            {formatCategoryName(cat)}{usedCategories.has(cat) ? ' (used)' : ''}
          </option>
        ))}
      </select>
      <Input
        data-testid="budget-amount-input"
        type="number"
        min={0}
        step="0.01"
        placeholder="Amount"
        value={value.amount}
        onChange={e => onChange({ ...value, amount: e.target.value })}
        variant="glass"
        className={cn('min-w-[140px]', 'rounded-full')}
      />
      <Button
        data-testid="budget-save"
        onClick={onSave}
        variant="success"
      >
        <CheckIcon className={cn('h-4', 'w-4')} />
        Save
      </Button>
      <Button
        onClick={onCancel}
        variant="ghost"
      >
        <XMarkIcon className={cn('h-4', 'w-4')} />
        Cancel
      </Button>
    </div>
  )
}

export default BudgetForm