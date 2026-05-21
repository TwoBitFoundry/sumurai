import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { BudgetToolbar } from './BudgetToolbar';

const meta = {
  title: 'Features/Budgets/BudgetToolbar',
  component: BudgetToolbar,
  tags: ['autodocs', 'test'],
  args: {
    loading: false,
    isAdding: false,
    showAddButton: true,
    onAddBudget: fn(),
  },
} satisfies Meta<typeof BudgetToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /add budget/i }));
    await expect(args.onAddBudget).toHaveBeenCalledTimes(1);
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const AddingMode: Story = {
  args: {
    isAdding: true,
    showAddButton: true,
  },
};

export const AddHidden: Story = {
  args: {
    showAddButton: false,
  },
};
