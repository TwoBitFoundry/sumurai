import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from './Input';

const meta = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
  args: {
    placeholder: 'Account nickname',
    variant: 'default',
    inputSize: 'md',
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Invalid: Story = {
  args: { variant: 'invalid', defaultValue: 'bad@', 'aria-invalid': true },
};

export const Glass: Story = {
  args: { variant: 'glass', placeholder: 'Search…' },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Read only' },
};
