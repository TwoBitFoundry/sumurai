import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { cn } from '@/ui/primitives/utils';
import { radius as uiRadiusRecipes, text as uiTextRecipes } from '@/ui/recipes';
import { DashboardChartCard } from './DashboardChartCard';

const meta = {
  title: 'Features/Analytics/DashboardChartCard',
  component: DashboardChartCard,
  tags: ['autodocs', 'test'],
  args: {
    title: 'Cash flow',
    description: 'Last 30 days',
    refreshingLabel: 'Refreshing chart',
    isRefreshing: false,
    children: (
      <div
        className={cn(
          `flex h-48 items-center justify-center ${uiRadiusRecipes.standard} border border-dashed border-slate-300 text-sm dark:border-slate-600`,
          uiTextRecipes.muted
        )}
      >
        Chart placeholder
      </div>
    ),
  },
} satisfies Meta<typeof DashboardChartCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: { isRefreshing: true },
};

export const EmptyBody: Story = {
  args: {
    children: (
      <div className={cn('flex h-40 items-center justify-center text-sm', uiTextRecipes.muted)}>
        No transactions in range
      </div>
    ),
  },
};
