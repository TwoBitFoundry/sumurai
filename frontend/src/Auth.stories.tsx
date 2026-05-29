import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { OnboardingProviderPicker } from '@/components/onboarding/OnboardingProviderPicker';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import { storyOnboardingPickerHandlers } from '@/storybook/screens/user-journeys/shared';
import { StoryApiScope } from '@/storybook/screens/user-journeys/storyApi';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';
import { LoginScreen, RegisterScreen } from './Auth';

const storyInteractionTimeoutMs = 20_000;

const passkeyChallenge = {
  publicKey: {
    challenge: 'AQID',
    rpId: 'localhost',
    allowCredentials: [{ id: 'AQID', type: 'public-key' as const }],
    userVerification: 'preferred' as const,
  },
};

const creationChallenge = {
  publicKey: {
    challenge: 'AQID',
    rp: { id: 'localhost', name: 'Sumurai' },
    user: { id: 'BAUG', name: 'you@test.com', displayName: 'Story User' },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' as const }],
  },
};

type AuthStoryArgs = {
  onNavigateToRegister: () => void;
  onNavigateToLogin: () => void;
  onLoginSuccess: (authResponse: {
    user_id: string;
    expires_at: string;
    onboarding_completed: boolean;
  }) => void;
  onRegisterSuccess: (authResponse: {
    user_id: string;
    expires_at: string;
    onboarding_completed: boolean;
  }) => void;
};

const meta = {
  title: 'App/Auth',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
  args: {
    onNavigateToRegister: fn(),
    onNavigateToLogin: fn(),
    onLoginSuccess: fn(),
    onRegisterSuccess: fn(),
  },
} satisfies Meta<AuthStoryArgs>;

export default meta;

type Story = StoryObj<AuthStoryArgs>;

export const LoginDefault: Story = {
  render: (args) => <LoginScreen onNavigateToRegister={args.onNavigateToRegister} />,
};

export const LoginDefaultDark: Story = {
  ...storyDarkTheme,
  render: (args) => <LoginScreen onNavigateToRegister={args.onNavigateToRegister} />,
};

export const LoginAuthenticationError: Story = {
  render: (args) => <LoginScreen onNavigateToRegister={args.onNavigateToRegister} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const originalFetch = globalThis.fetch;
    const mockedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/passkey/login/begin')) {
        return new Response(
          JSON.stringify({ session_id: 'story-session', challenge: passkeyChallenge }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/auth/passkey/login/finish')) {
        return new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    }) as typeof globalThis.fetch;
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
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        credentials: {
          get: async () => mockCredential,
        },
      },
    });
    globalThis.fetch = mockedFetch;
    try {
      await userEvent.type(canvas.getByLabelText(/^email$/i), 'you@test.com');
      await userEvent.click(canvas.getByRole('button', { name: /sign in with passkey/i }));
      await waitFor(() => {
        expect(canvas.getByText(/sign-in failed|unauthorized|authentication error/i)).toBeTruthy();
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
};

export const LoginSuccess: Story = {
  render: (args) => (
    <LoginScreen
      onNavigateToRegister={args.onNavigateToRegister}
      onLoginSuccess={args.onLoginSuccess}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const originalFetch = globalThis.fetch;
    const mockedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/passkey/login/begin')) {
        return new Response(
          JSON.stringify({ session_id: 'story-session', challenge: passkeyChallenge }),
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
    }) as typeof globalThis.fetch;
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
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        credentials: {
          get: async () => mockCredential,
        },
      },
    });
    globalThis.fetch = mockedFetch;
    try {
      await userEvent.type(canvas.getByLabelText(/^email$/i), 'you@test.com');
      await userEvent.click(canvas.getByRole('button', { name: /sign in with passkey/i }));
      await waitFor(() => {
        expect(args.onLoginSuccess).toHaveBeenCalledWith({
          user_id: 'story-user',
          expires_at: '2026-05-07T18:30:00.000Z',
          onboarding_completed: true,
        });
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
};

export const LoginNavigateToRegister: Story = {
  render: (args) => <LoginScreen onNavigateToRegister={args.onNavigateToRegister} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /create account/i }));
    await expect(args.onNavigateToRegister).toHaveBeenCalledTimes(1);
  },
};

export const RegisterDefault: Story = {
  render: (args) => <RegisterScreen onNavigateToLogin={args.onNavigateToLogin} />,
};

export const RegisterInlineEmailValidation: Story = {
  render: (args) => <RegisterScreen onNavigateToLogin={args.onNavigateToLogin} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText(/^email$/i), 'not-an-email');
    await waitFor(() => {
      expect(canvas.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  },
};

export const RegisterSuccess: Story = {
  render: (args) => (
    <RegisterScreen
      onNavigateToLogin={args.onNavigateToLogin}
      onRegisterSuccess={args.onRegisterSuccess}
    />
  ),
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
    }) as typeof globalThis.fetch;
    const mockCredential = {
      id: 'cred-id',
      rawId: new Uint8Array([1]).buffer,
      type: 'public-key',
      response: {
        attestationObject: new Uint8Array([2]).buffer,
        clientDataJSON: new Uint8Array([3]).buffer,
      },
    } as unknown as PublicKeyCredential;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        credentials: {
          create: async () => mockCredential,
        },
      },
    });
    globalThis.fetch = mockedFetch;
    try {
      await userEvent.type(canvas.getByLabelText(/^email$/i), 'you@test.com');
      await userEvent.type(canvas.getByLabelText(/^name$/i), 'Story User');
      await userEvent.click(canvas.getByRole('button', { name: /create account with passkey/i }));
      await waitFor(() => {
        expect(args.onRegisterSuccess).toHaveBeenCalledWith({
          user_id: 'story-user',
          expires_at: '2026-05-07T18:30:00.000Z',
          onboarding_completed: false,
        });
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
};

export const RegisterNavigateToLogin: Story = {
  render: (args) => <RegisterScreen onNavigateToLogin={args.onNavigateToLogin} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^sign in$/i }));
    await expect(args.onNavigateToLogin).toHaveBeenCalledTimes(1);
  },
};

export const OnboardingProviderPickerStory: StoryObj<{ onComplete: () => void }> = {
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs', 'test'],
  args: {
    onComplete: fn(),
  },
  render: (args) => (
    <AccountFilterStoryProvider>
      <StoryApiScope handlers={storyOnboardingPickerHandlers}>
        <OnboardingProviderPicker onComplete={args.onComplete} />
      </StoryApiScope>
    </AccountFilterStoryProvider>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('provider-selection-panel')).toBeVisible();
      },
      { timeout: storyInteractionTimeoutMs }
    );

    await expect(canvas.getByRole('button', { name: /skip for now/i })).toBeVisible();
    await expect(canvas.getByAltText('SimpleFIN logo')).toBeVisible();

    const connectButtons = canvas.getAllByRole('button', { name: /^connect$/i });
    await expect(connectButtons[1]).toBeEnabled();

    await userEvent.click(canvas.getByRole('button', { name: /skip for now/i }));
    await expect(args.onComplete).toHaveBeenCalledTimes(1);
  },
};
