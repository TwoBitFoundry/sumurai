import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BudgetToolbar } from './BudgetToolbar';

const meta = {
  title: 'Features/Budgets/BudgetToolbar',
  component: BudgetToolbar,
  tags: ['autodocs'],
  args: {
    monthLabel: 'May 2026',
    loading: false,
    isAdding: false,
    showAddButton: true,
    onPreviousMonth: () => {},
    onNextMonth: () => {},
    onCurrentMonth: () => {},
    onAddBudget: () => {},
  },
} satisfies Meta<typeof BudgetToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

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
