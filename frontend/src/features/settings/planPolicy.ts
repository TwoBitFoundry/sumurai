import type { BillingEnabledStatusResponse, BillingStatusResponse } from '@/types/api';

export type PlanActionId =
  | 'switch_self_hosted'
  | 'start_trial'
  | 'upgrade_premium'
  | 'update_payment_method'
  | 'cancel_membership'
  | 'manage_billing';

export interface PlanAction {
  id: PlanActionId;
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
}

export interface PlanAlert {
  variant: 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

export interface PlanPolicy {
  planLabel: string | null;
  introCopy: string;
  statusCopy: string;
  detail: string;
  highlights: string[];
  paymentMethodRequired: boolean;
  canCancel: boolean;
  alert: PlanAlert | null;
  actions: PlanAction[];
}

const subscriptionIntroCopy = 'Manage your Sumurai subscription and plan access.';
const selfHostedIntroCopy = 'Choose your Sumurai plan.';

const action = {
  switchSelfHosted: {
    id: 'switch_self_hosted',
    label: 'Upgrade',
    variant: 'primary',
  },
  startTrial: {
    id: 'start_trial',
    label: 'Start free trial',
    variant: 'secondary',
  },
  upgradePremium: {
    id: 'upgrade_premium',
    label: 'Upgrade to Premium',
    variant: 'primary',
  },
  updatePaymentMethod: {
    id: 'update_payment_method',
    label: 'Update payment method',
    variant: 'primary',
  },
  cancelMembership: {
    id: 'cancel_membership',
    label: 'Cancel membership',
    variant: 'danger',
  },
  manageBilling: {
    id: 'manage_billing',
    label: 'Manage billing',
    variant: 'secondary',
  },
} as const satisfies Record<string, PlanAction>;

export function formatPlanDate(timestamp: string | null): string | null {
  if (!timestamp) {
    return null;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function canCancelMembership(status: BillingStatusResponse): boolean {
  return (
    status.billing_enabled &&
    status.access_status === 'active' &&
    status.scheduled_cancel_at === null
  );
}

export function needsPaymentMethod(status: BillingStatusResponse): boolean {
  return status.billing_enabled && status.payment_method_required;
}

function withPortal(status: BillingEnabledStatusResponse, actions: PlanAction[]): PlanAction[] {
  return status.billing_portal_available ? [...actions, action.manageBilling] : actions;
}

function resolveEnabledPolicy(status: BillingEnabledStatusResponse): PlanPolicy {
  const paymentMethodRequired = needsPaymentMethod(status);
  const canCancel = canCancelMembership(status);

  if (status.access_status === 'demo') {
    return {
      planLabel: 'Demo mode',
      introCopy: 'Explore sample data, then subscribe when you are ready for live accounts.',
      statusCopy: 'Ready to connect live accounts?',
      detail: 'Start a trial or upgrade to leave sample data behind.',
      highlights: [
        'Connect your own financial accounts',
        'Replace sample balances and transactions',
        'Use Premium planning workflows',
      ],
      paymentMethodRequired,
      canCancel,
      alert: null,
      actions: withPortal(
        status,
        status.trials_enabled ? [action.startTrial, action.upgradePremium] : [action.upgradePremium]
      ),
    };
  }

  if (status.access_status === 'trialing') {
    const trialEnd = formatPlanDate(status.trial_ends_at);
    return {
      planLabel: 'Free trial',
      introCopy: subscriptionIntroCopy,
      statusCopy: trialEnd ? `Trial ends ${trialEnd}` : 'Trial end date unavailable',
      detail: paymentMethodRequired
        ? 'Add a payment method to keep Premium access after your trial.'
        : 'Premium begins automatically when your trial ends.',
      highlights: [],
      paymentMethodRequired,
      canCancel,
      alert: null,
      actions: withPortal(status, paymentMethodRequired ? [action.upgradePremium] : []),
    };
  }

  if (status.access_status === 'active') {
    const scheduledEnd = formatPlanDate(status.scheduled_cancel_at);
    const renewal = formatPlanDate(status.current_period_ends_at);
    return {
      planLabel: 'Premium',
      introCopy: subscriptionIntroCopy,
      statusCopy:
        status.scheduled_cancel_at !== null
          ? scheduledEnd
            ? `Membership ends ${scheduledEnd}`
            : 'Membership end date unavailable'
          : renewal
            ? `Renews ${renewal}`
            : 'Renewal date unavailable',
      detail:
        status.scheduled_cancel_at !== null
          ? 'Premium access remains available through the end of your membership.'
          : 'Your live accounts and Premium workflows stay available.',
      highlights: [],
      paymentMethodRequired,
      canCancel,
      alert: null,
      actions: withPortal(status, canCancel ? [action.cancelMembership] : []),
    };
  }

  if (status.access_status === 'past_due') {
    return {
      planLabel: 'Premium',
      introCopy: subscriptionIntroCopy,
      statusCopy: 'Payment needs attention',
      detail: 'Update your payment method to restore Premium access.',
      highlights: [],
      paymentMethodRequired,
      canCancel,
      alert: {
        variant: 'error',
        title: 'Payment past due',
        message: 'Your latest payment could not be completed.',
      },
      actions: withPortal(status, [action.updatePaymentMethod]),
    };
  }

  if (status.access_status === 'paused') {
    return {
      planLabel: 'Premium',
      introCopy: subscriptionIntroCopy,
      statusCopy: 'Premium paused',
      detail: 'Resume Premium to use your own financial data again.',
      highlights: [],
      paymentMethodRequired,
      canCancel,
      alert: null,
      actions: withPortal(status, [action.upgradePremium]),
    };
  }

  if (status.access_status === 'canceled') {
    return {
      planLabel: 'Premium',
      introCopy: subscriptionIntroCopy,
      statusCopy: 'Premium canceled',
      detail: 'Start Premium again to use your own financial data.',
      highlights: [],
      paymentMethodRequired,
      canCancel,
      alert: null,
      actions: withPortal(status, [action.upgradePremium]),
    };
  }

  if (status.access_status === 'expired') {
    return {
      planLabel: 'Premium',
      introCopy: subscriptionIntroCopy,
      statusCopy: 'Premium expired',
      detail: 'Renew Premium to use your own financial data again.',
      highlights: [],
      paymentMethodRequired,
      canCancel,
      alert: null,
      actions: withPortal(status, [action.upgradePremium]),
    };
  }

  return {
    planLabel: null,
    introCopy: subscriptionIntroCopy,
    statusCopy: 'No plan information is available.',
    detail: 'Refresh your plan status or try again later.',
    highlights: [],
    paymentMethodRequired,
    canCancel,
    alert: null,
    actions: withPortal(status, []),
  };
}

export function resolvePlanPolicy(status: BillingStatusResponse): PlanPolicy | null {
  if (!status.billing_enabled) {
    if (!status.is_demo_mode_active) {
      return null;
    }
    return {
      planLabel: 'Demo mode',
      introCopy: selfHostedIntroCopy,
      statusCopy: 'Ready to go live on your deployment?',
      detail: 'Upgrade to replace sample data with your own accounts.',
      highlights: [
        'Connect DIY, SimpleFIN, or Plaid',
        'Bring in real balances and transactions',
        'Keep full control of your self-hosted data',
      ],
      paymentMethodRequired: false,
      canCancel: false,
      alert: null,
      actions: [action.switchSelfHosted],
    };
  }

  return resolveEnabledPolicy(status);
}
