import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { AccountFilterTestProvider } from '@tests/utils/AccountFilterTestProvider';
import { useSankey } from '@/features/analytics/hooks/useSankey';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { AnalyticsService } from '@/services/AnalyticsService';
import { PlaidService } from '@/services/PlaidService';
import { ProviderCatalog } from '@/services/ProviderCatalog';
import type { DateRangeKey } from '@/utils/dateRanges';
import * as dateRanges from '@/utils/dateRanges';

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    getSankey: jest.fn(),
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

describe('useSankey', () => {
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
    jest.mocked(AnalyticsService.getSankey).mockResolvedValue({
      nodes: [{ id: 'income', label: 'Income', kind: 'Income' }],
      links: [],
      currency: 'USD',
      summary: {
        income: 500,
        expenses: 200,
        covered: 200,
        deficit: 0,
        surplus: 300,
        coverage_ratio: 1,
      },
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

  it('keeps prior sankey data visible while the next range loads', async () => {
    const deferred = createDeferred<any>();

    jest
      .mocked(AnalyticsService.getSankey)
      .mockResolvedValueOnce({
        nodes: [{ id: 'income', label: 'Income', kind: 'Income' }],
        links: [],
        currency: 'USD',
        summary: {
          income: 500,
          expenses: 200,
          covered: 200,
          deficit: 0,
          surplus: 300,
          coverage_ratio: 1,
        },
      } as any)
      .mockReturnValueOnce(deferred.promise);

    const { result, rerender } = renderHook(({ range }) => useSankey(range), {
      initialProps: { range: 'current-month' as DateRangeKey },
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.currency).toBe('USD');

    rerender({ range: 'past-3-months' as DateRangeKey });

    await waitFor(() => {
      expect(result.current.refreshing).toBe(true);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data?.summary.income).toBe(500);

    await act(async () => {
      deferred.resolve({
        nodes: [{ id: 'expenses', label: 'Expenses', kind: 'Expenses' }],
        links: [],
        currency: 'USD',
        summary: {
          income: 700,
          expenses: 150,
          covered: 150,
          deficit: 0,
          surplus: 550,
          coverage_ratio: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });

    expect(result.current.data?.summary.income).toBe(700);
  });

  it('keeps prior sankey data visible while the next account filter loads', async () => {
    const deferred = createDeferred<any>();

    jest
      .mocked(AnalyticsService.getSankey)
      .mockResolvedValueOnce({
        nodes: [{ id: 'income', label: 'Income', kind: 'Income' }],
        links: [],
        currency: 'USD',
        summary: {
          income: 500,
          expenses: 200,
          covered: 200,
          deficit: 0,
          surplus: 300,
          coverage_ratio: 1,
        },
      } as any)
      .mockReturnValueOnce(deferred.promise);

    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useSankey('current-month');
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
    expect(result.current.data?.summary.income).toBe(500);
    expect(AnalyticsService.getSankey).toHaveBeenLastCalledWith('2026-04-01', '2026-05-31', [
      'account1',
    ]);

    await act(async () => {
      deferred.resolve({
        nodes: [{ id: 'surplus', label: 'Surplus', kind: 'Surplus' }],
        links: [],
        currency: 'USD',
        summary: {
          income: 400,
          expenses: 250,
          covered: 250,
          deficit: 0,
          surplus: 150,
          coverage_ratio: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });

    expect(result.current.data?.summary.income).toBe(400);
  });
});
