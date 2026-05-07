import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';
import { LoginScreen, RegisterScreen } from './Auth';

const meta = {
  title: 'App/Auth',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoginDefault: Story = {
  render: () => <LoginScreen onNavigateToRegister={() => {}} />,
};

export const LoginDefaultDark: Story = {
  ...storyDarkTheme,
  render: () => <LoginScreen onNavigateToRegister={() => {}} />,
};

export const LoginAuthenticationError: Story = {
  render: () => <LoginScreen onNavigateToRegister={() => {}} />,
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

export const RegisterDefault: Story = {
  render: () => <RegisterScreen onNavigateToLogin={() => {}} />,
};

export const RegisterInlineEmailValidation: Story = {
  render: () => <RegisterScreen onNavigateToLogin={() => {}} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText(/^email$/i), 'not-an-email');
    await waitFor(() => {
      expect(canvas.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  },
};

export const RegisterPasswordMismatch: Story = {
  render: () => <RegisterScreen onNavigateToLogin={() => {}} />,
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
