import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { BillingStatusResponse, BillingTrialStartRequest } from '@/types/api';
import type { BillingWorkflowState } from './billingWorkflow';
import { PricingScreenView, type PricingScreenViewProps } from './PricingScreen';

const disabledStatus: BillingStatusResponse = {
  billing_enabled: false,
  trials_enabled: false,
  paddle_client_token: null,
  paddle_environment: null,
  access_status: 'unrestricted',
  can_use_own_data: true,
  is_demo_mode_active: false,
  trial_ends_at: null,
  current_period_ends_at: null,
  scheduled_cancel_at: null,
  payment_method_required: false,
  billing_portal_available: false,
  enabled_financial_providers: ['diy', 'plaid', 'simplefin'],
};

const enabledStatus: BillingStatusResponse = {
  ...disabledStatus,
  billing_enabled: true,
  trials_enabled: false,
  paddle_client_token: 'test_client_token',
  paddle_environment: 'sandbox',
  access_status: 'demo',
  can_use_own_data: false,
  enabled_financial_providers: ['diy', 'plaid'],
};

const enabledTrialStatus: BillingStatusResponse = {
  ...enabledStatus,
  trials_enabled: true,
};

const demoReturnStatus: BillingStatusResponse = {
  ...disabledStatus,
  is_demo_mode_active: true,
};

function TrialHarness(props: PricingScreenViewProps) {
  const [workflowState, setWorkflowState] = useState<BillingWorkflowState>({ status: 'idle' });

  const startTrial = async (request: BillingTrialStartRequest) => {
    setWorkflowState({ status: 'creating' });
    await props.onStartTrial(request);
    setWorkflowState({ status: 'activated' });
  };

  return <PricingScreenView {...props} workflowState={workflowState} onStartTrial={startTrial} />;
}

const meta = {
  title: 'Billing/PricingScreen',
  component: PricingScreenView,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
  args: {
    billingStatus: disabledStatus,
    workflowState: { status: 'idle' },
    onActivateDemo: fn(async () => {}),
    onDemoActivated: fn(),
    onContinueToProviders: fn(),
    onLogout: fn(),
    onStartTrial: fn(async () => {}),
    onStartCheckout: fn(async () => {}),
    onRetry: fn(async () => {}),
  },
} satisfies Meta<typeof PricingScreenView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Disabled: Story = {
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
    billingStatus: demoReturnStatus,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /return to demo mode/i })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /try demo mode/i })).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: /return to demo mode/i }));
    await waitFor(() => {
      expect(args.onActivateDemo).toHaveBeenCalledTimes(1);
      expect(args.onDemoActivated).toHaveBeenCalledTimes(1);
    });
  },
};

export const Enabled: Story = {
  args: {
    billingStatus: enabledStatus,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Demo mode' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: /premium/i })).toBeVisible();
    await expect(canvas.queryByRole('heading', { name: /self hosted/i })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: /free trial/i })).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: /upgrade to premium/i }));
    await expect(args.onStartCheckout).toHaveBeenCalledTimes(1);
  },
};

export const EnabledWithTrial: Story = {
  args: {
    billingStatus: enabledTrialStatus,
  },
  render: (args) => <TrialHarness {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /choose free trial/i }));
    await userEvent.click(canvas.getByRole('button', { name: /start free trial/i }));
    await expect(canvas.getByText('Enter a two-letter country code.')).toBeVisible();

    const country = canvas.getByLabelText(/country code/i);
    await userEvent.type(country, 'u-s');
    await expect(country).toHaveValue('US');
    await userEvent.type(canvas.getByLabelText(/postal code/i), ' 78701 ');
    await userEvent.click(canvas.getByRole('button', { name: /start free trial/i }));

    await waitFor(() => {
      expect(args.onStartTrial).toHaveBeenCalledWith({
        country_code: 'US',
        postal_code: '78701',
      });
      expect(args.onContinueToProviders).toHaveBeenCalledTimes(1);
    });
  },
};

export const Waiting: Story = {
  args: {
    billingStatus: enabledTrialStatus,
    workflowState: { status: 'waiting_activation' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status', { name: /payment received/i })).toHaveTextContent(
      /finishing setup/i
    );
    await expect(canvas.getByRole('button', { name: /try demo mode/i })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: /choose free trial/i })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: /upgrade to premium/i })).toBeDisabled();
  },
};

export const Timeout: Story = {
  args: {
    billingStatus: enabledTrialStatus,
    workflowState: { status: 'timeout' },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent(/taking longer than expected/i);
    await userEvent.click(canvas.getByRole('button', { name: /retry activation/i }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

export const WorkflowError: Story = {
  args: {
    billingStatus: enabledStatus,
    workflowState: {
      status: 'error',
      error: {
        kind: 'rate_limited',
        message: 'Rate limit reached',
        cause: new Error('Rate limit reached'),
      },
    },
    onActivateDemo: fn(async () => {
      throw new Error('Demo unavailable');
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent(/too many attempts/i);
    await userEvent.click(canvas.getByRole('button', { name: /try demo mode/i }));
    await waitFor(() => {
      expect(canvas.getAllByRole('alert')[1]).toHaveTextContent(
        /demo mode could not be activated/i
      );
    });
  },
};
