import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import {
  Activity,
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Target,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn, EmptyState } from '@/ui/primitives';
import Card from '../components/ui/Card';
import HeroStatCard, { type HeroPill } from '../components/widgets/HeroStatCard';
import { BudgetCalculator } from '../domain/BudgetCalculator';
import { BudgetForm, type BudgetFormValue } from '../features/budgets/components/BudgetForm';
import { BudgetList, type BudgetWithProgress } from '../features/budgets/components/BudgetList';
import { useBudgets } from '../features/budgets/hooks/useBudgets';
import { PageLayout } from '../layouts/PageLayout';
import { formatCategoryName } from '../utils/categories';
import { fmtUSD } from '../utils/format';

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
  } = useBudgets();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetFormValue>({ category: '', amount: '' });
  // removed per standardized HeroStatCard; fades handled internally

  useEffect(() => {
    void load();
  }, [load]);

  // no local scroll fade handling needed here

  // HeroStatCard internally manages its own horizontal fade for pills

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setForm({ category: '', amount: '' });
  };
  const cancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setForm({ category: '', amount: '' });
  };
  const onSaveAdd = async () => {
    const amountNum = Number(form.amount);
    if (!form.category || !Number.isFinite(amountNum) || amountNum <= 0) return;
    try {
      await add(form.category, amountNum);
    } finally {
      cancel();
    }
  };
  const onStartEdit = (b: BudgetWithProgress) => {
    setEditingId(b.id);
  };
  const onSaveEdit = async (id: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    try {
      await update(id, amount);
    } finally {
      cancel();
    }
  };
  const onDelete = async (id: string) => {
    await remove(id);
  };

  const stats = useMemo(
    () => BudgetCalculator.computeStats(computedBudgets, month),
    [computedBudgets, month]
  );

  const activeBudgetPills: HeroPill[] = useMemo(() => {
    if (!stats.activeBudgetCategories?.length) return [];
    const unique = Array.from(new Set(stats.activeBudgetCategories));
    return unique
      .map((category) => ({
        raw: category,
        label: formatCategoryName(category),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(({ raw, label }) => ({
        label,
        type: 'category' as const,
        categoryName: raw,
      }));
  }, [stats.activeBudgetCategories]);

  const overBudgetCategoryPills: HeroPill[] = useMemo(() => {
    if (!stats.overBudgetCategories?.length) return [];
    const unique = Array.from(new Set(stats.overBudgetCategories));
    return unique
      .map((category) => ({
        raw: category,
        label: formatCategoryName(category),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(({ raw, label }) => ({
        label,
        type: 'category' as const,
        categoryName: raw,
      }));
  }, [stats.overBudgetCategories]);

  const overBudgetPills: HeroPill[] = useMemo(() => {
    if (overBudgetCategoryPills.length > 0) {
      return overBudgetCategoryPills;
    }
    if (stats.overBudgetCount === 0 && computedBudgets.length > 0) {
      return [
        {
          label: 'All budgets on track',
          type: 'semantic' as const,
          tone: 'success' as const,
        },
      ];
    }
    return [];
  }, [overBudgetCategoryPills, stats.overBudgetCount, computedBudgets.length]);

  const utilization = stats.totalBudgeted > 0 ? stats.totalSpent / stats.totalBudgeted : 0;
  const utilizationPercent = utilization * 100;
  const utilizationValue =
    utilizationPercent > 100
      ? `${(utilizationPercent / 100).toFixed(1)}x`
      : `${utilizationPercent.toFixed(0)}%`;
  const utilizationSuffix = utilizationPercent > 100 ? 'over budget' : 'of budget';
  const getUtilizationZone = (percent: number) => {
    if (percent <= 80)
      return {
        label: 'Healthy',
        color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      };
    if (percent <= 100)
      return {
        label: 'On Track',
        color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
      };
    if (percent <= 150)
      return {
        label: 'Overextended',
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      };
    return {
      label: 'Critical',
      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
  };
  const zone = getUtilizationZone(utilizationPercent);
  const budgetsLoading = isLoading || transactionsLoading;
  const hasBudgets = computedBudgets.length > 0;

  const heroStats = (
    <div className="space-y-3">
      <div className={cn('grid', 'gap-3', 'sm:grid-cols-2', 'lg:grid-cols-4')}>
        <HeroStatCard
          index={1}
          title="Active budgets"
          icon={<CheckCircle2 className={cn('h-4', 'w-4')} />}
          value={`${computedBudgets.length}`}
          suffix={`out of ${categoryOptions.length}`}
          pills={activeBudgetPills}
        />
        <HeroStatCard
          index={2}
          title="Monitor"
          icon={<Activity className={cn('h-4', 'w-4')} />}
          value={utilizationValue}
          suffix={utilizationSuffix}
          pills={[
            {
              label: zone.label,
              type: 'semantic',
              tone:
                zone.label === 'Healthy'
                  ? 'success'
                  : zone.label === 'On Track'
                    ? 'info'
                    : zone.label === 'Overextended'
                      ? 'warning'
                      : 'danger',
            },
          ]}
        />
        <HeroStatCard
          index={3}
          title="Days remaining"
          icon={<Clock className={cn('h-4', 'w-4')} />}
          value={stats.daysRemaining}
          suffix={`out of`}
          subtext={`${stats.totalDays} total days`}
        />
        <HeroStatCard
          index={4}
          title="Overages"
          icon={<AlertTriangle className={cn('h-4', 'w-4')} />}
          value={stats.overBudgetCount}
          suffix="over budget"
          pills={overBudgetPills}
        />
      </div>
      <div
        className={cn(
          'group',
          'relative',
          'overflow-hidden',
          'rounded-2xl',
          'border-2',
          'border-slate-200',
          'bg-white/80',
          'p-5',
          'text-slate-700',
          'shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)]',
          'transition-all',
          'duration-300',
          'hover:-translate-y-[2px]',
          'hover:border-slate-300',
          'dark:border-slate-700',
          'dark:bg-[#111a2f]/70',
          'dark:text-slate-200',
          'dark:hover:border-slate-600'
        )}
      >
        <div
          className={cn(
            'pointer-events-none',
            'absolute',
            'inset-0',
            'rounded-2xl',
            'bg-gradient-to-br',
            'from-slate-200/40',
            'via-slate-100/20',
            'to-transparent',
            'opacity-0',
            'transition-opacity',
            'duration-300',
            'group-hover:opacity-100',
            'dark:from-slate-700/40',
            'dark:via-slate-800/20'
          )}
        />
        <div className={cn('relative', 'z-10', 'flex', 'items-center', 'justify-between', 'gap-4')}>
          <div>
            <div
              className={cn(
                'text-[0.65rem]',
                'font-semibold',
                'uppercase',
                'tracking-[0.24em]',
                'text-slate-500',
                'transition-colors',
                'duration-500',
                'dark:text-slate-400'
              )}
            >
              Total Planned
            </div>
            <div
              className={cn(
                'mt-1',
                'text-2xl',
                'font-semibold',
                'text-slate-900',
                'transition-colors',
                'duration-500',
                'dark:text-white'
              )}
            >
              {fmtUSD(stats.totalBudgeted)}
            </div>
          </div>
          <div className="text-right">
            <div
              className={cn(
                'text-[0.65rem]',
                'font-semibold',
                'uppercase',
                'tracking-[0.24em]',
                'text-slate-500',
                'transition-colors',
                'duration-500',
                'dark:text-slate-400'
              )}
            >
              Total Spent
            </div>
            <div
              className={`mt-1 text-2xl font-semibold transition-colors duration-500 ${stats.totalSpent > stats.totalBudgeted ? 'text-red-600 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`}
            >
              {fmtUSD(stats.totalSpent)}
            </div>
          </div>
        </div>
        <div className={cn('relative', 'z-10', 'mt-4', 'space-y-2.5')}>
          <div
            className={cn(
              'relative',
              'h-2.5',
              'overflow-hidden',
              'rounded-full',
              'bg-slate-200/70',
              'shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]',
              'transition-colors',
              'duration-300',
              'dark:bg-slate-700/60',
              'dark:shadow-[inset_0_1px_2px_rgba(2,6,23,0.35)]'
            )}
          >
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                stats.totalSpent > stats.totalBudgeted
                  ? 'bg-gradient-to-r from-rose-400 via-rose-500 to-rose-600 shadow-[0_0_12px_rgba(244,63,94,0.35)]'
                  : 'bg-gradient-to-r from-sky-400 via-cyan-400 to-violet-500 shadow-[0_0_12px_rgba(14,165,233,0.35)]'
              }`}
              style={{ width: `${Math.min(100, utilization * 100)}%` }}
            />
          </div>
          <div
            className={cn(
              'flex',
              'items-center',
              'justify-between',
              'text-[0.75rem]',
              'text-slate-500',
              'transition-colors',
              'duration-300',
              'dark:text-slate-400'
            )}
          >
            <span className={cn('font-medium', 'tracking-wide')}>
              {(utilization * 100).toFixed(0)}% used
            </span>
            <span
              className={
                stats.totalSpent > stats.totalBudgeted
                  ? 'font-semibold text-red-600 dark:text-red-300'
                  : 'font-semibold text-slate-600 dark:text-slate-300'
              }
            >
              {stats.totalSpent > stats.totalBudgeted
                ? `-${fmtUSD(stats.totalSpent - stats.totalBudgeted)} over`
                : `${fmtUSD(stats.remaining)} left`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const errorMessage = error || (validationError && !error ? validationError : null);

  return (
    <div data-testid="budgets-page">
      <PageLayout
        badge="Monthly Budgets"
        title="Budgets at a glance"
        subtitle="Shape your spending plan, watch commitments, and stay ahead before the month runs away."
        error={errorMessage}
        stats={heroStats}
      >
        <Card className="p-0">
          {hasBudgets ? (
            <>
              <div
                className={cn(
                  'flex',
                  'flex-wrap',
                  'items-center',
                  'justify-between',
                  'gap-3',
                  'px-6',
                  'py-4'
                )}
              >
                <div className={cn('flex', 'items-center', 'gap-3')}>
                  <div className={cn('flex', 'items-center', 'gap-2')}>
                    <button
                      type="button"
                      onClick={goToPreviousMonth}
                      aria-label="Previous month"
                      className={cn(
                        'inline-flex',
                        'h-9',
                        'w-9',
                        'items-center',
                        'justify-center',
                        'rounded-full',
                        'border',
                        'border-white/50',
                        'bg-white/70',
                        'text-slate-600',
                        'transition-all',
                        'duration-200',
                        'hover:-translate-y-[2px]',
                        'hover:bg-white/90',
                        'focus-visible:outline-none',
                        'focus-visible:ring-2',
                        'focus-visible:ring-sky-400/70',
                        'focus-visible:ring-offset-2',
                        'focus-visible:ring-offset-white',
                        'dark:border-white/10',
                        'dark:bg-[#1e293b]/70',
                        'dark:text-slate-200',
                        'dark:hover:bg-[#1e293b]/85',
                        'dark:focus-visible:ring-offset-[#0f172a]'
                      )}
                      title="Previous month"
                    >
                      <ChevronLeftIcon className={cn('h-4', 'w-4')} />
                    </button>
                    <button
                      type="button"
                      onClick={goToNextMonth}
                      aria-label="Next month"
                      className={cn(
                        'inline-flex',
                        'h-9',
                        'w-9',
                        'items-center',
                        'justify-center',
                        'rounded-full',
                        'border',
                        'border-white/50',
                        'bg-white/70',
                        'text-slate-600',
                        'transition-all',
                        'duration-200',
                        'hover:-translate-y-[2px]',
                        'hover:bg-white/90',
                        'focus-visible:outline-none',
                        'focus-visible:ring-2',
                        'focus-visible:ring-sky-400/70',
                        'focus-visible:ring-offset-2',
                        'focus-visible:ring-offset-white',
                        'dark:border-white/10',
                        'dark:bg-[#1e293b]/70',
                        'dark:text-slate-200',
                        'dark:hover:bg-[#1e293b]/85',
                        'dark:focus-visible:ring-offset-[#0f172a]'
                      )}
                      title="Next month"
                    >
                      <ChevronRightIcon className={cn('h-4', 'w-4')} />
                    </button>
                  </div>
                  <div
                    className={cn(
                      'text-xs',
                      'font-semibold',
                      'uppercase',
                      'tracking-[0.2em]',
                      'text-slate-600',
                      'transition-colors',
                      'duration-500',
                      'dark:text-slate-300'
                    )}
                  >
                    {monthLabel}
                  </div>
                </div>
                <div className={cn('flex', 'items-center', 'gap-3')}>
                  <div
                    className={cn(
                      'inline-flex',
                      'items-center',
                      'gap-1',
                      'text-xs',
                      'font-medium',
                      'text-slate-500',
                      'transition-colors',
                      'duration-500',
                      'dark:text-slate-400'
                    )}
                  >
                    {budgetsLoading && (
                      <>
                        <Loader2
                          className={cn('h-3.5', 'w-3.5', 'animate-spin')}
                          aria-hidden="true"
                        />
                        Updating
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={goToCurrentMonth}
                    className={cn(
                      'inline-flex',
                      'items-center',
                      'justify-center',
                      'gap-2',
                      'rounded-full',
                      'border',
                      'border-white/60',
                      'bg-white',
                      'px-4',
                      'py-2',
                      'text-sm',
                      'font-semibold',
                      'text-slate-700',
                      'transition-transform',
                      'duration-200',
                      'hover:-translate-y-[2px]',
                      'hover:bg-white/90',
                      'focus-visible:outline-none',
                      'focus-visible:ring-2',
                      'focus-visible:ring-sky-400/80',
                      'focus-visible:ring-offset-2',
                      'focus-visible:ring-offset-white',
                      'dark:border-white/12',
                      'dark:bg-[#111a2f]',
                      'dark:text-slate-100',
                      'dark:hover:bg-[#0f172a]',
                      'dark:focus-visible:ring-offset-[#0f172a]'
                    )}
                    title="Jump to current month"
                  >
                    <CalendarIcon className={cn('h-4', 'w-4')} />
                    This Month
                  </button>
                  {!isAdding ? (
                    <button
                      type="button"
                      onClick={startAdd}
                      className={cn(
                        'inline-flex',
                        'items-center',
                        'justify-center',
                        'gap-2',
                        'rounded-full',
                        'bg-gradient-to-r',
                        'from-sky-500',
                        'via-sky-400',
                        'to-violet-500',
                        'px-5',
                        'py-2.5',
                        'text-[0.95rem]',
                        'font-semibold',
                        'text-white',
                        'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)]',
                        'transition-transform',
                        'duration-300',
                        'hover:-translate-y-[3px]',
                        'focus-visible:outline-none',
                        'focus-visible:ring-2',
                        'focus-visible:ring-sky-400',
                        'focus-visible:ring-offset-2',
                        'focus-visible:ring-offset-white',
                        'dark:focus-visible:ring-offset-[#0f172a]'
                      )}
                    >
                      <Plus className={cn('h-4', 'w-4')} />
                      Add budget
                    </button>
                  ) : null}
                </div>
              </div>
              {isAdding && (
                <div className={cn('px-6', 'pb-6', 'flex', 'justify-center')}>
                  <div className="w-full max-w-md">
                    <BudgetForm
                      categories={categoryOptions}
                      usedCategories={usedCategories}
                      value={form}
                      onChange={setForm}
                      onSave={onSaveAdd}
                      onCancel={cancel}
                    />
                  </div>
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
            <>
              <EmptyState
                icon={Target}
                title="No budgets found"
                description="Create your first category plan to watch spending settle into rhythm."
                action={
                  !isAdding ? (
                    <button
                      type="button"
                      onClick={startAdd}
                      className={cn(
                        'inline-flex',
                        'items-center',
                        'gap-2',
                        'rounded-full',
                        'bg-gradient-to-r',
                        'from-sky-500',
                        'via-sky-400',
                        'to-violet-500',
                        'px-5',
                        'py-2.5',
                        'text-sm',
                        'font-semibold',
                        'text-white',
                        'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)]',
                        'transition-transform',
                        'duration-300',
                        'hover:-translate-y-[3px]',
                        'focus-visible:outline-none',
                        'focus-visible:ring-2',
                        'focus-visible:ring-sky-400',
                        'focus-visible:ring-offset-2',
                        'focus-visible:ring-offset-white',
                        'dark:focus-visible:ring-offset-[#0f172a]'
                      )}
                    >
                      <Plus className={cn('h-4', 'w-4')} />
                      Add budget
                    </button>
                  ) : null
                }
                data-testid="budgets-empty-state"
              />
              {isAdding && (
                <div className={cn('px-6', 'pb-6', 'flex', 'justify-center')}>
                  <div className="w-full max-w-md">
                    <BudgetForm
                      categories={categoryOptions}
                      usedCategories={usedCategories}
                      value={form}
                      onChange={setForm}
                      onSave={onSaveAdd}
                      onCancel={cancel}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </PageLayout>
    </div>
  );
}
