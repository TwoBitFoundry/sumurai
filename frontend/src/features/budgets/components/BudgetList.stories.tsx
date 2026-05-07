import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { sampleBudgetProgressEntries } from '@/storybook/fixtures/budgets';
import { BudgetList } from './BudgetList';

const meta = {
  title: 'Features/Budgets/BudgetList',
  component: BudgetList,
  tags: ['autodocs', 'test'],
  args: {
    editingId: null,
    onStartEdit: fn(),
    onCancelEdit: fn(),
    onSaveEdit: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof BudgetList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: {
    items: sampleBudgetProgressEntries,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getAllByLabelText(/edit budget/i)[0]);
    await expect(args.onStartEdit).toHaveBeenCalledWith(sampleBudgetProgressEntries[0]);
    await userEvent.click(canvas.getAllByLabelText(/delete budget/i)[0]);
    await expect(args.onDelete).toHaveBeenCalledWith(sampleBudgetProgressEntries[0].id);
  },
};

export const Empty: Story = {
  args: {
    items: [],
  },
};

export const EditingRow: Story = {
  args: {
    items: sampleBudgetProgressEntries,
    editingId: sampleBudgetProgressEntries[0].id,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const amount = canvas.getByTestId('budget-amount-input');
    await userEvent.clear(amount);
    await userEvent.type(amount, '275');
    await userEvent.click(canvas.getByLabelText(/save budget/i));
    await expect(args.onSaveEdit).toHaveBeenCalledWith(sampleBudgetProgressEntries[0].id, 275);
    await userEvent.click(canvas.getByLabelText(/cancel edit/i));
    await expect(args.onCancelEdit).toHaveBeenCalledTimes(1);
  },
};
