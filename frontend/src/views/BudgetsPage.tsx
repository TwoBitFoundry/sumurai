import { AlertTriangle, CalendarClock, Clock, Repeat2, Target } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { cn, EmptyState, GlassCard } from '@/ui/primitives';
import HeroStatCard, { type HeroPill } from '../components/widgets/HeroStatCard';
import { BudgetCalculator } from '../domain/BudgetCalculator';
import { SubscriptionCalculator } from '../domain/SubscriptionCalculator';
import AddBudgetPicker, {
  type BudgetFormValue,
} from '../features/budgets/components/AddBudgetPicker';
import { BudgetList, type BudgetWithProgress } from '../features/budgets/components/BudgetList';
import BudgetSummaryCard from '../features/budgets/components/BudgetSummaryCard';
import BudgetToolbar from '../features/budgets/components/BudgetToolbar';
import type { BudgetMonthControl } from '../features/budgets/hooks/useBudgetMonth';
import { useBudgets } from '../features/budgets/hooks/useBudgets';
import { SubscriptionsSection } from '../features/subscriptions/components/SubscriptionsSection';
import { useCategories } from '../features/transactions/hooks/useCategories';
import { PageLayout } from '../layouts/PageLayout';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '../ui/recipes';
import { formatCategoryName } from '../utils/categories';
import { fmtUSD } from '../utils/format';

interface BudgetsPageProps {
  monthControl: BudgetMonthControl;
}

export default function BudgetsPage({ monthControl }: BudgetsPageProps) {
  const {
    isLoading,
    transactionsLoading,
    error,
    validationError,
    add,
    update,
    remove,
    computedBudgets,
    subscriptions,
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

  const subscriptionHeroStats = useMemo(
    () => SubscriptionCalculator.computeSubscriptionHeroStats(subscriptions),
    [subscriptions]
  );

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

  const budgetsLoading = isLoading || transactionsLoading;
  const hasBudgets = computedBudgets.length > 0;
  const monthlyRecurringValue = isLoading ? '—' : fmtUSD(subscriptionHeroStats.monthlyTotal);
  const annualizedValue = isLoading ? '—' : fmtUSD(subscriptionHeroStats.annualized);

  const heroStats = (
    <div className="space-y-3">
      <div className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-4')}>
        <HeroStatCard
          index={1}
          title="Days remaining"
          icon={<Clock />}
          value={stats.daysRemaining}
          suffix={`of ${stats.totalDays}`}
          subtext={`${stats.totalDays} total days`}
        />
        <HeroStatCard
          index={2}
          title="Recurring subscriptions"
          icon={<Repeat2 />}
          value={monthlyRecurringValue}
          suffix="per month"
        />
        <HeroStatCard
          index={3}
          title="Annualized subscriptions"
          icon={<CalendarClock />}
          value={annualizedValue}
          suffix="per year"
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
        title="Provision the coffers"
        subtitle="Set your spending limits and track your subscriptions."
        error={errorMessage}
        stats={heroStats}
      >
        <div className={cn('w-full', 'min-w-0', 'max-w-full', 'space-y-6')}>
          <GlassCard
            variant="accent"
            rounded="lg"
            padding="none"
            withInnerEffects={false}
            containerClassName={cn('p-4', 'md:p-8', 'lg:p-8')}
            className={cn('space-y-6')}
          >
            <SubscriptionsSection subscriptions={subscriptions} isLoading={isLoading} />
          </GlassCard>
          <GlassCard
            variant="accent"
            rounded="lg"
            padding="none"
            withInnerEffects={false}
            containerClassName={cn('p-4', 'md:p-8', 'lg:p-8')}
            className={cn('space-y-6')}
          >
            <section className={cn('space-y-4')} data-testid="budgets-section">
              <div
                className={cn(
                  'flex',
                  'flex-col',
                  'gap-4',
                  'sm:flex-row',
                  'sm:items-start',
                  'sm:justify-between'
                )}
              >
                <div className={cn('space-y-1')}>
                  <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
                    Budgets
                  </h2>
                  <p className={cn(uiTypographyRecipes.body, uiTextRecipes.muted)}>
                    Establish allowances to take command of spending.
                  </p>
                </div>
                <BudgetToolbar
                  loading={budgetsLoading}
                  isPickerOpen={isAdding}
                  addButtonRef={addButtonRef}
                  onAddBudget={toggleAddPicker}
                />
              </div>
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
                <BudgetList
                  items={computedBudgets}
                  editingId={editingId}
                  onStartEdit={onStartEdit}
                  onCancelEdit={cancel}
                  onSaveEdit={onSaveEdit}
                  onDelete={onDelete}
                />
              ) : (
                <EmptyState
                  icon={Target}
                  title="No budgets yet"
                  description="Set your first budget to see your progress."
                  data-testid="budgets-empty-state"
                />
              )}
            </section>
          </GlassCard>
        </div>
      </PageLayout>
    </div>
  );
}
