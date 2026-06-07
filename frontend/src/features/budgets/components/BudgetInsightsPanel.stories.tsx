import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { BudgetStats } from '@/domain/BudgetCalculator';
import type { BudgetInsights } from '@/domain/BudgetInsightsCalculator';
import { BudgetInsightsPanel } from './BudgetInsightsPanel';

const sampleInsights: BudgetInsights = {
  dailyPacing: 15,
  safeToSpend: 250,
  upcomingSubscriptionsTotal: 50,
  runoutDate: new Date(2026, 5, 25),
  accountWeightPct: null,
  budgetSlack: 250,
  hasActivity: true,
};

const sampleStats: BudgetStats = {
  totalBudgeted: 500,
  totalSpent: 200,
  remaining: 300,
  variance: 300,
  overBudgetCount: 0,
  overBudgetCategories: [],
  daysRemaining: 20,
  totalDays: 30,
  activeBudgetCategories: ['FOOD'],
  nearLimitCategories: [],
};

const meta = {
  title: 'Features/Budgets/BudgetInsightsPanel',
  component: BudgetInsightsPanel,
  tags: ['autodocs', 'test'],
  args: {
    insights: sampleInsights,
    stats: sampleStats,
    month: new Date(2026, 5, 1),
    filterKey: 'all',
    isAccountFiltered: false,
  },
} satisfies Meta<typeof BudgetInsightsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllCards: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Daily Pacing')).toBeVisible();
    await expect(canvas.getByText('Safe-To-Spend')).toBeVisible();
    await expect(canvas.getByText('Exhaustion Projection')).toBeVisible();
    await expect(canvas.getByText('Budget Slack')).toBeVisible();
  },
};

export const FlipAndReset: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole('button', { name: /daily pacing/i });
    await userEvent.click(btn);
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText(/how much can i spend every day/i)).toBeVisible();
  },
};

export const ZeroActivity: Story = {
  args: {
    insights: { ...sampleInsights, hasActivity: false },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('budget-insights-empty')).toBeVisible();
    await expect(canvas.queryByText('Daily Pacing')).not.toBeInTheDocument();
  },
};

export const AccountFiltered: Story = {
  args: {
    insights: { ...sampleInsights, accountWeightPct: 40 },
    isAccountFiltered: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Account Burden')).toBeVisible();
    await expect(canvas.queryByText('Budget Slack')).not.toBeInTheDocument();
  },
};
