import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type ComponentProps, createRef } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { BudgetToolbar } from './BudgetToolbar';

const addButtonRef = createRef<HTMLButtonElement>();

type BudgetToolbarStoryArgs = Omit<ComponentProps<typeof BudgetToolbar>, 'addButtonRef'>;

const meta = {
  title: 'Features/Budgets/BudgetToolbar',
  component: BudgetToolbar,
  tags: ['autodocs', 'test'],
  args: {
    loading: false,
    isPickerOpen: false,
    onAddBudget: fn(),
    isEditing: false,
    canEdit: true,
    onStartEdit: fn(),
    onSaveEdit: fn(),
  },
  render: (args) => <BudgetToolbar {...args} addButtonRef={addButtonRef} />,
} satisfies Meta<BudgetToolbarStoryArgs>;

export default meta;

type Story = StoryObj<BudgetToolbarStoryArgs>;

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
    onAddBudget: fn(),
  },
};

export const PickerOpen: Story = {
  args: {
    isPickerOpen: true,
    onAddBudget: fn(),
  },
};
