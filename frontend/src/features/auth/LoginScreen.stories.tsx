import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { pushStoryCredentialsOverride } from '@/storybook/screens/user-journeys/storyApi';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';
import { LoginScreen, type LoginScreenProps } from './LoginScreen';

const passkeyChallenge = {
  publicKey: {
    challenge: 'AQID',
    rpId: 'localhost',
    allowCredentials: [{ id: 'AQID', type: 'public-key' as const }],
    userVerification: 'preferred' as const,
  },
};

type LoginStoryArgs = LoginScreenProps;

const meta = {
  title: 'App/Auth/Login',
  component: LoginScreen,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
  args: {
    onNavigateToRegister: fn(),
    onLoginSuccess: fn(),
  },
} satisfies Meta<LoginStoryArgs>;

export default meta;

type Story = StoryObj<LoginStoryArgs>;

export const Default: Story = {};

export const DefaultDark: Story = {
  ...storyDarkTheme,
};

export const Loading: Story = {
  args: {
    uiPhase: 'submitting',
  },
};

export const AwaitingCeremony: Story = {
  args: {
    uiPhase: 'awaitingCeremony',
  },
};

export const NoPasskeyEnrolled: Story = {
  args: {
    bannerError: 'Sign-in failed. Check your email and password, or create a new account.',
  },
};

export const CeremonyCancelledToast: Story = {
  render: (args) => <LoginScreen {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const originalFetch = globalThis.fetch;
    const mockedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/passkey/login/begin')) {
        return new Response(
          JSON.stringify({
            session_id: 'story-session',
            challenge: passkeyChallenge,
            account_exists: true,
            passkey_available: true,
            password_available: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    }) as unknown as typeof globalThis.fetch;
    const restoreCredentials = pushStoryCredentialsOverride({
      get: async () => {
        throw new Error('The operation was cancelled');
      },
    });
    globalThis.fetch = mockedFetch;
    try {
      await userEvent.type(canvas.getByLabelText(/^email$/i), 'you@test.com');
      await userEvent.click(canvas.getByRole('button', { name: /^enter$/i }));
      await waitFor(() => {
        expect(
          within(document.body).getByText(/passkey sign-in was cancelled/i)
        ).toBeInTheDocument();
      });
      expect(canvas.getByLabelText(/^email$/i)).not.toBeDisabled();
    } finally {
      restoreCredentials();
      globalThis.fetch = originalFetch;
    }
  },
};

export const NetworkError: Story = {
  args: {
    bannerError: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: RequestInfo | URL, _init?: RequestInit) => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof globalThis.fetch;
    try {
      await userEvent.type(canvas.getByLabelText(/^email$/i), 'you@test.com');
      await userEvent.click(canvas.getByRole('button', { name: /^enter$/i }));
      await waitFor(
        () => {
          expect(within(document.body).getByText(/network error/i)).toBeInTheDocument();
        },
        { timeout: 15_000 }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
};

export const SignInSuccess: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const originalFetch = globalThis.fetch;
    const mockedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/passkey/login/begin')) {
        return new Response(
          JSON.stringify({
            session_id: 'story-session',
            challenge: passkeyChallenge,
            account_exists: true,
            passkey_available: true,
            password_available: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/auth/passkey/login/finish')) {
        return new Response(
          JSON.stringify({
            user_id: 'story-user',
            expires_at: '2026-05-07T18:30:00.000Z',
            onboarding_completed: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    }) as unknown as typeof globalThis.fetch;
    const mockCredential = {
      id: 'cred-id',
      rawId: new Uint8Array([1]).buffer,
      type: 'public-key',
      response: {
        authenticatorData: new Uint8Array([2]).buffer,
        clientDataJSON: new Uint8Array([3]).buffer,
        signature: new Uint8Array([4]).buffer,
      },
    } as unknown as PublicKeyCredential;
    const restoreCredentials = pushStoryCredentialsOverride({
      get: async () => mockCredential,
    });
    globalThis.fetch = mockedFetch;
    try {
      await userEvent.type(canvas.getByLabelText(/^email$/i), 'you@test.com');
      await userEvent.click(canvas.getByRole('button', { name: /^enter$/i }));
      await waitFor(() => {
        expect(args.onLoginSuccess).toHaveBeenCalled();
      });
    } finally {
      restoreCredentials();
      globalThis.fetch = originalFetch;
    }
  },
};
