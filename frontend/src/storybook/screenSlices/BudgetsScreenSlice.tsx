import { AlertTriangle, Clock, Pencil, Plus, Repeat2, Target } from 'lucide-react';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import HeroStatCard, { SubscriptionCostsMetric } from '@/components/widgets/HeroStatCard';
import AddBudgetPicker from '@/features/budgets/components/AddBudgetPicker';
import { BudgetInsightsPanel } from '@/features/budgets/components/BudgetInsightsPanel';
import { BudgetList } from '@/features/budgets/components/BudgetList';
import { FixedExpensesSection } from '@/features/fixed-expenses/components/FixedExpensesSection';
import { PageLayout } from '@/layouts/PageLayout';
import { sampleBudgetProgressEntries } from '@/storybook/fixtures/budgets';
import { sampleFixedExpenses } from '@/storybook/fixtures/fixed-expenses';
import { Button, cn, EmptyState, GlassCard } from '@/ui/primitives';
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
      month={new Date(2026, 5, 1)}
      filterKey={props.state}
    />
  );

  const fixedExpenses = props.state === 'empty' ? [] : sampleFixedExpenses;

  const errorMessage =
    props.state === 'error' ? 'Unable to reach the budgets service. Try again shortly.' : null;

  return (
    <div data-testid="budgets-page">
      <PageLayout
        title="Budgets under command"
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
            <FixedExpensesSection fixedExpenses={fixedExpenses} isLoading={false} />
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
                    <Pencil />
                  </Button>
                ) : undefined
              }
              actionsEnd={
                props.state === 'loaded' || props.state === 'adding' ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    shape="square"
                    aria-label="Budget"
                    aria-expanded={props.state === 'adding'}
                    aria-haspopup="dialog"
                    className={cn('shrink-0')}
                    onClick={() => {}}
                  >
                    <Plus />
                  </Button>
                ) : undefined
              }
            >
              {props.state === 'loaded' || props.state === 'adding' ? (
                <>
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
                  <BudgetList
                    items={sampleBudgetProgressEntries}
                    isEditing={false}
                    drafts={{}}
                    onDraftChange={() => {}}
                    onDelete={() => {}}
                  />
                </>
              ) : null}
              {props.state === 'empty' ? (
                <EmptyState
                  icon={Target}
                  title="No budgets yet"
                  description="Set your first category limit. Lead the month with discipline."
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
          </GlassCard>
        </div>
      </PageLayout>
    </div>
  );
}
