import { Pencil, Plus, Target } from 'lucide-react';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import AddBudgetPicker from '@/features/budgets/components/AddBudgetPicker';
import { BudgetInsightsPanel } from '@/features/budgets/components/BudgetInsightsPanel';
import { BudgetList } from '@/features/budgets/components/BudgetList';
import { FixedExpensesSection } from '@/features/fixed-expenses/components/FixedExpensesSection';
import { PageLayout } from '@/layouts/PageLayout';
import { sampleBudgetProgressEntries } from '@/storybook/fixtures/budgets';
import { sampleFixedExpenses, storyFixedExpenseMonth } from '@/storybook/fixtures/fixed-expenses';
import { Button, cn, EmptyState, GlassCard } from '@/ui/primitives';
import { control } from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';

export type BudgetsScreenSliceState = 'loaded' | 'empty' | 'error' | 'adding';

export function BudgetsScreenSlice(props: { state: BudgetsScreenSliceState }) {
  const heroStats = (
    <BudgetInsightsPanel
      totalBudgeted={props.state === 'empty' ? 0 : 850}
      totalSpent={props.state === 'empty' ? 0 : 835}
      insights={{
        dailyPacing: props.state === 'empty' ? 0 : 18.55,
        income: props.state === 'empty' ? 0 : 462.47,
        freeSpend: props.state === 'empty' ? 0 : 107.59,
        runoutDate: props.state === 'empty' ? null : new Date(2026, 5, 17),
        hasActivity: props.state !== 'empty',
      }}
      fixedExpenses={props.state === 'empty' ? [] : sampleFixedExpenses}
      month={storyFixedExpenseMonth}
      filterKey={props.state}
    />
  );

  const fixedExpenses = props.state === 'empty' ? [] : sampleFixedExpenses;

  return (
    <div data-testid="budgets-page">
      <PageLayout
        title="Track your expenses"
        subtitle="Review subscriptions and manage monthly budgets categories from all your connected bank accounts."
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
            <CollapsibleSection
              sectionId="budgets"
              title="Budgets"
              titleIcon={Target}
              titleIconClassName={heroAccents.azure.icon}
              testId="budgets-section"
              expandLabel="Show budgets"
              collapseLabel="Hide budgets"
              actionsStart={
                props.state === 'loaded' || props.state === 'adding' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    shape="square"
                    aria-label="Edit budgets"
                    title="Edit budgets"
                    className={cn('shrink-0')}
                    onClick={() => {}}
                  >
                    <Pencil className={cn(control.glyph.md)} />
                  </Button>
                ) : undefined
              }
              actionsEnd={
                props.state === 'loaded' || props.state === 'adding' ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    aria-label="Add budget"
                    title="Add budget"
                    aria-expanded={props.state === 'adding'}
                    aria-haspopup="dialog"
                    className={cn(
                      'shrink-0',
                      'normal-case',
                      'max-md:aspect-square',
                      'max-md:w-11',
                      'max-md:gap-0',
                      'max-md:px-0'
                    )}
                    onClick={() => {}}
                  >
                    <Plus className={cn(control.glyph.md)} />
                    <span className="hidden md:inline">Budget</span>
                  </Button>
                ) : undefined
              }
            >
              {props.state === 'loaded' || props.state === 'adding' ? (
                <BudgetList
                  items={sampleBudgetProgressEntries}
                  isEditing={false}
                  drafts={{}}
                  onDraftChange={() => {}}
                  onDelete={() => {}}
                  period={{ startDate: '2025-01-01', endDate: '2025-01-31' }}
                />
              ) : null}
              {props.state === 'empty' ? (
                <EmptyState
                  icon={Target}
                  title="No budgets yet"
                  description="Set your first budget to see your progress."
                  action={
                    <Button type="button" onClick={() => {}} variant="primary" size="md">
                      <Plus />
                      Add budget
                    </Button>
                  }
                  data-testid="budgets-empty-state"
                />
              ) : null}
            </CollapsibleSection>
            {props.state === 'adding' ? (
              <AddBudgetPicker
                open
                anchorRef={{ current: null }}
                categories={['food_and_drink', 'transportation']}
                accentIndexByName={
                  new Map([
                    ['food_and_drink', 0],
                    ['transportation', 1],
                  ])
                }
                value={{ category: '', amount: '' }}
                onChange={() => {}}
                onSave={() => {}}
                onRequestClose={() => {}}
              />
            ) : null}
          </GlassCard>
          <GlassCard
            variant="accent"
            rounded="lg"
            padding="none"
            withInnerEffects={false}
            containerClassName={cn('p-4', 'md:p-8', 'lg:p-8')}
            className={cn('space-y-6')}
          >
            <FixedExpensesSection
              fixedExpenses={fixedExpenses}
              month={storyFixedExpenseMonth}
              isLoading={false}
            />
          </GlassCard>
        </div>
      </PageLayout>
    </div>
  );
}
