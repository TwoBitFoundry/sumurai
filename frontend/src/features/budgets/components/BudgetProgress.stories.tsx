import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BudgetProgress } from './BudgetProgress';

const meta = {
  title: 'Features/Budgets/BudgetProgress',
  component: BudgetProgress,
  tags: ['autodocs'],
} satisfies Meta<typeof BudgetProgress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithinBudget: Story = {
  args: {
    amount: 500,
    spent: 220,
  },
};

export const OverBudget: Story = {
  args: {
    amount: 400,
    spent: 520,
  },
};

export const ZeroPlanned: Story = {
  args: {
    amount: 0,
    spent: 120,
  },
};
