import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FinanceValue } from './FinanceValue';

const meta = {
  title: 'Primitives/FinanceValue',
  component: FinanceValue,
  tags: ['autodocs', 'test'],
  args: {
    tone: 'netWorth',
    value: 12850,
  },
} satisfies Meta<typeof FinanceValue>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NetWorth: Story = {};

export const Cash: Story = {
  args: {
    tone: 'cash',
    value: 1250,
  },
};
