import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { BudgetSummaryCard } from './BudgetSummaryCard';

const meta = {
  title: 'Features/Budgets/BudgetSummaryCard',
  component: BudgetSummaryCard,
  tags: ['autodocs', 'test'],
  args: {
    totalBudgeted: 4200,
    totalSpent: 2150,
  },
} satisfies Meta<typeof BudgetSummaryCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OverBudget: Story = {
  args: {
    totalBudgeted: 1000,
    totalSpent: 1250,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/\$1,000\.00/)).toBeVisible();
    await expect(canvas.getByText(/\$1,250\.00/)).toBeVisible();
    await expect(canvas.getByText(/-\$250\.00 over/i)).toBeVisible();
  },
};

export const DenseValues: Story = {
  args: {
    totalBudgeted: 128400.55,
    totalSpent: 127833.12,
  },
};
