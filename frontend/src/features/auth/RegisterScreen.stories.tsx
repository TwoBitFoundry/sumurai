import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { pushStoryCredentialsOverride } from '@/storybook/screens/user-journeys/storyApi';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';
import { RegisterScreen, type RegisterScreenProps } from './RegisterScreen';

const creationChallenge = {
  publicKey: {
    challenge: 'AQID',
    rp: { id: 'localhost', name: 'Sumurai' },
    user: { id: 'BAUG', name: 'you@test.com', displayName: 'Story User' },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' as const }],
  },
};

type RegisterStoryArgs = RegisterScreenProps;

const meta = {
  title: 'App/Auth/Register',
  component: RegisterScreen,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
  args: {
    onNavigateToLogin: fn(),
    onRegisterSuccess: fn(),
  },
} satisfies Meta<RegisterStoryArgs>;

export default meta;

type Story = StoryObj<RegisterStoryArgs>;

export const Default: Story = {};

export const DefaultDark: Story = {
  ...storyDarkTheme,
};

export const AwaitingCeremony: Story = {
  args: {
    uiPhase: 'awaitingCeremony',
  },
};

export const RegistrationError: Story = {
  args: {
    bannerError: 'An account with this email already exists.',
  },
};

export const CeremonyCancelledToast: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const originalFetch = globalThis.fetch;
    const mockedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/register')) {
        return new Response(
          JSON.stringify({
            user_id: 'story-user',
            session_id: 'signup-session',
            challenge: creationChallenge,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    }) as unknown as typeof globalThis.fetch;
    const restoreCredentials = pushStoryCredentialsOverride({
      create: async () => {
        throw new Error('The operation was cancelled');
      },
    });
    globalThis.fetch = mockedFetch;
    try {
      await userEvent.type(canvas.getByLabelText(/^email$/i), 'you@test.com');
      await userEvent.type(canvas.getByLabelText(/^passkey name$/i), 'Story User');
      await userEvent.click(canvas.getByRole('button', { name: /^join$/i }));
      await waitFor(() => {
        expect(within(document.body).getByText(/passkey setup was cancelled/i)).toBeInTheDocument();
      });
    } finally {
      restoreCredentials();
      globalThis.fetch = originalFetch;
    }
  },
};

export const SignUpSuccess: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const originalFetch = globalThis.fetch;
    const mockedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/register')) {
        return new Response(
          JSON.stringify({
            user_id: 'story-user',
            session_id: 'signup-session',
            challenge: creationChallenge,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/auth/passkey/register/finish')) {
        return new Response(
          JSON.stringify({
            user_id: 'story-user',
            expires_at: '2026-05-07T18:30:00.000Z',
            onboarding_completed: false,
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
        attestationObject: new Uint8Array([2]).buffer,
        clientDataJSON: new Uint8Array([3]).buffer,
      },
    } as unknown as PublicKeyCredential;
    const restoreCredentials = pushStoryCredentialsOverride({
      create: async () => mockCredential,
    });
    globalThis.fetch = mockedFetch;
    try {
      await userEvent.type(canvas.getByLabelText(/^email$/i), 'you@test.com');
      await userEvent.type(canvas.getByLabelText(/^passkey name$/i), 'Story User');
      await userEvent.click(canvas.getByRole('button', { name: /^join$/i }));
      await waitFor(() => {
        expect(args.onRegisterSuccess).toHaveBeenCalled();
      });
    } finally {
      restoreCredentials();
      globalThis.fetch = originalFetch;
    }
  },
};
