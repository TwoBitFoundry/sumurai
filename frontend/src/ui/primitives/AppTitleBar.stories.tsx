import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AppTitleBar } from './AppTitleBar';

const meta = {
  title: 'Primitives/AppTitleBar',
  component: AppTitleBar,
  tags: ['autodocs', 'test'],
  args: {
    scrolled: false,
    isOnline: true,
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
    isOnline: true,
    currentTab: 'dashboard',
    onTabChange: fn(),
    onLogout: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Settings' }));
    await expect(args.onTabChange).toHaveBeenCalledWith('settings');

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

export const AuthenticatedMobile: Story = {
  args: {
    state: 'authenticated',
    isOnline: true,
    currentTab: 'dashboard',
    onTabChange: fn(),
    onLogout: fn(),
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};
