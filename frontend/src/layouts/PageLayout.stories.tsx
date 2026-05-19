import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '@/ui/primitives';
import { radius as uiRadiusRecipes } from '@/ui/recipes';
import { PageLayout } from './PageLayout';

const meta = {
  title: 'Layouts/PageLayout',
  component: PageLayout,
  tags: ['autodocs', 'test'],
} satisfies Meta<typeof PageLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    badge: 'Example',
    title: 'Balances',
    subtitle: 'Supporting hero copy that mirrors production page framing.',
    actions: (
      <Button type="button" variant="secondary" size="sm">
        Action
      </Button>
    ),
    children: (
      <div className={`border p-6 dark:border-slate-700 ${uiRadiusRecipes.standard}`}>
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
