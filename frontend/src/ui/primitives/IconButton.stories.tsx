import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { IconButton } from './IconButton';

const meta = {
  title: 'Primitives/IconButton',
  component: IconButton,
  tags: ['autodocs', 'test'],
  args: {
    children: <ChevronLeftIcon className="h-4 w-4" />,
    variant: 'ghost',
  },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ghost: Story = {};

export const Success: Story = {
  args: {
    variant: 'success',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
  },
};
