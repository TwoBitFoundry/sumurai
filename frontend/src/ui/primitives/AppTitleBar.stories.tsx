import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { AppTitleBar } from './AppTitleBar';

const meta = {
  title: 'Primitives/AppTitleBar',
  component: AppTitleBar,
  tags: ['autodocs'],
  args: {
    scrolled: false,
    themeMode: 'light' as const,
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
    onLogout: fn(),
  },
};

export const AuthenticatedDashboard: Story = {
  args: {
    state: 'authenticated',
    themeMode: 'dark',
    currentTab: 'dashboard',
    onTabChange: fn(),
    onLogout: fn(),
    accountFilterNode: (
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">All accounts</span>
    ),
  },
};

export const AuthenticatedScrolled: Story = {
  args: {
    ...AuthenticatedDashboard.args,
    scrolled: true,
    currentTab: 'transactions',
  },
};
