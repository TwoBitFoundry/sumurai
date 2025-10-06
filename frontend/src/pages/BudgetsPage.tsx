import { useEffect, useMemo, useRef, useState } from 'react'
import Card from '../components/ui/Card'
import { Calendar as CalendarIcon, Loader2, Plus, CheckCircle2, Activity, Clock, AlertTriangle } from 'lucide-react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { BudgetForm, type BudgetFormValue } from '../features/budgets/components/BudgetForm'
import { BudgetList, type BudgetWithProgress } from '../features/budgets/components/BudgetList'
import { useBudgets } from '../features/budgets/hooks/useBudgets'
import { fmtUSD } from '../utils/format'
import { getTagThemeForCategory, formatCategoryName } from '../utils/categories'
import HeroStatCard from '../components/widgets/HeroStatCard'

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
    month,
    monthLabel,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
  } = useBudgets()
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BudgetFormValue>({ category: '', amount: '' })
  // removed per standardized HeroStatCard; fades handled internally

  useEffect(() => {
    void load()
  }, [load])

  // no local scroll fade handling needed here

  // HeroStatCard internally manages its own horizontal fade for pills

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
        variance: 0,
        overBudgetCount: 0,
        overBudgetCategories: [] as string[],
        daysRemaining: 0,
        totalDays: 0,
        activeBudgetCategories: [] as string[],
        nearLimitCategories: [] as string[],
      }
    }
    const totals = computedBudgets.reduce(
      (acc, budget) => {
        acc.totalBudgeted += budget.amount
        acc.totalSpent += budget.spent
        if (budget.spent > budget.amount) {
          acc.overBudgetCount += 1
          acc.overBudgetCategories.push(budget.category)
        }
        return acc
      },
      { totalBudgeted: 0, totalSpent: 0, overBudgetCount: 0, overBudgetCategories: [] as string[] }
    )

    const variance = totals.totalBudgeted - totals.totalSpent

    const now = new Date()
    const year = month.getFullYear()
    const monthNum = month.getMonth()
    const lastDay = new Date(year, monthNum + 1, 0).getDate()

    let daysRemaining = 0
    if (now.getFullYear() === year && now.getMonth() === monthNum) {
      daysRemaining = Math.max(0, lastDay - now.getDate())
    } else if (now.getFullYear() < year || (now.getFullYear() === year && now.getMonth() < monthNum)) {
      daysRemaining = lastDay
    }

    const activeBudgetCategories = computedBudgets.map(b => b.category)

    const nearLimitCategories = computedBudgets
      .filter(b => {
        const utilization = b.amount > 0 ? b.spent / b.amount : 0
        return utilization >= 0.8 && utilization < 1.0
      })
      .slice(0, 3)
      .map(b => b.category)

    return {
      totalBudgeted: totals.totalBudgeted,
      totalSpent: totals.totalSpent,
      remaining: Math.max(0, totals.totalBudgeted - totals.totalSpent),
      variance,
      overBudgetCount: totals.overBudgetCount,
      overBudgetCategories: totals.overBudgetCategories,
      daysRemaining,
      totalDays: lastDay,
      activeBudgetCategories,
      nearLimitCategories,
    }
  }, [computedBudgets, month])

  const utilization = stats.totalBudgeted > 0 ? stats.totalSpent / stats.totalBudgeted : 0
  const utilizationPercent = utilization * 100
  const utilizationValue = utilizationPercent > 100
    ? `${(utilizationPercent / 100).toFixed(1)}x`
    : `${utilizationPercent.toFixed(0)}%`
  const utilizationSuffix = utilizationPercent > 100 ? 'over budget' : 'of budget'
  const getUtilizationZone = (percent: number) => {
    if (percent <= 80) return { label: 'Healthy', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
    if (percent <= 100) return { label: 'On Track', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' }
    if (percent <= 150) return { label: 'Overextended', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
    return { label: 'Critical', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' }
  }
  const zone = getUtilizationZone(utilizationPercent)
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
            <div className="space-y-5">
              <span className="inline-flex items-center justify-center rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-600 shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)] dark:bg-[#1e293b]/75 dark:text-slate-200">
                Monthly Budgets
              </span>
              <div className="space-y-3">
                <h2 className="text-3xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white sm:text-4xl">
                  Budgets at a glance
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

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <HeroStatCard
                  index={1}
                  title="Active budgets"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  value={`${computedBudgets.length}`}
                  suffix={`out of ${categoryOptions.length}`}
                  pills={stats.activeBudgetCategories.map((category) => ({
                    label: formatCategoryName(category),
                    type: 'category' as const,
                    categoryName: formatCategoryName(category),
                  }))}
                />
                <HeroStatCard
                  index={2}
                  title="Monitor"
                  icon={<Activity className="h-4 w-4" />}
                  value={utilizationValue}
                  suffix={utilizationSuffix}
                  pills={[{ label: zone.label, type: 'semantic', tone: (
                    zone.label === 'Healthy' ? 'success' :
                    zone.label === 'On Track' ? 'info' :
                    zone.label === 'Overextended' ? 'warning' : 'danger'
                  ) }]}
                />
                <HeroStatCard
                  index={3}
                  title="Days remaining"
                  icon={<Clock className="h-4 w-4" />}
                  value={stats.daysRemaining}
                  suffix={`out of`}
                  subtext={`${stats.totalDays} total days`}
                />
                <HeroStatCard
                  index={4}
                  title="Overages"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  value={stats.overBudgetCount}
                  suffix="over budget"
                  pills={stats.overBudgetCategories.map((category) => ({
                    label: formatCategoryName(category),
                    type: 'category' as const,
                    categoryName: formatCategoryName(category),
                  }))}
                />
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-5 text-slate-700 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] transition-all duration-300 hover:-translate-y-[2px] hover:border-slate-300 dark:border-slate-700 dark:bg-[#111a2f]/70 dark:text-slate-200 dark:hover:border-slate-600">
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-200/40 via-slate-100/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-slate-700/40 dark:via-slate-800/20" />
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Total Planned</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">{fmtUSD(stats.totalBudgeted)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Total Spent</div>
                    <div className={`mt-1 text-2xl font-semibold transition-colors duration-500 ${stats.totalSpent > stats.totalBudgeted ? 'text-red-600 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`}>{fmtUSD(stats.totalSpent)}</div>
                  </div>
                </div>
                <div className="relative z-10 mt-4 space-y-2.5">
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200/70 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-colors duration-300 dark:bg-slate-700/60 dark:shadow-[inset_0_1px_2px_rgba(2,6,23,0.35)]">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                        stats.totalSpent > stats.totalBudgeted
                          ? 'bg-gradient-to-r from-rose-400 via-rose-500 to-rose-600 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
                          : 'bg-gradient-to-r from-sky-400 via-cyan-400 to-violet-500 shadow-[0_0_12px_rgba(14,165,233,0.35)]'
                      }`}
                      style={{ width: `${Math.min(100, utilization * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[0.75rem] text-slate-500 transition-colors duration-300 dark:text-slate-400">
                    <span className="font-medium tracking-wide">{(utilization * 100).toFixed(0)}% used</span>
                    <span className={stats.totalSpent > stats.totalBudgeted ? 'font-semibold text-red-600 dark:text-red-300' : 'font-semibold text-slate-600 dark:text-slate-300'}>
                      {stats.totalSpent > stats.totalBudgeted ? `-${fmtUSD(stats.totalSpent - stats.totalBudgeted)} over` : `${fmtUSD(stats.remaining)} left`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </section>

      <Card className="p-0">
          {hasBudgets ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
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
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition-colors duration-500 dark:text-slate-300">
                    {monthLabel}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors duration-500 dark:text-slate-400">
                    {budgetsLoading && (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        Updating
                      </>
                    )}
                  </div>
                  <button
                    onClick={goToCurrentMonth}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/60 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-transform duration-200 hover:-translate-y-[2px] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/12 dark:bg-[#111a2f] dark:text-slate-100 dark:hover:bg-[#0f172a] dark:focus-visible:ring-offset-[#0f172a]"
                    title="Jump to current month"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    This Month
                  </button>
                  {!isAdding ? (
                    <button
                      onClick={startAdd}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-violet-500 px-5 py-2.5 text-[0.95rem] font-semibold text-white shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)] transition-transform duration-300 hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]"
                    >
                      <Plus className="h-4 w-4" />
                      Add budget
                    </button>
                  ) : null}
                </div>
              </div>
              {isAdding && (
                <div className="px-6 pb-6">
                  <BudgetForm
                    categories={categoryOptions}
                    usedCategories={usedCategories}
                    value={form}
                    onChange={setForm}
                    onSave={onSaveAdd}
                    onCancel={cancel}
                  />
                </div>
              )}
              <BudgetList
                items={computedBudgets}
                editingId={editingId}
                onStartEdit={onStartEdit}
                onCancelEdit={cancel}
                onSaveEdit={onSaveEdit}
                onDelete={onDelete}
              />
            </>
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
      </Card>
    </div>
  )
}
