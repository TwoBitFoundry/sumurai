import { Activity, AlertTriangle, CheckCircle2, Clock, Plus, Target } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, cn, EmptyState, GlassCard } from '@/ui/primitives';
import HeroStatCard, { type HeroPill } from '../components/widgets/HeroStatCard';
import { BudgetCalculator } from '../domain/BudgetCalculator';
import { BudgetForm, type BudgetFormValue } from '../features/budgets/components/BudgetForm';
import { BudgetList, type BudgetWithProgress } from '../features/budgets/components/BudgetList';
import BudgetSummaryCard from '../features/budgets/components/BudgetSummaryCard';
import BudgetToolbar from '../features/budgets/components/BudgetToolbar';
import { useBudgets } from '../features/budgets/hooks/useBudgets';
import { PageLayout } from '../layouts/PageLayout';
import { formatCategoryName } from '../utils/categories';

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
      <BudgetSummaryCard totalBudgeted={stats.totalBudgeted} totalSpent={stats.totalSpent} />
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
              <BudgetToolbar
                monthLabel={monthLabel}
                loading={budgetsLoading}
                isAdding={isAdding}
                showAddButton={hasBudgets}
                onPreviousMonth={goToPreviousMonth}
                onNextMonth={goToNextMonth}
                onCurrentMonth={goToCurrentMonth}
                onAddBudget={startAdd}
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
                    <Button type="button" onClick={startAdd} variant="primary" size="md">
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
