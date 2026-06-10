import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { sampleFixedExpenses, storyFixedExpenseMonth } from '@/storybook/fixtures/fixed-expenses';
import { FixedExpenseList } from './FixedExpenseList';

const meta = {
  title: 'Features/Fixed Expenses/FixedExpenseList',
  component: FixedExpenseList,
  tags: ['autodocs', 'test'],
  args: {
    month: storyFixedExpenseMonth,
    fixedExpenses: sampleFixedExpenses,
    isLoading: false,
  },
} satisfies Meta<typeof FixedExpenseList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('fixed-expense-cadence-group-weekly')).toBeVisible();
    await expect(canvas.getByTestId('fixed-expense-cadence-group-biweekly')).toBeVisible();
    await expect(canvas.getByTestId('fixed-expense-cadence-group-monthly')).toBeVisible();
    await expect(canvas.getByText('CenturyLink')).toBeVisible();
    await expect(canvas.getByText('Spotify')).toBeVisible();
    await expect(canvas.getAllByText('Bills')).toHaveLength(3);
    await expect(canvas.getAllByText('Subscriptions')).toHaveLength(4);
    await expect(canvas.getByText('Loan Payments')).toBeVisible();
    await expect(canvas.getByTestId('fixed-expense-card-centurylink')).toHaveTextContent(
      'Jun 2, 9, 16, 23, 30'
    );
  },
};

export const Empty: Story = {
  args: {
    fixedExpenses: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('fixed-expenses-empty-state')).toBeVisible();
  },
};
