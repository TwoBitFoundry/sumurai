import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BudgetSummaryCard } from '@/features/budgets/components/BudgetSummaryCard';
import { DashboardChartCard } from '@/features/analytics/components/DashboardChartCard';
import { TransactionsToolbar } from '@/features/transactions/components/TransactionsToolbar';
import { Button, GlassCard } from '@/ui/primitives';

const meta: Meta = {
  title: 'Storybook/FullPageSmoke',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const DashboardSlice: Story = {
  render: () => (
    <div className="min-h-screen bg-slate-100 p-6 dark:bg-slate-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <TransactionsToolbar
          search=""
          onSearch={() => {}}
          categories={['Food', 'Transit']}
          selectedCategory={null}
          onSelectCategory={() => {}}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <BudgetSummaryCard totalBudgeted={5000} totalSpent={3200} />
          <DashboardChartCard
            title="Net worth"
            description="Synced snapshot"
            refreshingLabel="Refreshing"
            isRefreshing={false}
          >
            <div className="h-40 rounded-xl bg-gradient-to-br from-sky-500/10 to-violet-500/10" />
          </DashboardChartCard>
        </div>
        <GlassCard variant="accent" rounded="lg" padding="md">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Actions</div>
            <Button variant="connect" size="sm">
              Connect
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  ),
};
