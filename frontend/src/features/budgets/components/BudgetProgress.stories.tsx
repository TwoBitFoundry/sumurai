import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { BudgetProgress } from './BudgetProgress';

const meta = {
  title: 'Features/Budgets/BudgetProgress',
  component: BudgetProgress,
  tags: ['autodocs', 'test'],
} satisfies Meta<typeof BudgetProgress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithinBudget: Story = {
  args: {
    amount: 500,
    spent: 220,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/44% used/i)).toBeVisible();
    await expect(canvas.getByText(/\$280\.00 left/i)).toBeVisible();
  },
};

export const OverBudget: Story = {
  args: {
    amount: 400,
    spent: 520,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/100% used/i)).toBeVisible();
    await expect(canvas.getByText(/-\$120\.00 over/i)).toBeVisible();
  },
};

export const ZeroPlanned: Story = {
  args: {
    amount: 0,
    spent: 120,
  },
};
