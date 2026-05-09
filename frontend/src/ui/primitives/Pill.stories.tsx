import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Pill } from './Pill';

const meta = {
  title: 'Primitives/Pill',
  component: Pill,
  tags: ['autodocs', 'test'],
  args: {
    children: 'Groceries',
    categoryName: 'Groceries',
    variant: 'category',
  },
} satisfies Meta<typeof Pill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Category: Story = {};

export const Status: Story = {
  args: {
    variant: 'status',
    tone: 'success',
    children: 'On track',
  },
};

export const Dot: Story = {
  args: {
    variant: 'dot',
    children: 'Manual review',
  },
};
