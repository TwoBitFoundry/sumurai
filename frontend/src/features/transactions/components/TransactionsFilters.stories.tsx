import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TransactionsFilters } from './TransactionsFilters';

const meta = {
  title: 'Features/Transactions/TransactionsFilters',
  component: TransactionsFilters,
  tags: ['autodocs', 'test'],
  args: {
    search: '',
    onSearch: fn(),
    categories: ['Food', 'Transit', 'Income'],
    selectedCategory: null,
    onSelectCategory: fn(),
    showSearch: false,
    showCategories: true,
    showFilterLabel: true,
    layout: 'stacked',
  },
} satisfies Meta<typeof TransactionsFilters>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [selectedCategory, setSelectedCategory] = useState(args.selectedCategory);

    return (
      <TransactionsFilters
        {...args}
        selectedCategory={selectedCategory}
        onSelectCategory={(value) => {
          setSelectedCategory(value);
          args.onSelectCategory(value);
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

export const InlineContextBar: Story = {
  args: {
    showFilterLabel: false,
    layout: 'inline',
    selectedCategory: 'Food',
  },
};

export const Filtered: Story = {
  args: {
    selectedCategory: 'Food',
    search: 'coffee',
    showSearch: true,
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
    showSearch: true,
  },
};
