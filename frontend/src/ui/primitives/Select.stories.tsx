import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Select } from './Select';

const meta = {
  title: 'Primitives/Select',
  component: Select,
  tags: ['autodocs', 'test'],
  args: {
    defaultValue: 'checking',
    children: (
      <>
        <option value="checking">Checking</option>
        <option value="savings">Savings</option>
        <option value="credit">Credit</option>
      </>
    ),
  },
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Glass: Story = {
  args: {
    variant: 'glass',
  },
};

export const Invalid: Story = {
  args: {
    variant: 'invalid',
    'aria-invalid': true,
  },
};
