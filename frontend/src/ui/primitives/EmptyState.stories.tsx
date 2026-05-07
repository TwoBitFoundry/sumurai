import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Target } from 'lucide-react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

const meta = {
  title: 'Primitives/EmptyState',
  component: EmptyState,
  tags: ['autodocs', 'test'],
  args: {
    icon: Target,
    title: 'Nothing here yet',
    description: 'Create your first item to populate this view.',
  },
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAction: Story = {
  args: {
    action: <Button variant="primary">Get started</Button>,
  },
};

export const Dark: Story = {
  decorators: [
    (StoryEl) => (
      <div className="dark min-h-[220px] rounded-3xl bg-slate-950 p-10">
        <StoryEl />
      </div>
    ),
  ],
};
