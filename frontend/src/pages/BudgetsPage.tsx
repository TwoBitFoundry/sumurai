import { useEffect, useMemo, useState } from 'react'
import Card from '../components/ui/Card'
import { Calendar as CalendarIcon, Loader2, Plus } from 'lucide-react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { BudgetForm, type BudgetFormValue } from '../features/budgets/components/BudgetForm'
import { BudgetList, type BudgetWithProgress } from '../features/budgets/components/BudgetList'
import { useBudgets } from '../features/budgets/hooks/useBudgets'
import { fmtUSD } from '../utils/format'

export default function BudgetsPage() {
  const {
    isLoading,
    transactionsLoading,
    error,
    validationError,
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
    void load()
  }, [load])

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

  const stats = useMemo(() => {
    if (!computedBudgets.length) {
      return {
        totalBudgeted: 0,
        totalSpent: 0,
        remaining: 0,
        averageUsage: 0,
        overBudgetCount: 0,
      }
    }
    const totals = computedBudgets.reduce(
      (acc, budget) => {
        acc.totalBudgeted += budget.amount
        acc.totalSpent += budget.spent
        acc.averageUsage += budget.percentage
        if (budget.spent > budget.amount) acc.overBudgetCount += 1
        return acc
      },
      { totalBudgeted: 0, totalSpent: 0, averageUsage: 0, overBudgetCount: 0 }
    )

    return {
      totalBudgeted: totals.totalBudgeted,
      totalSpent: totals.totalSpent,
      remaining: Math.max(0, totals.totalBudgeted - totals.totalSpent),
      averageUsage: totals.averageUsage / computedBudgets.length,
      overBudgetCount: totals.overBudgetCount,
    }
  }, [computedBudgets])

  const utilization = stats.totalBudgeted > 0 ? Math.min(1, stats.totalSpent / stats.totalBudgeted) : 0
  const budgetsLoading = isLoading || transactionsLoading
  const hasBudgets = computedBudgets.length > 0

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[2.75rem] border border-white/35 bg-white/24 p-6 shadow-[0_45px_140px_-80px_rgba(15,23,42,0.82)] backdrop-blur-2xl backdrop-saturate-[160%] transition-colors duration-500 ease-out sm:p-10 dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_48px_160px_-82px_rgba(2,6,23,0.85)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-[1px] rounded-[2.75rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(15,23,42,0.12)] dark:ring-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(2,6,23,0.5)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/28 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col gap-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl space-y-5">
              <span className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/70 px-4 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-600 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.55)] transition-colors duration-500 dark:border-white/15 dark:bg-[#1e293b]/70 dark:text-slate-200">
                Monthly envelopes
              </span>
              <div className="space-y-3">
                <h2 className="text-3xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white sm:text-4xl">
                  Budgets orchestrated around your month
                </h2>
                <p className="text-sm leading-relaxed text-slate-600 transition-colors duration-500 dark:text-slate-300">
                  Shape your spending plan, watch commitments, and stay ahead before the month runs away.
                </p>
              </div>
              {(error || validationError) && (
                <div className="space-y-2">
                  {error && (
                    <div className="max-w-md rounded-2xl border border-red-200/70 bg-red-50/80 px-5 py-3 text-sm font-medium text-red-600 shadow-sm transition-colors duration-500 dark:border-red-700/60 dark:bg-red-900/25 dark:text-red-300">
                      {error}
                    </div>
                  )}
                  {!error && validationError && (
                    <div className="max-w-md rounded-2xl border border-amber-200/80 bg-amber-50/80 px-5 py-3 text-sm font-medium text-amber-700 shadow-sm transition-colors duration-500 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-200">
                      {validationError}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex w-full max-w-md flex-col items-start gap-4 rounded-[1.75rem] border border-white/55 bg-white/80 p-4 shadow-[0_20px_65px_-50px_rgba(14,165,233,0.9)] transition-colors duration-500 dark:border-white/12 dark:bg-[#0f172a]/70 dark:shadow-[0_22px_70px_-48px_rgba(2,6,23,0.85)] sm:p-6">
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition-colors duration-500 dark:text-slate-300">
                  {monthLabel}
                </div>
                <div className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors duration-500 dark:text-slate-400">
                  {budgetsLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Updating
                    </>
                  ) : (
                    'Up to date'
                  )}
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 rounded-full border border-white/60 bg-white/70 p-1.5 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.55)] transition-colors duration-500 dark:border-white/10 dark:bg-[#111a2f]/60">
                <button
                  onClick={goToPreviousMonth}
                  aria-label="Previous month"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/70 text-slate-600 transition-all duration-200 hover:-translate-y-[2px] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/10 dark:bg-[#1e293b]/70 dark:text-slate-200 dark:hover:bg-[#1e293b]/85 dark:focus-visible:ring-offset-[#0f172a]"
                  title="Previous month"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={goToNextMonth}
                  aria-label="Next month"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/70 text-slate-600 transition-all duration-200 hover:-translate-y-[2px] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/10 dark:bg-[#1e293b]/70 dark:text-slate-200 dark:hover:bg-[#1e293b]/85 dark:focus-visible:ring-offset-[#0f172a]"
                  title="Next month"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={goToCurrentMonth}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/60 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-transform duration-200 hover:-translate-y-[2px] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/12 dark:bg-[#111a2f] dark:text-slate-100 dark:hover:bg-[#0f172a] dark:focus-visible:ring-offset-[#0f172a]"
                  title="Jump to current month"
                >
                  <CalendarIcon className="h-4 w-4" />
                  This Month
                </button>
              </div>

            <div className="grid w-full gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/55 bg-white/80 p-4 text-slate-700 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] transition-colors duration-500 dark:border-white/10 dark:bg-[#111a2f]/70 dark:text-slate-200">
                  <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Planned</div>
                  <div className="mt-2 text-xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">{fmtUSD(stats.totalBudgeted)}</div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/70">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-violet-500 shadow-[0_0_12px_rgba(14,165,233,0.35)]"
                      style={{ width: `${Math.min(100, utilization * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/55 bg-white/80 p-4 text-slate-700 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] transition-colors duration-500 dark:border-white/10 dark:bg-[#111a2f]/70 dark:text-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Remaining</div>
                    {stats.overBudgetCount > 0 && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-red-600 transition-colors duration-500 dark:bg-red-500/20 dark:text-red-300">
                        {stats.overBudgetCount} over
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">{fmtUSD(stats.remaining)}</div>
                  <div className="mt-1 text-[0.7rem] text-slate-500 transition-colors duration-500 dark:text-slate-400">
                    {fmtUSD(stats.totalSpent)} spent of {fmtUSD(stats.totalBudgeted)}
                  </div>
                </div>
              </div>

              {!isAdding ? (
                <button
                  onClick={startAdd}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-violet-500 px-5 py-2.5 text-[0.95rem] font-semibold text-white shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)] transition-transform duration-300 hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]"
                >
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/55 bg-white/80 p-4 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.55)] transition-colors duration-500 dark:border-white/10 dark:bg-[#111a2f]/70">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Utilization</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">{(utilization * 100).toFixed(0)}%</div>
              <div className="mt-1 text-[0.7rem] text-slate-500 transition-colors duration-500 dark:text-slate-400">Across all active budgets</div>
            </div>
            <div className="rounded-2xl border border-white/55 bg-white/80 p-4 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.55)] transition-colors duration-500 dark:border-white/10 dark:bg-[#111a2f]/70">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Active budgets</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">{computedBudgets.length}</div>
              <div className="mt-1 text-[0.7rem] text-slate-500 transition-colors duration-500 dark:text-slate-400">Ready for this window</div>
            </div>
            <div className="rounded-2xl border border-white/55 bg-white/80 p-4 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.55)] transition-colors duration-500 dark:border-white/10 dark:bg-[#111a2f]/70">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Average usage</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">{stats.averageUsage.toFixed(0)}%</div>
              <div className="mt-1 text-[0.7rem] text-slate-500 transition-colors duration-500 dark:text-slate-400">Per category this month</div>
            </div>
            <div className="rounded-2xl border border-white/55 bg-white/80 p-4 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.55)] transition-colors duration-500 dark:border-white/10 dark:bg-[#111a2f]/80">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Overages</div>
              <div className={`mt-2 text-2xl font-semibold transition-colors duration-500 ${stats.overBudgetCount > 0 ? 'text-red-600 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>
                {stats.overBudgetCount}
              </div>
              <div className="mt-1 text-[0.7rem] text-slate-500 transition-colors duration-500 dark:text-slate-400">Budgets above their plan</div>
            </div>
          </div>
        </div>
      </section>

      <Card className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/18 p-0 shadow-[0_40px_120px_-82px_rgba(15,23,42,0.75)] backdrop-blur-2xl backdrop-saturate-[150%] transition-colors duration-500 dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_42px_140px_-80px_rgba(2,6,23,0.85)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)] dark:ring-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.5)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/65 via-white/25 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
        </div>
        <div className="relative z-10">
          {hasBudgets ? (
            <BudgetList
              items={computedBudgets}
              editingId={editingId}
              onStartEdit={onStartEdit}
              onCancelEdit={cancel}
              onSaveEdit={onSaveEdit}
              onDelete={onDelete}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center sm:px-12" data-testid="budgets-empty-state">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-400/20 via-sky-300/25 to-violet-500/20 text-4xl">
                💰
              </div>
              <div className="text-lg font-semibold text-slate-700 transition-colors duration-500 dark:text-slate-200">No budgets yet</div>
              <div className="text-sm text-slate-500 transition-colors duration-500 dark:text-slate-400">
                Create your first category plan to watch spending settle into rhythm.
              </div>
              {!isAdding && (
                <button
                  onClick={startAdd}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)] transition-transform duration-300 hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]"
                >
                  <Plus className="h-4 w-4" />
                  Add budget
                </button>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
