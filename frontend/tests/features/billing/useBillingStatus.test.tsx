import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BILLING_STATUS_QUERY_KEY, useBillingStatus } from '@/features/billing/useBillingStatus';
import { BillingService } from '@/services/BillingService';
import type { BillingStatusResponse } from '@/types/api';

jest.mock('@/services/BillingService', () => ({
  BillingService: {
    getStatus: jest.fn(),
  },
}));

const enabledStatus = {
  billing_enabled: true,
  trials_enabled: true,
  paddle_client_token: 'test_client_token',
  paddle_environment: 'sandbox',
  access_status: 'trialing',
  can_use_own_data: true,
  is_demo_mode_active: false,
  trial_ends_at: '2026-08-23T12:00:00Z',
  current_period_ends_at: '2026-08-23T12:00:00Z',
  scheduled_cancel_at: null,
  payment_method_required: true,
  billing_portal_available: true,
  enabled_financial_providers: ['diy', 'plaid'],
} satisfies BillingStatusResponse;

const disabledStatus = {
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
} satisfies BillingStatusResponse;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return {
    queryClient,
    Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    },
  };
};

describe('useBillingStatus', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('returns the enabled billing response and uses the shared query key', async () => {
    jest.mocked(BillingService.getStatus).mockResolvedValueOnce(enabledStatus);
    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingStatus(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(enabledStatus);
    expect(queryClient.getQueryData(BILLING_STATUS_QUERY_KEY) as typeof enabledStatus).toEqual(
      enabledStatus
    );
  });

  it('returns a server-provided disabled billing response unchanged', async () => {
    jest.mocked(BillingService.getStatus).mockResolvedValueOnce(disabledStatus);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingStatus(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(disabledStatus);
  });

  it('uses the disabled fallback only after the status query fails', async () => {
    jest.mocked(BillingService.getStatus).mockRejectedValueOnce(new Error('status unavailable'));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingStatus(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toMatchObject({
      billing_enabled: false,
      paddle_client_token: null,
      paddle_environment: null,
      access_status: 'unrestricted',
    });
  });

  it('does not replace a pending query with the disabled fallback', () => {
    jest.mocked(BillingService.getStatus).mockReturnValueOnce(new Promise(() => {}));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingStatus(), { wrapper: Wrapper });

    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('does not query while disabled', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBillingStatus({ enabled: false }), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(BillingService.getStatus).not.toHaveBeenCalled();
  });
});
