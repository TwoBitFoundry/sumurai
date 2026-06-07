import { Target } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { cn, EmptyState, GlassCard } from '@/ui/primitives';
import { heroAccents } from '@/ui/tokens';
import { BudgetCalculator } from '../domain/BudgetCalculator';
import { computeBudgetInsights } from '../domain/BudgetInsightsCalculator';
import AddBudgetPicker, {
  type BudgetFormValue,
} from '../features/budgets/components/AddBudgetPicker';
import { BudgetInsightsPanel } from '../features/budgets/components/BudgetInsightsPanel';
import { BudgetList, type BudgetWithProgress } from '../features/budgets/components/BudgetList';
import BudgetSummaryCard from '../features/budgets/components/BudgetSummaryCard';
import BudgetToolbar from '../features/budgets/components/BudgetToolbar';
import type { BudgetMonthControl } from '../features/budgets/hooks/useBudgetMonth';
import { useBudgets } from '../features/budgets/hooks/useBudgets';
import { SubscriptionsSection } from '../features/subscriptions/components/SubscriptionsSection';
import { useCategories } from '../features/transactions/hooks/useCategories';
import { PageLayout } from '../layouts/PageLayout';

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
    filteredSubscriptions,
    isAccountFiltered,
    totalBudgetSpend,
    filterKey,
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

  const insights = useMemo(
    () =>
      computeBudgetInsights({
        stats,
        subscriptions: filteredSubscriptions,
        month,
        referenceDate: new Date(),
        isAccountFiltered,
        filteredBudgetSpend: stats.totalSpent,
        totalBudgetSpend,
      }),
    [stats, filteredSubscriptions, month, isAccountFiltered, totalBudgetSpend]
  );

  const budgetsLoading = isLoading || transactionsLoading;
  const hasBudgets = computedBudgets.length > 0;

  const heroStats = (
    <div className="space-y-3">
      <BudgetInsightsPanel
        insights={insights}
        stats={stats}
        month={month}
        filterKey={filterKey}
        isAccountFiltered={isAccountFiltered}
      />
      <BudgetSummaryCard totalBudgeted={stats.totalBudgeted} totalSpent={stats.totalSpent} />
    </div>
  );

  const errorMessage = error || (validationError && !error ? validationError : null);

  return (
    <div data-testid="budgets-page">
      <PageLayout
        title="Provision the coffers"
        subtitle="Review subscriptions and manage monthly budgets categories from all your connected bank accounts."
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
            <CollapsibleSection
              sectionId="budgets"
              title="Budgets"
              titleIcon={Target}
              titleIconClassName={heroAccents.emerald.icon}
              description="Add, edit, or delete budgets by transaction categories."
              testId="budgets-section"
              expandLabel="Show budgets"
              collapseLabel="Hide budgets"
              actions={
                <BudgetToolbar
                  loading={budgetsLoading}
                  isPickerOpen={isAdding}
                  addButtonRef={addButtonRef}
                  onAddBudget={toggleAddPicker}
                />
              }
            >
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
            </CollapsibleSection>
          </GlassCard>
        </div>
      </PageLayout>
    </div>
  );
}
