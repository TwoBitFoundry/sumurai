import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { OnboardingPathScreenView } from './OnboardingPathScreen';

const meta = {
  title: 'Onboarding/OnboardingPathScreen',
  component: OnboardingPathScreenView,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
  args: {
    isDemoModeActive: false,
    onActivateDemo: fn(async () => {}),
    onDemoActivated: fn(),
    onContinueToProviders: fn(),
    onLogout: fn(),
  },
} satisfies Meta<typeof OnboardingPathScreenView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Demo mode' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Self Hosted' })).toBeVisible();
    await expect(canvas.queryByRole('heading', { name: /premium/i })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: /free trial/i })).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: /^continue$/i }));
    await expect(args.onContinueToProviders).toHaveBeenCalledTimes(1);

    await userEvent.click(canvas.getByRole('button', { name: /try demo mode/i }));
    await waitFor(() => {
      expect(args.onActivateDemo).toHaveBeenCalledTimes(1);
      expect(args.onDemoActivated).toHaveBeenCalledTimes(1);
    });
  },
};

export const DemoReturn: Story = {
  args: {
    isDemoModeActive: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /return to demo mode/i })).toBeVisible();
  },
};
