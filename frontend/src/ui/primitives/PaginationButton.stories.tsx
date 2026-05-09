import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PaginationButton } from './PaginationButton';

const meta = {
  title: 'Primitives/PaginationButton',
  component: PaginationButton,
  tags: ['autodocs', 'test'],
  args: {
    children: <ChevronLeftIcon className="h-4 w-4" />,
  },
} satisfies Meta<typeof PaginationButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
