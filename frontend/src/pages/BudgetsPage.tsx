import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../components/ui/Card'
import { Calendar as CalendarIcon, Plus } from 'lucide-react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { BudgetForm, type BudgetFormValue } from '../features/budgets/components/BudgetForm'
import { BudgetList, type BudgetWithProgress } from '../features/budgets/components/BudgetList'
import { useBudgets } from '../features/budgets/hooks/useBudgets'
import { TransactionService } from '../services/TransactionService'
import type { Transaction } from '../types/api'
import { formatCategoryName } from '../utils/categories'

export default function BudgetsPage({ loadedFlag, active = true }: { loadedFlag?: React.MutableRefObject<boolean>, active?: boolean }) {
  const { budgets, load, add, update, remove, categories, error, validationError } = useBudgets()
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BudgetFormValue>({ category: '', amount: '' })
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [txns, setTxns] = useState<Transaction[]>([])

  const monthLabel = useMemo(() => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month), [month])
  const range = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    return { start: fmt(start), end: fmt(end) }
  }, [month])

  useEffect(() => {
    if (loadedFlag?.current) return
    load().then(() => { if (loadedFlag) loadedFlag.current = true })
  }, [load, loadedFlag])

  const loadTxns = useCallback(async () => {
    try {
      const list = await TransactionService.getTransactions({ startDate: range.start, endDate: range.end })
      setTxns(list)
    } catch {
      setTxns([])
    }
  }, [range.start, range.end])

  useEffect(() => { loadTxns() }, [loadTxns])

  const usedCategories = useMemo(() => new Set(budgets.map(b => b.category)), [budgets])
  const allCategoryIds = useMemo(() => Array.from(new Set(txns.map(t => t.category?.id || 'other'))).sort(), [txns])

  const computed: BudgetWithProgress[] = useMemo(() => {
    const { start, end } = range
    return budgets.map(b => {
      const catId = b.category
      const catNameLower = formatCategoryName(b.category).toLowerCase()
      const spent = txns
        .filter(t => (t.category?.id === catId) || ((t.category?.name || '').toLowerCase() === catNameLower))
        .filter(t => {
          const ds = new Date(t.date).toISOString().slice(0,10)
          return ds >= start && ds <= end
        })
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
      const percentage = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0
      return { ...b, spent, percentage }
    }) as BudgetWithProgress[]
  }, [budgets, txns, range])

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
              <button onClick={() => setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} aria-label="Previous month" className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700" title="Previous month">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button onClick={() => setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} aria-label="Next month" className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700" title="Next month">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
              <button onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); }} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-3 text-sm font-medium whitespace-nowrap shadow-sm bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-600" title="Jump to current month">
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
              categories={allCategoryIds}
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
        {computed.length > 0 ? (
          <BudgetList
            items={computed}
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
