import React from 'react'
import { formatCategoryName, getTagThemeForCategory } from '../../../utils/categories'
import { fmtUSD } from '../../../utils/format'
import { PencilSquareIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { TrashIcon as TrashSolidIcon } from '@heroicons/react/24/solid'
import BudgetProgress from './BudgetProgress'
import type { BudgetProgressEntry } from '../hooks/useBudgets'

export interface BudgetWithProgress extends BudgetProgressEntry {}

export function BudgetList({
  items,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  items: BudgetWithProgress[]
  editingId: string | null
  onStartEdit: (b: BudgetWithProgress) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string, amount: number) => void
  onDelete: (id: string) => void
}) {
  const [amountDrafts, setAmountDrafts] = React.useState<Record<string, string>>({})
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 p-3">
      {items.map((b) => {
        const isOver = b.spent > b.amount
        const tagTheme = getTagThemeForCategory(formatCategoryName(b.category))
        const isEditing = editingId === b.id
        const draft = amountDrafts[b.id] ?? String(b.amount)
        return (
          <li key={b.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-6">
            <div className="flex items-start justify-between">
              <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs ${tagTheme.tag}`}>● {formatCategoryName(b.category)}</div>
              <div className="flex gap-2 text-xs">
                {isEditing ? (
                  <>
                    <button onClick={() => onSaveEdit(b.id, Number(draft))} title="Save" aria-label="Save budget" className="p-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">
                      <CheckIcon className="w-4 h-4" />
                    </button>
                    <button onClick={onCancelEdit} title="Cancel" aria-label="Cancel edit" className="p-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onStartEdit(b)} title="Edit budget" aria-label="Edit budget" className="p-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(b.id)} title="Delete budget" aria-label="Delete budget" className="p-1.5 rounded-md bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40">
                      <TrashSolidIcon className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              {isEditing ? (
                <>
                  <input
                    data-testid="budget-amount-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft}
                    onChange={e => setAmountDrafts(d => ({ ...d, [b.id]: e.target.value }))}
                    className="w-28 px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  />
                  <div className="text-sm text-slate-600 dark:text-slate-400">{fmtUSD(b.spent)}</div>
                </>
              ) : (
                <>
                  <div className="text-lg">{fmtUSD(b.amount)}</div>
                  <div className={`text-sm font-medium ${isOver ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>{fmtUSD(b.spent)}</div>
                </>
              )}
            </div>
            <BudgetProgress amount={b.amount} spent={b.spent} />
          </li>
        )
      })}
    </ul>
  )
}

export default BudgetList

