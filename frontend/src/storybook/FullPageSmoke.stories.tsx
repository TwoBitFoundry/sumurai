import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
  title: 'Storybook/FullPageSmoke',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Prefer title group Screens for authenticated tab compositions that mirror production chrome.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const DeprecatedPlaceholder: Story = {
  render: () => (
    <div className="flex min-h-[40vh] items-center justify-center px-6 text-center text-sm text-slate-600 dark:text-slate-400">
      Use Screens → Dashboard, Transactions, Budgets, Accounts, or Settings for full-width slices.
    </div>
  ),
};
