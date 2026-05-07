import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';
import { LoginScreen, RegisterScreen } from './Auth';

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
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/login')) {
        return new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    };
    try {
      await userEvent.type(canvas.getByLabelText(/^email$/i), 'you@test.com');
      await userEvent.type(canvas.getByLabelText(/^password$/i), 'wrong-pass');
      await userEvent.click(canvas.getByRole('button', { name: /^sign in$/i }));
      await waitFor(() => {
        expect(canvas.getByText(/invalid email or password/i)).toBeInTheDocument();
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
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/login')) {
        return new Response(
          JSON.stringify({
            user_id: 'story-user',
            expires_at: '2026-05-07T18:30:00.000Z',
            onboarding_completed: true,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      return originalFetch(input, init);
    };
    try {
      await userEvent.type(canvas.getByLabelText(/^email$/i), 'you@test.com');
      await userEvent.type(canvas.getByLabelText(/^password$/i), 'Test1234!');
      await userEvent.click(canvas.getByRole('button', { name: /^sign in$/i }));
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

export const RegisterPasswordMismatch: Story = {
  render: (args) => <RegisterScreen onNavigateToLogin={args.onNavigateToLogin} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText(/^email$/i), 'you@test.com');
    await userEvent.type(canvas.getByLabelText(/^password$/i), 'Test1234!');
    await userEvent.type(canvas.getByLabelText(/^confirm password$/i), 'Test12345!');
    await waitFor(() => {
      expect(canvas.getByText(/passwords do not match/i)).toBeInTheDocument();
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
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/register')) {
        return new Response(
          JSON.stringify({
            user_id: 'story-user',
            expires_at: '2026-05-07T18:30:00.000Z',
            onboarding_completed: false,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      return originalFetch(input, init);
    };
    try {
      await userEvent.type(canvas.getByLabelText(/^email$/i), 'you@test.com');
      await userEvent.type(canvas.getByLabelText(/^password$/i), 'Test1234!');
      await userEvent.type(canvas.getByLabelText(/^confirm password$/i), 'Test1234!');
      await userEvent.click(canvas.getByRole('button', { name: /^create account$/i }));
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
