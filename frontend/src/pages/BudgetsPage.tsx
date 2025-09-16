import React, { useEffect, useState } from 'react'
import Card from '../components/ui/Card'
import { Calendar as CalendarIcon, Plus } from 'lucide-react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { BudgetForm, type BudgetFormValue } from '../features/budgets/components/BudgetForm'
import { BudgetList, type BudgetWithProgress } from '../features/budgets/components/BudgetList'
import { useBudgets } from '../features/budgets/hooks/useBudgets'

export default function BudgetsPage({ loadedFlag, active = true }: { loadedFlag?: React.MutableRefObject<boolean>, active?: boolean }) {
  const {
    load,
    add,
    update,
    remove,
    computedBudgets,
    categoryOptions,
    usedCategories,
    monthLabel,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
  } = useBudgets()
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BudgetFormValue>({ category: '', amount: '' })

  useEffect(() => {
    if (loadedFlag?.current) return
    load().then(() => { if (loadedFlag) loadedFlag.current = true })
  }, [load, loadedFlag])

  const startAdd = () => { setIsAdding(true); setEditingId(null); setForm({ category: '', amount: '' }) }
  const cancel = () => { setIsAdding(false); setEditingId(null); setForm({ category: '', amount: '' }) }
  const onSaveAdd = async () => {
    const amountNum = Number(form.amount)
    if (!form.category || !Number.isFinite(amountNum) || amountNum <= 0) return
    try {
      await add(form.category, amountNum)
    } finally {
      cancel()
    }
  }
  const onStartEdit = (b: BudgetWithProgress) => { setEditingId(b.id) }
  const onSaveEdit = async (id: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    try {
      await update(id, amount)
    } finally {
      cancel()
    }
  }
  const onDelete = async (id: string) => { await remove(id) }

  return (
    <div className="space-y-6">
      {active && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Budgets</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Plan monthly spending and track progress by category.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">{monthLabel}</div>
              <div className="flex items-center gap-2">
                <button onClick={goToPreviousMonth} aria-label="Previous month" className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700" title="Previous month">
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button onClick={goToNextMonth} aria-label="Next month" className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700" title="Next month">
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
                <button onClick={goToCurrentMonth} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-3 text-sm font-medium whitespace-nowrap shadow-sm bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-600" title="Jump to current month">
                  <CalendarIcon className="w-4 h-4" />
                  Today
                </button>
              </div>
            </div>
            {!isAdding ? (
              <button onClick={startAdd} className="inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-500 px-3 text-sm font-semibold text-white shadow whitespace-nowrap">
                <Plus className="h-4 w-4" />
                Add budget
              </button>
            ) : (
              <BudgetForm
                categories={categoryOptions}
                usedCategories={usedCategories}
                value={form}
                onChange={setForm}
                onSave={onSaveAdd}
                onCancel={cancel}
              />
            )}
          </div>
        </div>
      )}
      <Card className="p-0 overflow-hidden">
        {computedBudgets.length > 0 ? (
          <BudgetList
            items={computedBudgets}
            editingId={editingId}
            onStartEdit={onStartEdit}
            onCancelEdit={cancel}
            onSaveEdit={onSaveEdit}
            onDelete={onDelete}
          />
        ) : (
          <div className="text-center py-16 px-3" data-testid="budgets-empty-state">
            <div className="text-6xl mb-4 opacity-30">💰</div>
            <div className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">No budgets found</div>
            <div className="text-sm text-slate-500 dark:text-slate-500">Add a budget to get started</div>
          </div>
        )}
      </Card>
    </div>
  )
}

