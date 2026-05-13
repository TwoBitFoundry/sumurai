import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { denseLabelTransaction, transactionsTablePage } from '@/storybook/fixtures/transactions';
import { TransactionsTable } from './TransactionsTable';

const meta = {
  title: 'Features/Transactions/TransactionsTable',
  component: TransactionsTable,
  tags: ['autodocs', 'test'],
  args: {
    pageSize: 8,
    onPrev: () => {},
    onNext: () => {},
  },
} satisfies Meta<typeof TransactionsTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    items: [],
    total: 0,
    currentPage: 1,
    totalPages: 1,
    pageSize: 8,
  },
};

export const Populated: Story = {
  args: {
    items: transactionsTablePage,
    total: transactionsTablePage.length,
    currentPage: 1,
    totalPages: 1,
    pageSize: 8,
  },
};

export const PaginationFirstPage: Story = {
  args: {
    items: transactionsTablePage,
    total: 80,
    currentPage: 1,
    totalPages: 10,
    pageSize: 8,
  },
};

export const PaginationLastPage: Story = {
  args: {
    items: transactionsTablePage,
    total: 80,
    currentPage: 10,
    totalPages: 10,
    pageSize: 8,
  },
};

export const DenseMerchantRow: Story = {
  args: {
    items: [denseLabelTransaction],
    total: 1,
    currentPage: 1,
    totalPages: 1,
    pageSize: 8,
  },
};
