import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import type { BudgetFormValue } from './BudgetForm';
import { BudgetForm } from './BudgetForm';

const categories = ['food_and_drink', 'transportation', 'entertainment', 'income'];

function BudgetFormStoryShell(props: {
  categories: string[];
  usedCategories: Set<string>;
  initial: BudgetFormValue;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<BudgetFormValue>(props.initial);
  return (
    <BudgetForm
      categories={props.categories}
      usedCategories={props.usedCategories}
      value={value}
      onChange={setValue}
      onSave={props.onSave}
      onCancel={props.onCancel}
    />
  );
}

const meta = {
  title: 'Features/Budgets/BudgetForm',
  component: BudgetFormStoryShell,
  tags: ['autodocs'],
  args: {
    categories,
    usedCategories: new Set<string>(['income']),
    initial: { category: '', amount: '' } satisfies BudgetFormValue,
    onSave: () => {},
    onCancel: () => {},
  },
  render: (args) => (
    <BudgetFormStoryShell key={`${args.initial.category}-${args.initial.amount}`} {...args} />
  ),
} satisfies Meta<typeof BudgetFormStoryShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Prefilled: Story = {
  args: {
    initial: { category: 'food_and_drink', amount: '240' },
  },
};
