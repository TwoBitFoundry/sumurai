import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useBillingStatus } from '@/features/billing/useBillingStatus';
import { useBillingWorkflow } from '@/features/billing/useBillingWorkflow';
import { PlanSection } from '@/features/settings/PlanSection';
import type { BillingStatusResponse } from '@/types/api';

jest.mock('@/features/billing/useBillingStatus', () => ({
  useBillingStatus: jest.fn(),
}));

jest.mock('@/features/billing/useBillingWorkflow', () => ({
  useBillingWorkflow: jest.fn(),
}));

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

describe('PlanSection', () => {
  beforeEach(() => {
    jest.mocked(useBillingWorkflow).mockReturnValue({
      status: 'idle',
      error: undefined,
      billingStatus: undefined,
      startPremiumCheckout: jest.fn(),
      startCardlessTrial: jest.fn(),
      startTrialPaymentMethod: jest.fn(),
      startPastDueRecovery: jest.fn(),
      retry: jest.fn(),
      cancel: jest.fn(),
    });
  });

  const renderSection = () => {
    const queryClient = new QueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <PlanSection />
      </QueryClientProvider>
    );
  };

  it('is absent for billing-disabled non-demo users', () => {
    jest.mocked(useBillingStatus).mockReturnValue({
      data: disabledStatus,
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    renderSection();

    expect(screen.queryByRole('heading', { name: 'Plan' })).not.toBeInTheDocument();
  });

  it('renders disabled demo, loading, empty, and query-error states with retry', async () => {
    const refetch = jest.fn();
    jest.mocked(useBillingStatus).mockReturnValue({
      data: { ...disabledStatus, is_demo_mode_active: true },
      isPending: false,
      isError: false,
      error: null,
      refetch,
    } as any);
    const queryClient = new QueryClient();
    const section = () => (
      <QueryClientProvider client={queryClient}>
        <PlanSection />
      </QueryClientProvider>
    );
    const { rerender } = render(section());
    expect(screen.getByRole('heading', { name: 'Demo mode' })).toBeInTheDocument();

    jest.mocked(useBillingStatus).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch,
    } as any);
    rerender(section());
    expect(screen.getByText('Loading plan…')).toBeInTheDocument();

    jest.mocked(useBillingStatus).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      refetch,
    } as any);
    rerender(section());
    expect(screen.getByText('No plan information is available.')).toBeInTheDocument();

    jest.mocked(useBillingStatus).mockReturnValue({
      data: disabledStatus,
      isPending: false,
      isError: true,
      error: new Error('Billing could not be reached.'),
      refetch,
    } as any);
    rerender(section());
    expect(screen.getByRole('alert')).toHaveTextContent('Billing could not be reached.');

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
