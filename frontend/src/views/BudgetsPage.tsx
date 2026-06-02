import { Activity, AlertTriangle, CheckCircle2, Clock, Target } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { cn, EmptyState, GlassCard } from '@/ui/primitives';
import HeroStatCard, { type HeroPill } from '../components/widgets/HeroStatCard';
import { BudgetCalculator } from '../domain/BudgetCalculator';
import AddBudgetPicker, {
  type BudgetFormValue,
} from '../features/budgets/components/AddBudgetPicker';
import { BudgetList, type BudgetWithProgress } from '../features/budgets/components/BudgetList';
import BudgetSummaryCard from '../features/budgets/components/BudgetSummaryCard';
import BudgetToolbar from '../features/budgets/components/BudgetToolbar';
import type { BudgetMonthControl } from '../features/budgets/hooks/useBudgetMonth';
import { useBudgets } from '../features/budgets/hooks/useBudgets';
import { useCategories } from '../features/transactions/hooks/useCategories';
import { PageLayout } from '../layouts/PageLayout';
import { formatCategoryName } from '../utils/categories';

export default function BudgetsPage({ monthControl }: { monthControl: BudgetMonthControl }) {
  const {
    isLoading,
    transactionsLoading,
    error,
    validationError,
    add,
    update,
    remove,
    computedBudgets,
    categoryOptions,
    availableCategoryOptions,
    month,
  } = useBudgets(monthControl);
  const { accentIndexByName } = useCategories();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetFormValue>({ category: '', amount: '' });

  const toggleAddPicker = () => {
    if (isAdding) {
      cancel();
      return;
    }
    setEditingId(null);
    setForm({ category: '', amount: '' });
    setIsAdding(true);
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
          label: 'All budgets hold the line',
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
  const zoneTone =
    zone === 'Healthy'
      ? 'success'
      : zone === 'On Track'
        ? 'info'
        : zone === 'Overextended'
          ? 'warning'
          : 'danger';
  const budgetsLoading = isLoading || transactionsLoading;
  const hasBudgets = computedBudgets.length > 0;

  const heroStats = (
    <div className="space-y-3">
      <div className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-4')}>
        <HeroStatCard
          index={1}
          title="Active budgets"
          icon={<CheckCircle2 />}
          value={`${computedBudgets.length}`}
          suffix={`out of ${categoryOptions.length}`}
          pills={activeBudgetPills}
        />
        <HeroStatCard
          index={2}
          title="Monitor"
          icon={<Activity />}
          value={utilizationValue}
          suffix={utilizationSuffix}
          pills={[
            {
              label: zone,
              type: 'semantic',
              tone: zoneTone,
            },
          ]}
        />
        <HeroStatCard
          index={3}
          title="Days remaining"
          icon={<Clock />}
          value={stats.daysRemaining}
          suffix={`of ${stats.totalDays}`}
          subtext={`${stats.totalDays} total days`}
        />
        <HeroStatCard
          index={4}
          title="Overages"
          icon={<AlertTriangle />}
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
        badge="Budgets"
        title="Command your spending"
        subtitle="Name your allowances. Honor your commitments. The month moves whether you plan or not."
        error={errorMessage}
        stats={heroStats}
      >
        <div className={cn('w-full', 'min-w-0', 'max-w-full')}>
          <GlassCard
            variant="accent"
            rounded="lg"
            padding="none"
            withInnerEffects={false}
            containerClassName={cn('p-4', 'md:p-8', 'lg:p-8')}
            className={cn('space-y-6')}
          >
            <BudgetToolbar
              loading={budgetsLoading}
              isPickerOpen={isAdding}
              addButtonRef={addButtonRef}
              onAddBudget={toggleAddPicker}
            />
            <AddBudgetPicker
              open={isAdding}
              anchorRef={addButtonRef}
              categories={availableCategoryOptions}
              accentIndexByName={accentIndexByName}
              value={form}
              onChange={setForm}
              onSave={onSaveAdd}
              onRequestClose={cancel}
            />
            {hasBudgets ? (
              <>
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
                  title="No budgets yet"
                  description="Establish your first allowance to see your progress."
                  data-testid="budgets-empty-state"
                />
              </>
            )}
          </GlassCard>
        </div>
      </PageLayout>
    </div>
  );
}
