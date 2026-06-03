import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AccountFilterTestProvider } from '@tests/utils/AccountFilterTestProvider';
import type { ReactNode } from 'react';
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics';
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter';
import { AnalyticsService } from '@/services/AnalyticsService';
import { PlaidService } from '@/services/PlaidService';

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    getSpendingTotal: jest.fn(),
    getCategorySpendingByDateRange: jest.fn(),
    getTopMerchantsByDateRange: jest.fn(),
    getMonthlyTotals: jest.fn(),
  },
}));

jest.mock('@/services/PlaidService', () => ({
  PlaidService: {
    getAccounts: jest.fn(),
    getStatus: jest.fn(),
  },
}));

const TestWrapper = AccountFilterTestProvider;

const mockPlaidAccounts = [
  {
    id: 'account1',
    name: 'Mock Checking',
    account_type: 'depository',
    balance_current: 1200,
    mask: '1111',
    plaid_connection_id: 'conn_1',
    institution_name: 'Mock Bank',
  },
  {
    id: 'account2',
    name: 'Mock Savings',
    account_type: 'depository',
    balance_current: 5400,
    mask: '2222',
    plaid_connection_id: 'conn_1',
    institution_name: 'Mock Bank',
  },
];

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AnalyticsService.getSpendingTotal).mockResolvedValue(1000);
    jest.mocked(AnalyticsService.getCategorySpendingByDateRange).mockResolvedValue([]);
    jest.mocked(AnalyticsService.getTopMerchantsByDateRange).mockResolvedValue([]);
    jest.mocked(AnalyticsService.getMonthlyTotals).mockResolvedValue([]);
    jest.mocked(PlaidService.getStatus).mockResolvedValue({
      is_connected: true,
      institution_name: 'First Platypus Bank',
      connection_id: 'conn_1',
    } as any);
    jest.mocked(PlaidService.getAccounts).mockResolvedValue(mockPlaidAccounts as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should pass account filter to analytics services when not all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useAnalytics('current-month');
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.refreshing).toBe(false);

    // Verify initial calls were made without account filter (all accounts)
    expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      undefined
    );

    // Clear the mocks to track new calls
    jest.mocked(AnalyticsService.getSpendingTotal).mockClear();
    jest.mocked(AnalyticsService.getCategorySpendingByDateRange).mockClear();
    jest.mocked(AnalyticsService.getTopMerchantsByDateRange).mockClear();
    jest.mocked(AnalyticsService.getMonthlyTotals).mockClear();

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    // Should refetch with account filter
    await waitFor(() => {
      expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        ['account1']
      );
    });
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
  });

  it('loads analytics on first visit after accounts resolve', async () => {
    const { result } = renderHook(() => useAnalytics('current-month'), {
      wrapper: TestWrapper,
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(AnalyticsService.getSpendingTotal).toHaveBeenCalled();
    expect(AnalyticsService.getCategorySpendingByDateRange).toHaveBeenCalled();
    expect(AnalyticsService.getTopMerchantsByDateRange).toHaveBeenCalled();
    expect(AnalyticsService.getMonthlyTotals).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.refreshing).toBe(false);
  });

  it('remounting serves cached analytics immediately without new service calls while fresh', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          gcTime: 10 * 60 * 1000,
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });

    function RemountWrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <AccountFilterProvider>{children}</AccountFilterProvider>
        </QueryClientProvider>
      );
    }

    const { result, unmount } = renderHook(() => useAnalytics('current-month'), {
      wrapper: RemountWrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const spendingCalls = jest.mocked(AnalyticsService.getSpendingTotal).mock.calls.length;
    const categoryCalls = jest.mocked(AnalyticsService.getCategorySpendingByDateRange).mock.calls
      .length;
    const merchantCalls = jest.mocked(AnalyticsService.getTopMerchantsByDateRange).mock.calls
      .length;
    const monthlyCalls = jest.mocked(AnalyticsService.getMonthlyTotals).mock.calls.length;
    const spendingTotal = result.current.spendingTotal;

    unmount();

    const { result: next } = renderHook(() => useAnalytics('current-month'), {
      wrapper: RemountWrapper,
    });

    expect(next.current.loading).toBe(false);
    expect(next.current.refreshing).toBe(false);
    expect(next.current.spendingTotal).toBe(spendingTotal);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(jest.mocked(AnalyticsService.getSpendingTotal).mock.calls.length).toBe(spendingCalls);
    });

    expect(jest.mocked(AnalyticsService.getCategorySpendingByDateRange).mock.calls.length).toBe(
      categoryCalls
    );
    expect(jest.mocked(AnalyticsService.getTopMerchantsByDateRange).mock.calls.length).toBe(
      merchantCalls
    );
    expect(jest.mocked(AnalyticsService.getMonthlyTotals).mock.calls.length).toBe(monthlyCalls);
  });

  it('reuses cached analytics data on rerender with the same inputs', async () => {
    const { result, rerender } = renderHook(() => useAnalytics('current-month'), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialSpendingCalls = jest.mocked(AnalyticsService.getSpendingTotal).mock.calls.length;
    const initialCategoryCalls = jest.mocked(AnalyticsService.getCategorySpendingByDateRange).mock
      .calls.length;
    const initialMerchantCalls = jest.mocked(AnalyticsService.getTopMerchantsByDateRange).mock.calls
      .length;
    const initialMonthlyCalls = jest.mocked(AnalyticsService.getMonthlyTotals).mock.calls.length;

    rerender();

    expect(jest.mocked(AnalyticsService.getSpendingTotal).mock.calls.length).toBe(
      initialSpendingCalls
    );
    expect(jest.mocked(AnalyticsService.getCategorySpendingByDateRange).mock.calls.length).toBe(
      initialCategoryCalls
    );
    expect(jest.mocked(AnalyticsService.getTopMerchantsByDateRange).mock.calls.length).toBe(
      initialMerchantCalls
    );
    expect(jest.mocked(AnalyticsService.getMonthlyTotals).mock.calls.length).toBe(
      initialMonthlyCalls
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
  });

  it('should not pass account filter when all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useAnalytics('current-month');
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.refreshing).toBe(false);

    expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      undefined
    );

    jest.mocked(AnalyticsService.getSpendingTotal).mockClear();

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    await waitFor(() => {
      expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        ['account1']
      );
    });

    jest.mocked(AnalyticsService.getSpendingTotal).mockClear();

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds([...accountFilterHook!.allAccountIds]);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(AnalyticsService.getSpendingTotal).not.toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });

  it('should refetch analytics when account filter changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useAnalytics('current-month');
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialRequestCount = jest.mocked(AnalyticsService.getSpendingTotal).mock.calls.length;

    expect(result.current.refreshing).toBe(false);

    // Change account filter
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    // Should refetch and increase request count
    await waitFor(() => {
      expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledTimes(initialRequestCount + 1);
    });
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
  });

  it('exposes refreshing during in-flight background refetches', async () => {
    const totalsDeferred = createDeferred<number>();
    const categoriesDeferred = createDeferred<any[]>();
    const merchantsDeferred = createDeferred<any[]>();
    const monthlyDeferred = createDeferred<any[]>();

    jest
      .mocked(AnalyticsService.getSpendingTotal)
      .mockResolvedValueOnce(500)
      .mockReturnValueOnce(totalsDeferred.promise as any);
    jest
      .mocked(AnalyticsService.getCategorySpendingByDateRange)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(categoriesDeferred.promise as any);
    jest
      .mocked(AnalyticsService.getTopMerchantsByDateRange)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(merchantsDeferred.promise as any);
    jest
      .mocked(AnalyticsService.getMonthlyTotals)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(monthlyDeferred.promise as any);

    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useAnalytics('current-month');
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    totalsDeferred.resolve(650);
    categoriesDeferred.resolve([{ name: 'Food', amount: 100 }] as any);
    merchantsDeferred.resolve([{ name: 'Store', amount: 50 }] as any);
    monthlyDeferred.resolve([]);

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
  });

  it('waits for account selection before fetching analytics', async () => {
    const totalsDeferred = createDeferred<number>();
    const categoriesDeferred = createDeferred<any[]>();
    const merchantsDeferred = createDeferred<any[]>();
    const monthlyDeferred = createDeferred<any[]>();

    jest.mocked(AnalyticsService.getSpendingTotal).mockReturnValue(totalsDeferred.promise as any);
    jest
      .mocked(AnalyticsService.getCategorySpendingByDateRange)
      .mockReturnValue(categoriesDeferred.promise as any);
    jest
      .mocked(AnalyticsService.getTopMerchantsByDateRange)
      .mockReturnValue(merchantsDeferred.promise as any);
    jest.mocked(AnalyticsService.getMonthlyTotals).mockReturnValue(monthlyDeferred.promise as any);

    const { result } = renderHook(() => useAnalytics('current-month'), {
      wrapper: TestWrapper,
    });

    expect(AnalyticsService.getSpendingTotal).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);

    totalsDeferred.resolve(750);
    categoriesDeferred.resolve([{ name: 'Food', value: 120 }] as any);
    merchantsDeferred.resolve([{ name: 'Store', amount: 45 }] as any);
    monthlyDeferred.resolve([]);

    await waitFor(() => {
      expect(AnalyticsService.getSpendingTotal).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.spendingTotal).toBe(750);
  });

  it('keeps prior analytics data visible while the next filter selection loads', async () => {
    const totalsDeferred = createDeferred<number>();
    const categoriesDeferred = createDeferred<any[]>();
    const merchantsDeferred = createDeferred<any[]>();
    const monthlyDeferred = createDeferred<any[]>();

    jest
      .mocked(AnalyticsService.getSpendingTotal)
      .mockResolvedValueOnce(500)
      .mockReturnValueOnce(totalsDeferred.promise as any);
    jest
      .mocked(AnalyticsService.getCategorySpendingByDateRange)
      .mockResolvedValueOnce([{ name: 'Food', value: 300 }] as any)
      .mockReturnValueOnce(categoriesDeferred.promise as any);
    jest
      .mocked(AnalyticsService.getTopMerchantsByDateRange)
      .mockResolvedValueOnce([{ name: 'Cafe', amount: 120 }] as any)
      .mockReturnValueOnce(merchantsDeferred.promise as any);
    jest
      .mocked(AnalyticsService.getMonthlyTotals)
      .mockResolvedValueOnce([{ month: '2026-05', income: 0, expenses: 500 }] as any)
      .mockReturnValueOnce(monthlyDeferred.promise as any);

    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useAnalytics('current-month');
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.spendingTotal).toBe(500);
    expect(result.current.categories).toEqual([{ name: 'Food', value: 300 }]);

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    await waitFor(() => {
      expect(result.current.refreshing).toBe(true);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.spendingTotal).toBe(500);
    expect(result.current.categories).toEqual([{ name: 'Food', value: 300 }]);
    expect(result.current.topMerchants).toEqual([{ name: 'Cafe', amount: 120 }]);

    totalsDeferred.resolve(275);
    categoriesDeferred.resolve([{ name: 'Travel', value: 275 }] as any);
    merchantsDeferred.resolve([{ name: 'Airline', amount: 275 }] as any);
    monthlyDeferred.resolve([{ month: '2026-05', income: 0, expenses: 275 }] as any);

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });

    expect(result.current.spendingTotal).toBe(275);
    expect(result.current.categories).toEqual([{ name: 'Travel', value: 275 }]);
  });
});
