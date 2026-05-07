import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['autodocs', 'test'],
  args: {
    children: 'Status',
    variant: 'default',
    size: 'md',
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary',
  },
};

export const Feature: Story = {
  args: {
    variant: 'feature',
    children: 'Feature',
  },
};

export const Small: Story = {
  args: {
    size: 'xs',
    children: 'XS',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large',
  },
};
