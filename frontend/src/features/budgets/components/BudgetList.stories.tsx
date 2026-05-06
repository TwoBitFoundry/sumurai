import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { sampleBudgetProgressEntries } from '@/storybook/fixtures/budgets';
import { BudgetList } from './BudgetList';

const meta = {
  title: 'Features/Budgets/BudgetList',
  component: BudgetList,
  tags: ['autodocs'],
  args: {
    editingId: null,
    onStartEdit: () => {},
    onCancelEdit: () => {},
    onSaveEdit: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof BudgetList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: {
    items: sampleBudgetProgressEntries,
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
};
