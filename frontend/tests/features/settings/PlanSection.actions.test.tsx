import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { BILLING_STATUS_QUERY_KEY } from '@/features/billing/useBillingStatus';
import { useBillingWorkflow } from '@/features/billing/useBillingWorkflow';
import { PlanSection } from '@/features/settings/PlanSection';
import { BillingService } from '@/services/BillingService';
import type { BillingEnabledStatusResponse, BillingStatusResponse } from '@/types/api';
import { OPEN_PRICING_EVENT } from '@/utils/events';

jest.mock('@/features/billing/useBillingWorkflow', () => ({
  useBillingWorkflow: jest.fn(),
}));

const disabledDemo: BillingStatusResponse = {
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

const workflow = {
  status: 'idle' as const,
  error: undefined,
  billingStatus: undefined,
  startPremiumCheckout: jest.fn().mockResolvedValue(undefined),
  startCardlessTrial: jest.fn().mockResolvedValue(undefined),
  startTrialPaymentMethod: jest.fn().mockResolvedValue(undefined),
  startPastDueRecovery: jest.fn().mockResolvedValue(undefined),
  retry: jest.fn().mockResolvedValue(undefined),
  cancel: jest.fn(),
};

const renderPlan = (status: BillingStatusResponse) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(BILLING_STATUS_QUERY_KEY, status);

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <PlanSection />
      </QueryClientProvider>
    ),
  };
};

