import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import { radius as uiRadiusRecipes } from '@/ui/recipes';
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
  },
} satisfies Meta<typeof AppLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

const withMockAccountFilter = [
  (Story) => (
    <AccountFilterStoryProvider>
      <Story />
    </AccountFilterStoryProvider>
  ),
];

export const Dashboard: Story = {
  decorators: withMockAccountFilter,
  args: {
    currentTab: 'dashboard',
    isOnline: true,
    children: (
      <div
        className={`mx-auto max-w-5xl ${uiRadiusRecipes.standard} border border-slate-200 bg-white/60 p-8 dark:border-slate-700 dark:bg-slate-900/40`}
      >
        Dashboard body placeholder
      </div>
    ),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Transactions' }));
    await expect(args.onTabChange).toHaveBeenCalledWith('transactions');
    await userEvent.click(canvas.getByRole('button', { name: /logout/i }));
    await expect(args.onLogout).toHaveBeenCalledTimes(1);
  },
};

export const TransactionsTab: Story = {
  decorators: withMockAccountFilter,
  args: {
    currentTab: 'transactions',
    isOnline: true,
    children: (
      <div
        className={`mx-auto max-w-5xl ${uiRadiusRecipes.standard} border border-slate-200 bg-white/60 p-8 dark:border-slate-700 dark:bg-slate-900/40`}
      >
        Transactions body placeholder
      </div>
    ),
  },
};
