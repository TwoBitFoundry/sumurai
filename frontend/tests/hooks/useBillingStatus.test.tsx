import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useBillingStatus } from '@/hooks/useBillingStatus';
import { ApiClient } from '@/services/ApiClient';
import type { BillingStatusResponse } from '@/types/api';

jest.mock('@/services/ApiClient', () => ({
  ApiClient: {
    get: jest.fn(),
  },
}));

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function BillingStatusWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const status = (overrides: Partial<BillingStatusResponse>): BillingStatusResponse => ({
  billing_enabled: false,
  access_status: 'unrestricted',
  can_use_own_data: true,
  is_demo_mode_active: false,
  trial_ends_at: null,
  current_period_ends_at: null,
  payment_method_required: false,
  billing_portal_available: false,
  enabled_financial_providers: ['plaid', 'diy'],
  ...overrides,
});

describe('useBillingStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides billing when the backend reports billing disabled', async () => {
    jest.mocked(ApiClient.get).mockResolvedValueOnce(status({}));

    const { result } = renderHook(() => useBillingStatus(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shouldShowBilling).toBe(false);
    expect(result.current.billingEnabled).toBe(false);
  });

  it('hides billing when status loading fails conservatively', async () => {
    jest.mocked(ApiClient.get).mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useBillingStatus(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shouldShowBilling).toBe(false);
    expect(result.current.status).toBeNull();
  });

  it('shows billing only when backend status enables it', async () => {
    jest
      .mocked(ApiClient.get)
      .mockResolvedValueOnce(
        status({ billing_enabled: true, access_status: 'demo', can_use_own_data: false })
      );

    const { result } = renderHook(() => useBillingStatus(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shouldShowBilling).toBe(true);
    expect(result.current.status?.access_status).toBe('demo');
  });
});
