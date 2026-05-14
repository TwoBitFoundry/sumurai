import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes } from '@/ui/recipes';
import { AppLayout } from './AppLayout';

const meta = {
  title: 'Layouts/AppLayout',
  component: AppLayout,
  tags: ['autodocs', 'test'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    isOnline: true,
    onTabChange: fn(),
    onLogout: fn(),
    renderAccountFilter: () => (
      <span
        className={cn(
          'rounded-full',
          'border',
          'border-slate-200',
          'px-3',
          'py-1',
          'text-xs',
          'font-medium',
          uiTextRecipes.muted,
          'dark:border-slate-600'
        )}
      >
        Filter
      </span>
    ),
  },
} satisfies Meta<typeof AppLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {
  args: {
    currentTab: 'dashboard',
    isOnline: true,
    children: (
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white/60 p-8 dark:border-slate-700 dark:bg-slate-900/40">
        Dashboard body placeholder
      </div>
    ),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/filter/i)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Transactions' }));
    await expect(args.onTabChange).toHaveBeenCalledWith('transactions');
    await userEvent.click(canvas.getByLabelText('Toggle theme'));
    await userEvent.click(canvas.getByRole('button', { name: /logout/i }));
    await expect(args.onLogout).toHaveBeenCalledTimes(1);
  },
};

export const TransactionsTab: Story = {
  args: {
    currentTab: 'transactions',
    isOnline: true,
    children: (
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white/60 p-8 dark:border-slate-700 dark:bg-slate-900/40">
        Transactions body placeholder
      </div>
    ),
  },
};
