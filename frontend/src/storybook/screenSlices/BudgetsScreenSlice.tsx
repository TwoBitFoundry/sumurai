import { Activity, AlertTriangle, CheckCircle2, Clock, Plus, Target } from 'lucide-react';
import HeroStatCard from '@/components/widgets/HeroStatCard';
import AddBudgetPicker from '@/features/budgets/components/AddBudgetPicker';
import { BudgetList } from '@/features/budgets/components/BudgetList';
import BudgetSummaryCard from '@/features/budgets/components/BudgetSummaryCard';
import BudgetToolbar from '@/features/budgets/components/BudgetToolbar';
import { PageLayout } from '@/layouts/PageLayout';
import { sampleBudgetProgressEntries } from '@/storybook/fixtures/budgets';
import { Button, cn, EmptyState, GlassCard } from '@/ui/primitives';

export type BudgetsScreenSliceState = 'loaded' | 'empty' | 'error' | 'adding';

export function BudgetsScreenSlice(props: { state: BudgetsScreenSliceState }) {
  const heroStatsLoaded = (
    <div className="space-y-3">
      <div className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-4')}>
        <HeroStatCard
          index={1}
          title="Active budgets"
          icon={<CheckCircle2 />}
          value="3"
          suffix="out of 12"
          pills={[{ label: 'Food', type: 'category', categoryName: 'food_and_drink' }]}
        />
        <HeroStatCard
          index={2}
          title="Monitor"
          icon={<Activity />}
          value="98%"
          suffix="of budget"
          pills={[{ label: 'On Track', type: 'semantic', tone: 'info' }]}
        />
        <HeroStatCard
          index={3}
          title="Days remaining"
          icon={<Clock />}
          value="16"
          suffix="out of"
          subtext="31 total days"
        />
        <HeroStatCard
          index={4}
          title="Overages"
          icon={<AlertTriangle />}
          value="1"
          suffix="over budget"
          pills={[{ label: 'Entertainment', type: 'category', categoryName: 'entertainment' }]}
        />
      </div>
      <BudgetSummaryCard totalBudgeted={850} totalSpent={835} />
    </div>
  );

  const heroStatsEmpty = (
    <div className="space-y-3">
      <div className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-4')}>
        <HeroStatCard
          index={1}
          title="Active budgets"
          icon={<CheckCircle2 />}
          value="0"
          suffix="out of 12"
        />
        <HeroStatCard
          index={2}
          title="Monitor"
          icon={<Activity />}
          value="0%"
          suffix="of budget"
          pills={[{ label: 'Healthy', type: 'semantic', tone: 'success' }]}
        />
        <HeroStatCard
          index={3}
          title="Days remaining"
          icon={<Clock />}
          value="16"
          suffix="out of"
          subtext="31 total days"
        />
        <HeroStatCard
          index={4}
          title="Overages"
          icon={<AlertTriangle />}
          value="0"
          suffix="over budget"
        />
      </div>
      <BudgetSummaryCard totalBudgeted={0} totalSpent={0} />
    </div>
  );

  const heroStats = props.state === 'empty' ? heroStatsEmpty : heroStatsLoaded;

  const errorMessage =
    props.state === 'error' ? 'Unable to reach the budgets service. Try again shortly.' : null;

  return (
    <div data-testid="budgets-page">
      <PageLayout
        badge="Budgets"
        title="Budgets under command"
        subtitle="Cut through the budgeting fog of war."
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
            {props.state === 'loaded' || props.state === 'adding' ? (
              <>
                <BudgetToolbar
                  loading={false}
                  isPickerOpen={props.state === 'adding'}
                  addButtonRef={{ current: null }}
                  onAddBudget={() => {}}
                />
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
                  editingId={null}
                  onStartEdit={() => {}}
                  onCancelEdit={() => {}}
                  onSaveEdit={() => {}}
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
          </GlassCard>
        </div>
      </PageLayout>
    </div>
  );
}
