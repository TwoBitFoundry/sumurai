import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { createRef } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { BudgetToolbar } from './BudgetToolbar';

const addButtonRef = createRef<HTMLButtonElement>();

const meta = {
  title: 'Features/Budgets/BudgetToolbar',
  component: BudgetToolbar,
  tags: ['autodocs', 'test'],
  args: {
    loading: false,
    isPickerOpen: false,
    addButtonRef,
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
    isPickerOpen: false,
    addButtonRef,
    onAddBudget: fn(),
  },
};

export const PickerOpen: Story = {
  args: {
    isPickerOpen: true,
    addButtonRef,
    onAddBudget: fn(),
  },
};
