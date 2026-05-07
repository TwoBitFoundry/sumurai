import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { SessionExpiryModal, SessionManager } from './SessionManager';
import { AuthService } from './services/authService';
import { GlassCard } from './ui/primitives';

type SessionManagerStoryArgs = {
  onStayLoggedIn: () => void;
  onLogout: () => void;
  onSessionRefreshed: (expiresAt: string) => void;
};

const meta = {
  title: 'App/SessionManager',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', 'test'],
  args: {
    onStayLoggedIn: fn(),
    onLogout: fn(),
    onSessionRefreshed: fn(),
  },
} satisfies Meta<SessionManagerStoryArgs>;

export default meta;

type Story = StoryObj<SessionManagerStoryArgs>;

export const ExpiryModal: Story = {
  render: (args) => (
    <SessionExpiryModal
      isOpen
      timeRemaining={90}
      onStayLoggedIn={args.onStayLoggedIn}
      onLogout={args.onLogout}
      onSessionRefreshed={args.onSessionRefreshed}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const originalRefreshToken = AuthService.refreshToken;
    AuthService.refreshToken = async () => ({
      user_id: 'story-user',
      expires_at: '2026-05-07T18:30:00.000Z',
      onboarding_completed: true,
    });
    try {
      await expect(body.getByRole('heading', { name: /session expiring/i })).toBeVisible();
      await expect(body.getByText('1:30')).toBeVisible();
      await userEvent.click(body.getByRole('button', { name: /stay logged in/i }));
      await expect(args.onSessionRefreshed).toHaveBeenCalledWith('2026-05-07T18:30:00.000Z');
      await expect(args.onStayLoggedIn).toHaveBeenCalledTimes(1);
    } finally {
      AuthService.refreshToken = originalRefreshToken;
    }
  },
};

export const LogoutNow: Story = {
  render: (args) => (
    <SessionExpiryModal
      isOpen
      timeRemaining={30}
      onStayLoggedIn={args.onStayLoggedIn}
      onLogout={args.onLogout}
      onSessionRefreshed={args.onSessionRefreshed}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole('button', { name: /logout now/i }));
    await expect(args.onLogout).toHaveBeenCalledTimes(1);
  },
};

export const ExpiredSession: Story = {
  render: (args) => (
    <SessionManager
      expiresAt="2020-01-01T00:00:00.000Z"
      onSessionRefreshed={args.onSessionRefreshed}
      onLogout={args.onLogout}
    >
      <GlassCard variant="accent" padding="lg">
        Protected dashboard
      </GlassCard>
    </SessionManager>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/protected dashboard/i)).toBeVisible();
    await waitFor(() => {
      expect(args.onLogout).toHaveBeenCalledTimes(1);
    });
  },
};
