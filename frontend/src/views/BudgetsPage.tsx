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
import { Button, GlassCard, cn, EmptyState } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';
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

  useEffect(() => {
    void load();
  }, [load]);

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
    if (percent <= 80) return 'Healthy';
    if (percent <= 100) return 'On Track';
    if (percent <= 150) return 'Overextended';
    return 'Critical';
  };
  const zone = getUtilizationZone(utilizationPercent);
  const budgetsLoading = isLoading || transactionsLoading;
  const hasBudgets = computedBudgets.length > 0;
  const budgetProgress = designTokens.components.budgetProgress;

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
              label: zone,
              type: 'semantic',
              tone:
                zone === 'Healthy'
                  ? 'success'
                  : zone === 'On Track'
                    ? 'info'
                    : zone === 'Overextended'
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
          ...designTokens.surfaces.layered.panel70,
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
                designTokens.typography.label,
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
                designTokens.typography.label,
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
          <div className={cn(budgetProgress.track)}>
            <div
              className={cn(
                budgetProgress.fill.base,
                stats.totalSpent > stats.totalBudgeted
                  ? budgetProgress.fill.over
                  : budgetProgress.fill.within
              )}
              style={{ width: `${Math.min(100, utilization * 100)}%` }}
            />
          </div>
          <div className={cn(budgetProgress.caption.row)}>
            <span className={cn(budgetProgress.caption.percent)}>
              {(utilization * 100).toFixed(0)}% used
            </span>
            <span
              className={cn(
                stats.totalSpent > stats.totalBudgeted
                  ? budgetProgress.caption.summaryOver
                  : budgetProgress.caption.summaryWithin
              )}
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
        <GlassCard className="p-0">
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
                      className={cn(designTokens.components.actions.paginationRound)}
                      title="Previous month"
                    >
                      <ChevronLeftIcon className={cn('h-4', 'w-4')} />
                    </button>
                    <button
                      type="button"
                      onClick={goToNextMonth}
                      aria-label="Next month"
                      className={cn(designTokens.components.actions.paginationRound)}
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
                  <Button
                    type="button"
                    onClick={goToCurrentMonth}
                    variant="ghost"
                    size="md"
                    className={cn('px-4')}
                    title="Jump to current month"
                  >
                    <CalendarIcon className={cn('h-4', 'w-4')} />
                    This Month
                  </Button>
                  {!isAdding ? (
                    <Button
                      type="button"
                      onClick={startAdd}
                      variant="primary"
                      size="lg"
                    >
                      <Plus className={cn('h-4', 'w-4')} />
                      Add budget
                    </Button>
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
                    <Button
                      type="button"
                      onClick={startAdd}
                      variant="primary"
                      size="md"
                    >
                      <Plus className={cn('h-4', 'w-4')} />
                      Add budget
                    </Button>
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
        </GlassCard>
      </PageLayout>
    </div>
  );
}
