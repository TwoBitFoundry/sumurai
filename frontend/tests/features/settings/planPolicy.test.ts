import {
  canCancelMembership,
  formatPlanDate,
  needsPaymentMethod,
  resolvePlanPolicy,
} from '@/features/settings/planPolicy';
import type { BillingEnabledStatusResponse, BillingStatusResponse } from '@/types/api';

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

const actionIds = (status: BillingStatusResponse) =>
  resolvePlanPolicy(status)?.actions.map((action) => action.id) ?? [];

describe('planPolicy', () => {
  it('hides only billing-disabled non-demo access', () => {
    expect(resolvePlanPolicy(disabledStatus)).toBeNull();
    expect(resolvePlanPolicy({ ...disabledStatus, is_demo_mode_active: true })).toMatchObject({
      planLabel: 'Demo mode',
      introCopy: 'Choose your Sumurai plan.',
      statusCopy: 'Ready to go live on your deployment?',
      detail: 'Upgrade to replace sample data with your own accounts.',
      highlights: [
        'Connect DIY, SimpleFIN, or Plaid',
        'Bring in real balances and transactions',
        'Keep full control of your self-hosted data',
      ],
      actions: [{ id: 'switch_self_hosted', label: 'Upgrade' }],
    });
  });

  it('resolves enabled demo upgrade choices from trial availability', () => {
    expect(resolvePlanPolicy(enabledStatus('demo'))).toMatchObject({
      introCopy: 'Explore sample data, then subscribe when you are ready for live accounts.',
    });
    expect(actionIds(enabledStatus('demo'))).toEqual(['upgrade_premium']);
    expect(actionIds(enabledStatus('demo', { trials_enabled: true }))).toEqual([
      'start_trial',
      'upgrade_premium',
    ]);
  });

  it('uses subscription intro copy for paid plan states', () => {
    expect(resolvePlanPolicy(enabledStatus('active'))).toMatchObject({
      introCopy: 'Manage your Sumurai subscription and plan access.',
    });
  });

  it('resolves trial management with and without a required payment method', () => {
    const requiringPayment = resolvePlanPolicy(
      enabledStatus('trialing', {
        is_demo_mode_active: true,
        payment_method_required: true,
        trial_ends_at: '2026-08-15T12:00:00Z',
      })
    );
    const paymentReady = resolvePlanPolicy(
      enabledStatus('trialing', {
        payment_method_required: false,
        trial_ends_at: '2026-08-15T12:00:00Z',
      })
    );

    expect(requiringPayment).toMatchObject({
      planLabel: 'Free trial',
      statusCopy: 'Trial ends August 15, 2026',
      paymentMethodRequired: true,
      actions: [{ id: 'upgrade_premium' }],
    });
    expect(paymentReady).toMatchObject({
      planLabel: 'Free trial',
      paymentMethodRequired: false,
      detail: 'Premium begins automatically when your trial ends.',
      actions: [],
    });
  });

  it('lets trialing and active entitlement status win over demo-data mode', () => {
    expect(
      resolvePlanPolicy(enabledStatus('trialing', { is_demo_mode_active: true }))?.planLabel
    ).toBe('Free trial');
    expect(
      resolvePlanPolicy(enabledStatus('active', { is_demo_mode_active: true }))?.planLabel
    ).toBe('Premium');
  });

  it('resolves active renewal, scheduled end, cancel, and portal actions', () => {
    const renewable = resolvePlanPolicy(
      enabledStatus('active', {
        current_period_ends_at: '2026-08-15T12:00:00Z',
        billing_portal_available: true,
      })
    );
    const scheduled = resolvePlanPolicy(
      enabledStatus('active', {
        scheduled_cancel_at: '2026-08-15T12:00:00Z',
        billing_portal_available: true,
      })
    );

    expect(renewable).toMatchObject({
      statusCopy: 'Renews August 15, 2026',
      canCancel: true,
    });
    expect(renewable?.actions.map((action) => action.id)).toEqual([
      'cancel_membership',
      'manage_billing',
    ]);
    expect(scheduled).toMatchObject({
      statusCopy: 'Membership ends August 15, 2026',
      canCancel: false,
    });
    expect(scheduled?.actions.map((action) => action.id)).toEqual(['manage_billing']);
  });

  it.each([
    ['past_due', 'Payment needs attention', ['update_payment_method', 'manage_billing']],
    ['paused', 'Premium paused', ['upgrade_premium', 'manage_billing']],
    ['canceled', 'Premium canceled', ['upgrade_premium', 'manage_billing']],
    ['expired', 'Premium expired', ['upgrade_premium', 'manage_billing']],
  ] as const)('resolves %s recovery state', (accessStatus, statusCopy, actions) => {
    const policy = resolvePlanPolicy(
      enabledStatus(accessStatus, { billing_portal_available: true })
    );

    expect(policy?.statusCopy).toBe(statusCopy);
    expect(policy?.actions.map((action) => action.id)).toEqual(actions);
    if (accessStatus === 'past_due') {
      expect(policy?.alert).toMatchObject({ variant: 'error', title: 'Payment past due' });
    }
  });

  it('renders an explicit empty policy for an enabled unrestricted response', () => {
    expect(resolvePlanPolicy(enabledStatus('unrestricted'))).toMatchObject({
      planLabel: null,
      statusCopy: 'No plan information is available.',
      actions: [],
    });
  });

  it('formats valid dates and rejects absent or invalid timestamps', () => {
    expect(formatPlanDate('2026-08-15T00:00:00Z')).toBe('August 15, 2026');
    expect(formatPlanDate(null)).toBeNull();
    expect(formatPlanDate('not-a-date')).toBeNull();

    expect(
      resolvePlanPolicy(enabledStatus('trialing', { trial_ends_at: 'not-a-date' }))?.statusCopy
    ).toBe('Trial end date unavailable');
    expect(
      resolvePlanPolicy(enabledStatus('active', { current_period_ends_at: null }))?.statusCopy
    ).toBe('Renewal date unavailable');
    expect(
      resolvePlanPolicy(enabledStatus('active', { scheduled_cancel_at: 'not-a-date' }))?.statusCopy
    ).toBe('Membership end date unavailable');
  });

  it('exposes cancellation and payment-method decisions as pure helpers', () => {
    expect(canCancelMembership(enabledStatus('active'))).toBe(true);
    expect(
      canCancelMembership(enabledStatus('active', { scheduled_cancel_at: '2026-08-15T12:00:00Z' }))
    ).toBe(false);
    expect(needsPaymentMethod(enabledStatus('trialing', { payment_method_required: true }))).toBe(
      true
    );
    expect(needsPaymentMethod(enabledStatus('active'))).toBe(false);
  });
});
