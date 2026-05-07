import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type React from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AuthenticationError, ServerError } from '@/services/ApiClient';
import ErrorBoundary from './ErrorBoundary';

function ThrowingChild({ error }: { error: Error }): React.ReactElement {
  throw error;
}

function ErrorBoundaryStory(props: { error: Error; onRetry?: () => void }) {
  return (
    <ErrorBoundary onRetry={props.onRetry}>
      <ThrowingChild error={props.error} />
    </ErrorBoundary>
  );
}

const meta = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundaryStory,
  tags: ['autodocs', 'test'],
  args: {
    error: new Error('Unexpected failure token=secret-value'),
    onRetry: fn(),
  },
} satisfies Meta<typeof ErrorBoundaryStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GenericError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: /something went wrong/i })).toBeVisible();
    await expect(canvas.getByText(/unexpected failure \[redacted\]/i)).toBeVisible();
  },
};

export const AuthenticationRequired: Story = {
  args: {
    error: new AuthenticationError(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: /authentication required/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /go to login/i })).toBeVisible();
  },
};

export const NetworkProblem: Story = {
  args: {
    error: new Error('Network error'),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: /connection problem/i })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

export const ServerUnavailable: Story = {
  args: {
    error: new ServerError(503),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: /server temporarily unavailable/i })
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: /try again/i })).toBeVisible();
  },
};
