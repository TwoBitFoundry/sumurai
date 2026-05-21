import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TransactionsToolbar } from './TransactionsToolbar';

const meta = {
  title: 'Features/Transactions/TransactionsToolbar',
  component: TransactionsToolbar,
  tags: ['autodocs', 'test'],
  args: {
    search: '',
    onSearch: fn(),
    categories: ['Food', 'Transit', 'Income'],
    selectedCategory: null,
    onSelectCategory: fn(),
  },
} satisfies Meta<typeof TransactionsToolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [search, setSearch] = useState(args.search);

    return (
      <TransactionsToolbar
        {...args}
        search={search}
        onSearch={(value) => {
          setSearch(value);
          args.onSearch(value);
        }}
      />
    );
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^food$/i }));
    await expect(args.onSelectCategory).toHaveBeenCalledWith('Food');
  },
};

export const Filtered: Story = {
  args: {
    selectedCategory: 'Food',
    search: 'coffee',
  },
};

const wideCategories = [
  'Food',
  'Transit',
  'Income',
  'Entertainment',
  'Bills',
  'Health',
  'Shopping',
  'Travel',
  'Transfers',
];

export const ManyCategories: Story = {
  args: {
    categories: wideCategories,
    selectedCategory: 'Entertainment',
    search: '',
  },
};

export const LongSearchQuery: Story = {
  args: {
    categories: ['Food', 'Transit', 'Income'],
    selectedCategory: null,
    search: 'international artisan wholesale collective quarterly adjustment',
  },
};
