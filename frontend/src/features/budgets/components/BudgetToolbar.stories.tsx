import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { BudgetToolbar } from './BudgetToolbar';

const meta = {
  title: 'Features/Budgets/BudgetToolbar',
  component: BudgetToolbar,
  tags: ['autodocs', 'test'],
  args: {
    monthLabel: 'May 2026',
    loading: false,
    isAdding: false,
    showAddButton: true,
    onPreviousMonth: fn(),
    onNextMonth: fn(),
    onCurrentMonth: fn(),
    onAddBudget: fn(),
  },
} satisfies Meta<typeof BudgetToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /previous month/i }));
    await userEvent.click(canvas.getByRole('button', { name: /next month/i }));
    await userEvent.click(canvas.getByRole('button', { name: /^now$/i }));
    await userEvent.click(canvas.getByRole('button', { name: /add budget/i }));

    await expect(args.onPreviousMonth).toHaveBeenCalledTimes(1);
    await expect(args.onNextMonth).toHaveBeenCalledTimes(1);
    await expect(args.onCurrentMonth).toHaveBeenCalledTimes(1);
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
