import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { BillingEnabledStatusResponse, BillingStatusResponse } from '@/types/api';
import { PlanSectionView } from './PlanSectionView';
import { resolvePlanPolicy } from './planPolicy';

const disabledStatus: BillingStatusResponse = {
  billing_enabled: false,
  trials_enabled: false,
  paddle_client_token: null,
  paddle_environment: null,
  access_status: 'unrestricted',
  can_use_own_data: true,
  is_demo_mode_active: true,
  trial_ends_at: null,
  current_period_ends_at: null,
  scheduled_cancel_at: null,
  payment_method_required: false,
  billing_portal_available: false,
  enabled_financial_providers: ['diy'],
};

const enabledStatus = (
  accessStatus: BillingEnabledStatusResponse['access_status'],
  overrides: Partial<BillingEnabledStatusResponse> = {}
): BillingEnabledStatusResponse => ({
  billing_enabled: true,
  trials_enabled: false,
  paddle_client_token: 'test_client_token',
  paddle_environment: 'sandbox',
  access_status: accessStatus,
  can_use_own_data: accessStatus === 'trialing' || accessStatus === 'active',
  is_demo_mode_active: false,
  trial_ends_at: null,
  current_period_ends_at: null,
  scheduled_cancel_at: null,
  payment_method_required: false,
  billing_portal_available: false,
  enabled_financial_providers: ['diy', 'plaid'],
  ...overrides,
});

const meta = {
  title: 'App/Settings/PlanSection',
  component: PlanSectionView,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs', 'test'],
  args: {
    policy: resolvePlanPolicy(disabledStatus),
    isLoading: false,
    queryError: null,
    isEmpty: false,
    mutationPending: false,
    mutationError: null,
    onRetry: fn(),
    onRetryMutation: fn(),
    onStartTrialRequest: fn(async () => {}),
    onCancelTrialForm: fn(),
    onSwitchSelfHosted: fn(),
    onStartTrial: fn(),
    onUpgradePremium: fn(),
    onUpdatePaymentMethod: fn(),
    onCancelMembership: fn(),
    onManageBilling: fn(),
  },
} satisfies Meta<typeof PlanSectionView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DisabledDemo: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Demo mode' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Upgrade' }));
    await expect(args.onSwitchSelfHosted).toHaveBeenCalledTimes(1);
    await expect(canvas.queryByTestId('plan-status-pill')).not.toBeInTheDocument();
  },
};

export const EnabledDemo: Story = {
  args: {
    policy: resolvePlanPolicy(enabledStatus('demo')),
  },
};

export const EnabledDemoWithTrial: Story = {
  args: {
    policy: resolvePlanPolicy(enabledStatus('demo', { trials_enabled: true })),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Start free trial' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Upgrade to Premium' }));
    await expect(args.onStartTrial).toHaveBeenCalledTimes(1);
    await expect(args.onUpgradePremium).toHaveBeenCalledTimes(1);
  },
};

export const TrialPaymentRequired: Story = {
  args: {
    policy: resolvePlanPolicy(
      enabledStatus('trialing', {
        is_demo_mode_active: true,
        payment_method_required: true,
        trial_ends_at: '2026-08-15T12:00:00Z',
      })
    ),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Upgrade to Premium' }));
    await expect(args.onUpgradePremium).toHaveBeenCalledTimes(1);
  },
};

export const TrialPaymentReady: Story = {
  args: {
    policy: resolvePlanPolicy(
      enabledStatus('trialing', {
        payment_method_required: false,
        trial_ends_at: '2026-08-15T12:00:00Z',
      })
    ),
  },
};

export const Active: Story = {
  args: {
    policy: resolvePlanPolicy(
      enabledStatus('active', {
        current_period_ends_at: '2026-08-15T12:00:00Z',
        billing_portal_available: true,
      })
    ),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel membership' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Manage billing' }));
    await expect(args.onCancelMembership).toHaveBeenCalledTimes(1);
    await expect(args.onManageBilling).toHaveBeenCalledTimes(1);
  },
};

export const ScheduledEnd: Story = {
  args: {
    policy: resolvePlanPolicy(
      enabledStatus('active', {
        scheduled_cancel_at: '2026-08-15T12:00:00Z',
        billing_portal_available: true,
      })
    ),
  },
};

export const PastDue: Story = {
  args: {
    policy: resolvePlanPolicy(
      enabledStatus('past_due', {
        payment_method_required: true,
        billing_portal_available: true,
      })
    ),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Update payment method' }));
    await expect(args.onUpdatePaymentMethod).toHaveBeenCalledTimes(1);
  },
};

export const Paused: Story = {
  args: {
    policy: resolvePlanPolicy(enabledStatus('paused')),
  },
};

export const Canceled: Story = {
  args: {
    policy: resolvePlanPolicy(enabledStatus('canceled')),
  },
};

export const Expired: Story = {
  args: {
    policy: resolvePlanPolicy(enabledStatus('expired')),
  },
};

export const Loading: Story = {
  args: {
    policy: null,
    isLoading: true,
  },
};

export const QueryError: Story = {
  args: {
    policy: null,
    queryError: 'Billing could not be reached.',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

export const Empty: Story = {
  args: {
    policy: null,
    isEmpty: true,
  },
};

export const MutationPending: Story = {
  args: {
    mutationPending: true,
  },
};

export const MutationError: Story = {
  args: {
    mutationError: 'Plan activation is taking longer than expected.',
    mutationRetryLabel: 'Retry activation',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Retry activation' }));
    await expect(args.onRetryMutation).toHaveBeenCalledTimes(1);
  },
};

export const TrialForm: Story = {
  args: {
    policy: resolvePlanPolicy(enabledStatus('demo', { trials_enabled: true })),
    trialFormOpen: true,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Country code'), 'us');
    await userEvent.type(canvas.getByLabelText('Postal code'), '78701');
    await userEvent.click(canvas.getByRole('button', { name: 'Start free trial' }));
    await expect(args.onStartTrialRequest).toHaveBeenCalledWith({
      country_code: 'US',
      postal_code: '78701',
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(args.onCancelTrialForm).toHaveBeenCalledTimes(1);
  },
};