const wrapper = (client: QueryClient, children: ReactNode) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('PlanSection actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useBillingWorkflow).mockReturnValue(workflow);
  });

  it('opens pricing for a disabled demo user', async () => {
    const user = userEvent.setup();
    const handler = jest.fn();
    window.addEventListener(OPEN_PRICING_EVENT, handler);
    renderPlan(disabledDemo);

    await user.click(screen.getByRole('button', { name: 'Upgrade' }));

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_PRICING_EVENT, handler);
  });

  it('opens a modal and starts a card-less trial with the shared address form', async () => {
    const user = userEvent.setup();
    renderPlan(enabledStatus('demo', { trials_enabled: true }));

    await user.click(screen.getByRole('button', { name: 'Start free trial' }));
    expect(screen.getByRole('dialog', { name: 'Start your free trial' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Country code'), 'us');
    await user.type(screen.getByLabelText('Postal code'), '78701');
    await user.click(screen.getByRole('button', { name: 'Start free trial' }));

    expect(workflow.startCardlessTrial).toHaveBeenCalledWith({
      country_code: 'US',
      postal_code: '78701',
    });
  });

  it('opens the plan picker for a demo user upgrading to Premium', async () => {
    const user = userEvent.setup();
    const handler = jest.fn();
    window.addEventListener(OPEN_PRICING_EVENT, handler);
    renderPlan(enabledStatus('demo'));

    await user.click(screen.getByRole('button', { name: 'Upgrade to Premium' }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(workflow.startPremiumCheckout).not.toHaveBeenCalled();
    window.removeEventListener(OPEN_PRICING_EVENT, handler);
  });

  it.each([
    ['paused', enabledStatus('paused'), 'Upgrade to Premium'],
    ['canceled', enabledStatus('canceled'), 'Upgrade to Premium'],
    ['expired', enabledStatus('expired'), 'Upgrade to Premium'],
  ] as const)('uses Premium checkout for %s recovery', async (_name, status, label) => {
    const user = userEvent.setup();
    renderPlan(status);

    await user.click(screen.getByRole('button', { name: label }));

    expect(workflow.startPremiumCheckout).toHaveBeenCalledWith({
      token: 'test_client_token',
      environment: 'sandbox',
    });
  });

  it('uses the trial payment-method target and preserves the trial plan while it runs', async () => {
    const user = userEvent.setup();
    renderPlan(
      enabledStatus('trialing', {
        payment_method_required: true,
        trial_ends_at: '2026-08-15T00:00:00Z',
      })
    );

    await user.click(screen.getByRole('button', { name: 'Upgrade to Premium' }));

    expect(workflow.startTrialPaymentMethod).toHaveBeenCalledWith({
      token: 'test_client_token',
      environment: 'sandbox',
    });
    expect(screen.getByRole('heading', { name: 'Free trial' })).toBeInTheDocument();
  });

  it('uses the past-due recovery target', async () => {
    const user = userEvent.setup();
    renderPlan(enabledStatus('past_due', { payment_method_required: true }));

    await user.click(screen.getByRole('button', { name: 'Update payment method' }));

    expect(workflow.startPastDueRecovery).toHaveBeenCalledWith({
      token: 'test_client_token',
      environment: 'sandbox',
    });
  });

  it('shows Premium-start copy after the trial payment method is ready', () => {
    renderPlan(
      enabledStatus('trialing', {
        payment_method_required: false,
        trial_ends_at: '2026-08-15T00:00:00Z',
      })
    );

    expect(screen.getByText('Premium begins automatically when your trial ends.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Upgrade to Premium' })).not.toBeInTheDocument();
  });

  it('opens the billing portal only after the session succeeds', async () => {
    const user = userEvent.setup();
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    jest.spyOn(BillingService, 'createPortalSession').mockResolvedValue({
      overview_url: 'https://sandbox-pay.paddle.io/portal/session',
      subscription_urls: [],
    });
    renderPlan(enabledStatus('active', { billing_portal_available: true }));

    await user.click(screen.getByRole('button', { name: 'Manage billing' }));

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        'https://sandbox-pay.paddle.io/portal/session',
        '_blank',
        'noopener'
      );
    });
    open.mockRestore();
  });

  it('keeps the plan visible and reports portal failure without opening a popup', async () => {
    const user = userEvent.setup();
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    jest
      .spyOn(BillingService, 'createPortalSession')
      .mockRejectedValue(new Error('Portal unavailable'));
    renderPlan(enabledStatus('active', { billing_portal_available: true }));

    await user.click(screen.getByRole('button', { name: 'Manage billing' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Portal unavailable');
    });
    expect(screen.getByRole('heading', { name: 'Premium' })).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('optimistically renders membership end after one confirmed cancel and refetches', async () => {
    const user = userEvent.setup();
    let resolveStatus: (status: BillingStatusResponse) => void = () => {};
    const statusPromise = new Promise<BillingStatusResponse>((resolve) => {
      resolveStatus = resolve;
    });
    const activeStatus = enabledStatus('active', {
      current_period_ends_at: '2026-08-15T00:00:00Z',
    });
    jest.spyOn(BillingService, 'cancelSubscription').mockResolvedValue({
      status: 'scheduled',
      scheduled_cancel_at: '2026-08-15T00:00:00Z',
    });
    jest.spyOn(BillingService, 'getStatus').mockReturnValue(statusPromise);
    const { queryClient } = renderPlan(activeStatus);

    await user.click(screen.getByRole('button', { name: 'Cancel membership' }));
    await user.click(screen.getByRole('button', { name: 'Cancel membership' }));

    await waitFor(() => {
      expect(screen.getByText('Membership ends August 15, 2026')).toBeInTheDocument();
    });
    expect(BillingService.cancelSubscription).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(BILLING_STATUS_QUERY_KEY)).toMatchObject({
      scheduled_cancel_at: '2026-08-15T00:00:00Z',
    });

    await act(async () => {
      resolveStatus({
        ...activeStatus,
        scheduled_cancel_at: '2026-08-15T00:00:00Z',
      });
      await statusPromise;
    });
  });

  it('preserves the active plan and allows retry after cancellation fails', async () => {
    const user = userEvent.setup();
    jest
      .spyOn(BillingService, 'cancelSubscription')
      .mockRejectedValueOnce(new Error('Cancellation failed. Try again.'));
    const { queryClient } = renderPlan(enabledStatus('active'));

    await user.click(screen.getByRole('button', { name: 'Cancel membership' }));
    await user.click(screen.getByRole('button', { name: 'Cancel membership' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Cancellation failed. Try again.');
    });
    expect(screen.getByText('Renewal date unavailable')).toBeInTheDocument();
    expect(queryClient.getQueryData(BILLING_STATUS_QUERY_KEY)).toMatchObject({
      scheduled_cancel_at: null,
    });
    expect(screen.getByRole('button', { name: 'Cancel membership' })).toBeEnabled();
  });

  it('surfaces workflow errors and timeout retry without losing the plan state', async () => {
    const user = userEvent.setup();
    jest.mocked(useBillingWorkflow).mockReturnValue({
      ...workflow,
      status: 'timeout',
    });
    const { queryClient, rerender } = renderPlan(enabledStatus('demo'));

    expect(screen.getByRole('alert')).toHaveTextContent('taking longer than expected');
    expect(screen.getByRole('heading', { name: 'Demo mode' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry activation' }));
    expect(workflow.retry).toHaveBeenCalledTimes(1);

    jest.mocked(useBillingWorkflow).mockReturnValue({
      ...workflow,
      status: 'error',
      error: {
        kind: 'trial_already_used',
        message: 'Trial already used',
        cause: new Error('Trial already used'),
      },
    });
    rerender(wrapper(queryClient, <PlanSection />));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This account has already used its free trial.'
    );
    expect(screen.getByRole('heading', { name: 'Demo mode' })).toBeInTheDocument();
  });
});
