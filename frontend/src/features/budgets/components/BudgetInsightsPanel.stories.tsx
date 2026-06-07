import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { BudgetInsights } from '@/domain/BudgetInsightsCalculator';
import { BudgetInsightsPanel } from './BudgetInsightsPanel';

const sampleInsights: BudgetInsights = {
  dailyPacing: 15,
  income: 5000,
  freeSpend: 250,
  runoutDate: new Date(2026, 5, 25),
  hasActivity: true,
};

const meta = {
  title: 'Features/Budgets/BudgetInsightsPanel',
  component: BudgetInsightsPanel,
  tags: ['autodocs', 'test'],
  args: {
    insights: sampleInsights,
    subscriptions: [],
    month: new Date(2026, 5, 1),
    filterKey: 'all',
  },
} satisfies Meta<typeof BudgetInsightsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllCards: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Runway Pace')).toBeVisible();
    await expect(canvas.getByText('Free Spend')).toBeVisible();
    await expect(canvas.getByText('Sub Costs')).toBeVisible();
  },
};

export const FlipAndReset: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole('button', { name: /runway pace/i });
    await userEvent.click(btn);
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText(/how much am i spending per day/i)).toBeVisible();
  },
};

export const NegativeFreeSpend: Story = {
  args: {
    insights: { ...sampleInsights, income: 1000, freeSpend: -150 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('-$150.00')).toBeVisible();
    await expect(canvas.getByText('$1,000.00')).toBeVisible();
  },
};

export const ZeroActivity: Story = {
  args: {
    insights: { ...sampleInsights, hasActivity: false },
    subscriptions: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('budget-insights-empty')).toBeVisible();
    await expect(canvas.queryByText('Runway Pace')).not.toBeInTheDocument();
  },
};
