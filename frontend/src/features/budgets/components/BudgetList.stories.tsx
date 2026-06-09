import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { sampleBudgetProgressEntries } from '@/storybook/fixtures/budgets';
import { BudgetList } from './BudgetList';

const meta = {
  title: 'Features/Budgets/BudgetList',
  component: BudgetList,
  tags: ['autodocs', 'test'],
  args: {
    isEditing: false,
    drafts: {},
    onDraftChange: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof BudgetList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: {
    items: sampleBudgetProgressEntries,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByLabelText(/delete budget/i)).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: {
    items: [],
  },
};

export const Editing: Story = {
  args: {
    items: sampleBudgetProgressEntries,
    isEditing: true,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const amount = canvas.getAllByTestId('budget-amount-input')[0];
    await userEvent.clear(amount);
    await userEvent.type(amount, '275');
    await expect(args.onDraftChange).toHaveBeenCalledWith(sampleBudgetProgressEntries[0].id, '275');
    await userEvent.click(canvas.getAllByLabelText(/delete budget/i)[0]);
    await expect(args.onDelete).toHaveBeenCalledWith(sampleBudgetProgressEntries[0].id);
  },
};
