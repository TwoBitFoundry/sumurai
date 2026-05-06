import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '@/ui/primitives';
import { PageLayout } from './PageLayout';

const meta = {
  title: 'Layouts/PageLayout',
  component: PageLayout,
  tags: ['autodocs'],
} satisfies Meta<typeof PageLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    badge: 'Example',
    title: 'Overview of Balances',
    subtitle: 'Supporting hero copy that mirrors production page framing.',
    actions: (
      <Button type="button" variant="secondary" size="sm">
        Action
      </Button>
    ),
    children: (
      <div className="rounded-xl border border-slate-200 p-6 dark:border-slate-700">
        Primary surface content
      </div>
    ),
  },
};

export const WithPageError: Story = {
  args: {
    ...Default.args,
    error: 'Unable to reach the server. Try again shortly.',
  },
};
