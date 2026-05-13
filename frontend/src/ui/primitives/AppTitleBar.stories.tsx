import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes } from '@/ui/recipes';
import { AppTitleBar } from './AppTitleBar';

const meta = {
  title: 'Primitives/AppTitleBar',
  component: AppTitleBar,
  tags: ['autodocs', 'test'],
  args: {
    scrolled: false,
    themeMode: 'light' as const,
    isOnline: true,
    onThemeToggle: fn(),
  },
} satisfies Meta<typeof AppTitleBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unauthenticated: Story = {
  args: {
    state: 'unauthenticated',
  },
};

export const Onboarding: Story = {
  args: {
    state: 'onboarding',
    isOnline: true,
    onLogout: fn(),
  },
};

export const AuthenticatedDashboard: Story = {
  args: {
    state: 'authenticated',
    themeMode: 'dark',
    isOnline: true,
    currentTab: 'dashboard',
    onTabChange: fn(),
    onLogout: fn(),
    accountFilterNode: (
      <span className={cn('text-xs', 'font-medium', uiTextRecipes.muted)}>Filter</span>
    ),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByLabelText('Toggle theme'));
    await expect(args.onThemeToggle).toHaveBeenCalledTimes(1);

    await userEvent.click(canvas.getByRole('button', { name: 'Transactions' }));
    await expect(args.onTabChange).toHaveBeenCalledWith('transactions');

    await userEvent.click(canvas.getByRole('button', { name: /logout/i }));
    await expect(args.onLogout).toHaveBeenCalledTimes(1);
  },
};

export const AuthenticatedScrolled: Story = {
  args: {
    ...AuthenticatedDashboard.args,
    scrolled: true,
    currentTab: 'transactions',
  },
};
