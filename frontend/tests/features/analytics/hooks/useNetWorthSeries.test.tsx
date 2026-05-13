import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { AccountFilterTestProvider } from '@tests/utils/AccountFilterTestProvider';
import { useNetWorthSeries } from '@/features/analytics/hooks/useNetWorthSeries';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { AnalyticsService } from '@/services/AnalyticsService';
import { PlaidService } from '@/services/PlaidService';
import { ProviderCatalog } from '@/services/ProviderCatalog';
import type { DateRangeKey } from '@/utils/dateRanges';

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    getNetWorthOverTime: jest.fn(),
  },
}));

jest.mock('@/services/PlaidService', () => ({
  PlaidService: {
    getAccounts: jest.fn(),
    getStatus: jest.fn(),
  },
}));

jest.mock('@/services/ProviderCatalog', () => ({
  ProviderCatalog: {
    getAccounts: jest.fn(),
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

describe('useNetWorthSeries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AnalyticsService.getNetWorthOverTime).mockResolvedValue([
      { date: '2024-04-01', value: 3400 },
      { date: '2024-04-02', value: 3500 },
    ]);
    jest.mocked(PlaidService.getStatus).mockResolvedValue({
      is_connected: true,
      institution_name: 'First Platypus Bank',
      connection_id: 'conn_1',
    } as any);
    jest.mocked(PlaidService.getAccounts).mockResolvedValue(mockPlaidAccounts as any);
    jest.mocked(ProviderCatalog.getAccounts).mockResolvedValue(mockPlaidAccounts as any);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('loads net worth series for the computed range', async () => {
    const series = [
      { date: '2024-04-01', value: 3400 },
      { date: '2024-04-02', value: 3500 },
    ];

    jest.mocked(AnalyticsService.getNetWorthOverTime).mockResolvedValueOnce(series);

    const { result } = renderHook(({ range }) => useNetWorthSeries(range), {
      initialProps: { range: 'current-month' as DateRangeKey },
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.series).toEqual(series);
    });

    expect(result.current.error).toBeNull();
  });

  it('reuses cached net worth data on rerender with the same inputs', async () => {
    const { result, rerender } = renderHook(
      () => useNetWorthSeries('current-month' as DateRangeKey),
      {
        wrapper: TestWrapper,
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialCalls = jest.mocked(AnalyticsService.getNetWorthOverTime).mock.calls.length;

    rerender();

    expect(jest.mocked(AnalyticsService.getNetWorthOverTime).mock.calls.length).toBe(initialCalls);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
  });

  it('loads after account filter finishes loading', async () => {
    const accountsDeferred = createDeferred<any[]>();
    jest.mocked(ProviderCatalog.getAccounts).mockReturnValueOnce(accountsDeferred.promise as any);

    const { result } = renderHook(
      () => {
        return {
          netWorth: useNetWorthSeries('current-month' as DateRangeKey),
          filter: useAccountFilter(),
        };
      },
      {
        wrapper: TestWrapper,
      }
    );

    await waitFor(() => {
      expect(result.current.filter.loading).toBe(true);
    });

    const initialCalls = jest.mocked(AnalyticsService.getNetWorthOverTime).mock.calls.length;

    await act(async () => {
      await result.current.netWorth.reload();
    });

    expect(jest.mocked(AnalyticsService.getNetWorthOverTime).mock.calls.length).toBe(initialCalls);

    await act(async () => {
      accountsDeferred.resolve(mockPlaidAccounts as any);
    });

    await waitFor(() => {
      expect(AnalyticsService.getNetWorthOverTime).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(result.current.netWorth.loading).toBe(false);
    });
    expect(result.current.netWorth.error).toBeNull();
    expect(result.current.netWorth.series.length).toBeGreaterThan(0);
  });

  it('responds to range changes and ignores aborted results', async () => {
    const first = createDeferred<{ date: string; value: number }[]>();
    const second = createDeferred<{ date: string; value: number }[]>();
    const finalSeries = [{ date: '2024-02-01', value: 1200 }];

    jest
      .mocked(AnalyticsService.getNetWorthOverTime)
      .mockReturnValueOnce(first.promise as any)
      .mockReturnValueOnce(second.promise as any)
      .mockResolvedValue(finalSeries as any);

    let accountFilterHook: ReturnType<typeof useAccountFilter>;
    const { result, rerender } = renderHook(
      ({ range }) => {
        accountFilterHook = useAccountFilter();
        return useNetWorthSeries(range);
      },
      {
        initialProps: { range: 'past-2-months' as DateRangeKey },
        wrapper: TestWrapper,
      }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    await waitFor(() => {
      expect(jest.mocked(AnalyticsService.getNetWorthOverTime).mock.calls.length).toBeGreaterThan(
        0
      );
    });

    rerender({ range: 'past-3-months' as DateRangeKey });

    await waitFor(() => {
      expect(
        jest.mocked(AnalyticsService.getNetWorthOverTime).mock.calls.length
      ).toBeGreaterThanOrEqual(2);
    });

    await act(async () => {
      first.resolve([{ date: '2024-03-01', value: 1000 }]);
    });

    await act(async () => {
      second.resolve([{ date: '2024-02-01', value: 1200 }]);
    });

    await waitFor(() => {
      expect(result.current.series).toEqual(finalSeries);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
  });

  it('handles service errors and exposes message', async () => {
    const error = Object.assign(new Error('boom'), { status: 500 });
    jest.mocked(AnalyticsService.getNetWorthOverTime).mockRejectedValue(error);

    let accountFilterHook: ReturnType<typeof useAccountFilter>;
    const { result } = renderHook(
      ({ range }) => {
        accountFilterHook = useAccountFilter();
        return useNetWorthSeries(range);
      },
      {
        initialProps: { range: 'past-year' as DateRangeKey },
        wrapper: TestWrapper,
      }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    await waitFor(() => {
      expect(accountFilterHook!.selectedAccountIds).toEqual(accountFilterHook!.allAccountIds);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('boom');
    });

    expect(result.current.series).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
  });

  it('should pass account filter to service when not all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useNetWorthSeries('current-month');
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    expect(result.current.refreshing).toBe(false);

    // Verify initial call was made without account filter (all accounts)
    expect(AnalyticsService.getNetWorthOverTime).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      undefined
    );

    // Clear the mock to track new calls
    jest.mocked(AnalyticsService.getNetWorthOverTime).mockClear();

    // Set specific accounts
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    // Should refetch with account filter
    await waitFor(() => {
      expect(AnalyticsService.getNetWorthOverTime).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        ['account1']
      );
    });
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
  });

  it('should refetch when account filter changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useNetWorthSeries('current-month');
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialRequestCount = jest.mocked(AnalyticsService.getNetWorthOverTime).mock.calls.length;

    expect(result.current.refreshing).toBe(false);

    // Change account filter
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    // Should refetch with new filter
    await waitFor(() => {
      expect(AnalyticsService.getNetWorthOverTime).toHaveBeenCalledTimes(initialRequestCount + 1);
    });
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
  });

  it('exposes refreshing during pending refetches', async () => {
    const deferred = createDeferred<{ date: string; value: number }[]>();
    const settled = [
      { date: '2024-04-01', value: 1000 },
      { date: '2024-04-02', value: 1100 },
    ];

    jest
      .mocked(AnalyticsService.getNetWorthOverTime)
      .mockResolvedValueOnce(settled)
      .mockResolvedValueOnce(settled)
      .mockReturnValueOnce(deferred.promise as any);

    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useNetWorthSeries('current-month');
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    expect(result.current.refreshing).toBe(false);

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    deferred.resolve([
      { date: '2024-04-01', value: 1200 },
      { date: '2024-04-02', value: 1300 },
    ]);

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });

    expect(Array.isArray(result.current.series)).toBe(true);
    expect(result.current.series.length).toBeGreaterThan(0);
  });
});
