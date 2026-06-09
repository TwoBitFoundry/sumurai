import { Check, Loader2, Pencil, Plus, Target } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { Button, cn, EmptyState, GlassCard } from '@/ui/primitives';
import { heroAccents } from '@/ui/tokens';
import { BudgetCalculator } from '../domain/BudgetCalculator';
import { computeBudgetInsights } from '../domain/BudgetInsightsCalculator';
import AddBudgetPicker, {
  type BudgetFormValue,
} from '../features/budgets/components/AddBudgetPicker';
import { BudgetInsightsPanel } from '../features/budgets/components/BudgetInsightsPanel';
import { BudgetList } from '../features/budgets/components/BudgetList';
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
    filterKey,
    availableCategoryOptions,
    month,
    range,
    transactions,
  } = useBudgets(monthControl);
  const { accentIndexByName } = useCategories();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [form, setForm] = useState<BudgetFormValue>({ category: '', amount: '' });

  const toggleAddPicker = () => {
    if (isAdding) {
      cancel();
      return;
    }
    setIsEditing(false);
    setDrafts({});
    setForm({ category: '', amount: '' });
    setIsAdding(true);
  };
  const cancel = () => {
    setIsAdding(false);
    setIsEditing(false);
    setDrafts({});
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
  const onStartEdit = () => {
    setIsAdding(false);
    setForm({ category: '', amount: '' });
    setDrafts(Object.fromEntries(computedBudgets.map((b) => [b.id, String(b.amount)])));
    setIsEditing(true);
  };
  const onDraftChange = (id: string, value: string) => {
    setDrafts((d) => ({ ...d, [id]: value }));
  };
  const onSaveEdit = async () => {
    const updates = computedBudgets.flatMap((b) => {
      const draft = drafts[b.id];
      if (draft === undefined) return [];
      const amount = Number(draft);
      if (!Number.isFinite(amount) || amount <= 0 || amount === b.amount) return [];
      return [update(b.id, amount)];
    });
    try {
      await Promise.all(updates);
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
        month,
        referenceDate: new Date(),
        transactions,
        range,
        computedBudgets,
      }),
    [stats, month, transactions, range, computedBudgets]
  );

  const budgetsLoading = isLoading || transactionsLoading;
  const hasBudgets = computedBudgets.length > 0;

  const heroStats = (
    <BudgetInsightsPanel
      totalBudgeted={stats.totalBudgeted}
      totalSpent={stats.totalSpent}
      insights={insights}
      subscriptions={filteredSubscriptions}
      month={month}
      filterKey={filterKey}
    />
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
              titleIconClassName={heroAccents.sky.icon}
              testId="budgets-section"
              expandLabel="Show budgets"
              collapseLabel="Hide budgets"
              actionsStart={
                <div className={cn('flex', 'items-center', 'gap-2')}>
                  {budgetsLoading && (
                    <Loader2 className={cn('h-3.5', 'w-3.5', 'animate-spin')} aria-hidden="true" />
                  )}
                  {isEditing ? (
                    <Button
                      type="button"
                      onClick={onSaveEdit}
                      variant="success"
                      size="md"
                      aria-label="Save budgets"
                      title="Save budgets"
                      className={cn('w-auto', 'shrink-0', 'whitespace-nowrap')}
                    >
                      <Check />
                    </Button>
                  ) : hasBudgets ? (
                    <Button
                      type="button"
                      onClick={onStartEdit}
                      variant="secondary"
                      size="md"
                      aria-label="Edit budgets"
                      title="Edit budgets"
                      className={cn('w-auto', 'shrink-0', 'whitespace-nowrap')}
                    >
                      <Pencil />
                    </Button>
                  ) : null}
                </div>
              }
              actionsEnd={
                !isEditing ? (
                  <Button
                    ref={addButtonRef}
                    type="button"
                    onClick={toggleAddPicker}
                    variant="primary"
                    size="md"
                    aria-label="Budget"
                    aria-expanded={isAdding}
                    aria-haspopup="dialog"
                    className={cn('w-auto', 'shrink-0', 'whitespace-nowrap')}
                  >
                    <Plus />
                  </Button>
                ) : null
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
                  isEditing={isEditing}
                  drafts={drafts}
                  onDraftChange={onDraftChange}
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
