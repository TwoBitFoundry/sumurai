import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useRef, useState } from 'react';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { Button } from '@/ui/primitives';
import type { BudgetFormValue } from './AddBudgetPicker';
import { AddBudgetPicker } from './AddBudgetPicker';

const categories = ['FOOD_AND_DRINK', 'ENTERTAINMENT', 'Coffee'];

function AddBudgetPickerStoryShell(props: {
  categories: string[];
  initial: BudgetFormValue;
  onSave: () => void;
  onRequestClose: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState<BudgetFormValue>(props.initial);
  const accentIndexByName = new Map(categories.map((name, index) => [name, index]));

  return (
    <div className="flex justify-end p-8">
      <Button ref={anchorRef} type="button" onClick={() => setOpen((current) => !current)}>
        Add budget
      </Button>
      <AddBudgetPicker
        open={open}
        anchorRef={anchorRef}
        categories={props.categories}
        accentIndexByName={accentIndexByName}
        value={value}
        onChange={setValue}
        onSave={() => {
          props.onSave();
          setOpen(false);
        }}
        onRequestClose={() => {
          props.onRequestClose();
          setOpen(false);
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Features/Budgets/AddBudgetPicker',
  component: AddBudgetPickerStoryShell,
  tags: ['autodocs', 'test'],
  args: {
    categories,
    initial: { category: '', amount: '' } satisfies BudgetFormValue,
    onSave: fn(),
    onRequestClose: fn(),
  },
  render: (args) => (
    <AddBudgetPickerStoryShell key={`${args.initial.category}-${args.initial.amount}`} {...args} />
  ),
} satisfies Meta<typeof AddBudgetPickerStoryShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SaveInteraction: Story = {
  play: async ({ args }) => {
    const picker = await screen.findByTestId('add-budget-picker-content');
    const pickerView = within(picker);
    await userEvent.click(pickerView.getByRole('button', { name: 'Entertainment' }));
    await userEvent.type(screen.getByTestId('budget-amount-input'), '275');
    await userEvent.click(screen.getByRole('button', { name: 'Save budget' }));
    await expect(args.onSave).toHaveBeenCalledTimes(1);
  },
};
