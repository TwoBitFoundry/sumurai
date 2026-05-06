import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DashboardChartCard } from './DashboardChartCard';

const meta = {
  title: 'Features/Analytics/DashboardChartCard',
  component: DashboardChartCard,
  tags: ['autodocs'],
  args: {
    title: 'Cash flow',
    description: 'Last 30 days',
    refreshingLabel: 'Refreshing chart',
    isRefreshing: false,
    children: (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
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
      <div className="flex h-40 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        No transactions in range
      </div>
    ),
  },
};
