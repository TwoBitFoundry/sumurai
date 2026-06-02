import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { AccountFilterTestProvider } from '@tests/utils/AccountFilterTestProvider';
import { useCashFlow } from '@/features/analytics/hooks/useCashFlow';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { AnalyticsService } from '@/services/AnalyticsService';
import { PlaidService } from '@/services/PlaidService';
import { ProviderCatalog } from '@/services/ProviderCatalog';
import type { DateRangeKey } from '@/utils/dateRanges';
import * as dateRanges from '@/utils/dateRanges';

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    getCashFlow: jest.fn(),
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

const expectSeriesToInclude = (
  series: Array<{ month: string; income: number; expenses: number; net: number }>,
  points: Array<{ month: string; income: number; expenses: number; net: number }>
) => {
  for (const point of points) {
    expect(series).toContainEqual(point);
  }
};

describe('useCashFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(dateRanges, 'computeDateRange').mockImplementation((key) => {
      switch (key) {
        case 'current-month':
          return { start: '2026-04-01', end: '2026-05-31' };
        case 'past-3-months':
          return { start: '2026-02-01', end: '2026-05-31' };
        default:
          return {};
      }
    });
    jest.mocked(AnalyticsService.getCashFlow).mockResolvedValue({
      series: [
        { month: '2026-04', income: 800, expenses: 200, net: 600 },
        { month: '2026-05', income: 900, expenses: 250, net: 650 },
      ],
    } as any);
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

  it('keeps prior series visible while the next range loads', async () => {
    const deferred = createDeferred<any>();

    jest
      .mocked(AnalyticsService.getCashFlow)
      .mockResolvedValueOnce({
        series: [
          { month: '2026-04', income: 800, expenses: 200, net: 600 },
          { month: '2026-05', income: 900, expenses: 250, net: 650 },
        ],
      } as any)
      .mockReturnValueOnce(deferred.promise);

    const { result, rerender } = renderHook(({ range }) => useCashFlow(6, range), {
      initialProps: { range: 'current-month' as DateRangeKey },
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expectSeriesToInclude(result.current.series, [
      { month: '2026-04', income: 800, expenses: 200, net: 600 },
      { month: '2026-05', income: 900, expenses: 250, net: 650 },
    ]);

    rerender({ range: 'past-3-months' as DateRangeKey });

    await waitFor(() => {
      expect(result.current.refreshing).toBe(true);
    });

    expect(result.current.loading).toBe(false);
    expectSeriesToInclude(result.current.series, [
      { month: '2026-04', income: 800, expenses: 200, net: 600 },
      { month: '2026-05', income: 900, expenses: 250, net: 650 },
    ]);

    await act(async () => {
      deferred.resolve({
        series: [
          { month: '2026-03', income: 700, expenses: 150, net: 550 },
          { month: '2026-04', income: 800, expenses: 200, net: 600 },
          { month: '2026-05', income: 900, expenses: 250, net: 650 },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });

    expectSeriesToInclude(result.current.series, [
      { month: '2026-03', income: 700, expenses: 150, net: 550 },
      { month: '2026-04', income: 800, expenses: 200, net: 600 },
      { month: '2026-05', income: 900, expenses: 250, net: 650 },
    ]);
  });

  it('keeps prior series visible while the next account filter loads', async () => {
    const deferred = createDeferred<any>();

    jest
      .mocked(AnalyticsService.getCashFlow)
      .mockResolvedValueOnce({
        series: [{ month: '2026-05', income: 900, expenses: 250, net: 650 }],
      } as any)
      .mockReturnValueOnce(deferred.promise);

    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useCashFlow(6, 'current-month');
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    await waitFor(() => {
      expect(result.current.refreshing).toBe(true);
    });

    expect(result.current.loading).toBe(false);
    expectSeriesToInclude(result.current.series, [
      { month: '2026-05', income: 900, expenses: 250, net: 650 },
    ]);
    expect(AnalyticsService.getCashFlow).toHaveBeenLastCalledWith(3, ['account1']);

    await act(async () => {
      deferred.resolve({
        series: [{ month: '2026-05', income: 400, expenses: 250, net: 150 }],
      });
    });

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });

    expectSeriesToInclude(result.current.series, [
      { month: '2026-05', income: 400, expenses: 250, net: 150 },
    ]);
  });
});
