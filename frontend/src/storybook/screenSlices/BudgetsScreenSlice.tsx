import { Activity, AlertTriangle, CheckCircle2, Clock, Plus, Target } from 'lucide-react';
import HeroStatCard from '@/components/widgets/HeroStatCard';
import { BudgetForm } from '@/features/budgets/components/BudgetForm';
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
      <div className={cn('grid', 'gap-3', 'md:grid-cols-2', 'lg:grid-cols-4')}>
        <HeroStatCard
          index={1}
          title="Active budgets"
          icon={<CheckCircle2 className={cn('h-4', 'w-4')} />}
          value="3"
          suffix="out of 12"
          pills={[{ label: 'Food', type: 'category', categoryName: 'food_and_drink' }]}
        />
        <HeroStatCard
          index={2}
          title="Monitor"
          icon={<Activity className={cn('h-4', 'w-4')} />}
          value="98%"
          suffix="of budget"
          pills={[{ label: 'On Track', type: 'semantic', tone: 'info' }]}
        />
        <HeroStatCard
          index={3}
          title="Days remaining"
          icon={<Clock className={cn('h-4', 'w-4')} />}
          value="16"
          suffix="out of"
          subtext="31 total days"
        />
        <HeroStatCard
          index={4}
          title="Overages"
          icon={<AlertTriangle className={cn('h-4', 'w-4')} />}
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
      <div className={cn('grid', 'gap-3', 'md:grid-cols-2', 'lg:grid-cols-4')}>
        <HeroStatCard
          index={1}
          title="Active budgets"
          icon={<CheckCircle2 className={cn('h-4', 'w-4')} />}
          value="0"
          suffix="out of 12"
        />
        <HeroStatCard
          index={2}
          title="Monitor"
          icon={<Activity className={cn('h-4', 'w-4')} />}
          value="0%"
          suffix="of budget"
          pills={[{ label: 'Healthy', type: 'semantic', tone: 'success' }]}
        />
        <HeroStatCard
          index={3}
          title="Days remaining"
          icon={<Clock className={cn('h-4', 'w-4')} />}
          value="16"
          suffix="out of"
          subtext="31 total days"
        />
        <HeroStatCard
          index={4}
          title="Overages"
          icon={<AlertTriangle className={cn('h-4', 'w-4')} />}
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
        badge="Monthly Budgets"
        title="Budgets at a glance"
        subtitle="Shape your spending plan, watch commitments, and stay ahead before the month runs away."
        error={errorMessage}
        stats={heroStats}
      >
        <GlassCard className="p-0">
          {props.state === 'loaded' || props.state === 'adding' ? (
            <>
              <BudgetToolbar
                monthLabel="May 2026"
                loading={false}
                isAdding={props.state === 'adding'}
                showAddButton
                onPreviousMonth={() => {}}
                onNextMonth={() => {}}
                onCurrentMonth={() => {}}
                onAddBudget={() => {}}
              />
              {props.state === 'adding' ? (
                <div className={cn('px-6', 'pb-6', 'flex', 'justify-center')}>
                  <div className="w-full max-w-md">
                    <BudgetForm
                      categories={['food_and_drink', 'transportation', 'entertainment']}
                      usedCategories={new Set(['entertainment'])}
                      value={{ category: '', amount: '' }}
                      onChange={() => {}}
                      onSave={() => {}}
                      onCancel={() => {}}
                    />
                  </div>
                </div>
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
              title="No budgets found"
              description="Create your first category plan to watch spending settle into rhythm."
              action={
                <Button type="button" onClick={() => {}} variant="primary" size="md">
                  <Plus className={cn('h-4', 'w-4')} />
                  Add budget
                </Button>
              }
              data-testid="budgets-empty-state"
            />
          ) : null}
        </GlassCard>
      </PageLayout>
    </div>
  );
}
