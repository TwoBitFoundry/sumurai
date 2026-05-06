import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BudgetSummaryCard } from './BudgetSummaryCard';

const meta = {
  title: 'Features/Budgets/BudgetSummaryCard',
  component: BudgetSummaryCard,
  tags: ['autodocs'],
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
};

export const DenseValues: Story = {
  args: {
    totalBudgeted: 128400.55,
    totalSpent: 127833.12,
  },
};
