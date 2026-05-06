import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TransactionsToolbar } from './TransactionsToolbar';

const meta = {
  title: 'Features/Transactions/TransactionsToolbar',
  component: TransactionsToolbar,
  tags: ['autodocs'],
  args: {
    search: '',
    onSearch: () => {},
    categories: ['Food', 'Transit', 'Income'],
    selectedCategory: null,
    onSelectCategory: () => {},
  },
} satisfies Meta<typeof TransactionsToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filtered: Story = {
  args: {
    selectedCategory: 'Food',
    search: 'coffee',
  },
};
