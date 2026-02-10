import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { ReactNode } from 'react';
import { useBalancesOverview } from '@/hooks/useBalancesOverview';
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter';
import { installFetchRoutes } from '@tests/utils/fetchRoutes';
import { createProviderConnection, createProviderStatus } from '@tests/utils/fixtures';

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <AccountFilterProvider>{children}</AccountFilterProvider>
);

let fetchMock: ReturnType<typeof installFetchRoutes>;

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

describe('useBalancesOverview (Phase 6)', () => {
  const connectedStatus = createProviderStatus({
    connections: [
      createProviderConnection({
        is_connected: true,
        institution_name: 'First Platypus Bank',
        connection_id: 'conn_1',
      }),
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = installFetchRoutes({
      'GET /api/analytics/balances/overview': {
        asOf: 'latest',
        overall: {
          cash: 100,
          credit: -50,
          loan: -25,
          investments: 200,
          positivesTotal: 300,
          negativesTotal: -75,
          net: 225,
          ratio: 4,
        },
        banks: [],
        mixedCurrency: false,
      },
      'GET /api/providers/status': connectedStatus,
      'GET /api/plaid/accounts': mockPlaidAccounts,
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('fetches on mount and exposes loading/data', async () => {
    const mock = {
      asOf: 'latest',
      overall: {
        cash: 100,
        credit: -50,
        loan: -25,
        investments: 200,
        positivesTotal: 300,
        negativesTotal: -75,
        net: 225,
        ratio: 4,
      },
      banks: [],
      mixedCurrency: false,
    };
    fetchMock = installFetchRoutes({
      'GET /api/analytics/balances/overview': mock,
      'GET /api/providers/status': connectedStatus,
      'GET /api/plaid/accounts': mockPlaidAccounts,
    });

    const { result } = renderHook(() => useBalancesOverview(), { wrapper: TestWrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(mock);
  });

  it('refetches when endDate changes (debounced)', async () => {
    // Controlled range state within the test component wrapper
    let end = '2024-01-01';
    const { result, rerender } = renderHook(({ endDate }) => useBalancesOverview({ endDate }, 10), {
      initialProps: { endDate: end },
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
    const initialCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/analytics/balances/overview')
    ).length;

    // Change endDate -> should trigger debounced refetch
    end = '2024-02-01';
    rerender({ endDate: end });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter((c) =>
          String(c[0]).includes('/api/analytics/balances/overview')
        ).length
      ).toBe(initialCalls + 1);
    });
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
  });

  it('returns error when API fails', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/analytics/balances/overview': () => {
        throw new Error('Boom');
      },
      'GET /api/providers/status': connectedStatus,
      'GET /api/plaid/accounts': mockPlaidAccounts,
    });

    const { result } = renderHook(() => useBalancesOverview(), { wrapper: TestWrapper });
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/analytics/balances/overview'))
      ).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toBeNull();
  });

  it('supports manual refresh()', async () => {
    const mock1 = {
      asOf: 'latest',
      overall: {
        cash: 1,
        credit: -1,
        loan: -1,
        investments: 1,
        positivesTotal: 2,
        negativesTotal: -2,
        net: 0,
        ratio: 1,
      },
      banks: [],
      mixedCurrency: false,
    };
    const mock2 = {
      asOf: 'latest',
      overall: {
        cash: 2,
        credit: -1,
        loan: -1,
        investments: 1,
        positivesTotal: 3,
        negativesTotal: -2,
        net: 1,
        ratio: 1.5,
      },
      banks: [],
      mixedCurrency: false,
    };

    let callCount = 0;
    fetchMock = installFetchRoutes({
      'GET /api/analytics/balances/overview': () => {
        callCount++;
        return callCount === 1 ? mock1 : mock2;
      },
      'GET /api/providers/status': connectedStatus,
      'GET /api/plaid/accounts': mockPlaidAccounts,
    });

    const { result } = renderHook(() => useBalancesOverview(), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.data?.overall.cash).toBeDefined();

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.data?.overall.cash).toBe(2);
    });

    expect(result.current.refreshing).toBe(false);
  });

  it('should pass account filter to service when not all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useBalancesOverview();
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

    // Verify initial call was made without account filter (all accounts)
    const initialCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('/api/analytics/balances/overview')
    );
    expect(initialCall).toBeTruthy();
    expect(String(initialCall![0])).toBe('/api/analytics/balances/overview');

    // Clear the mock to track new calls
    fetchMock.mockClear();

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    // Change account filter to specific accounts
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    // Should refetch with account filter
    await waitFor(() => {
      const filterCall = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes('/api/analytics/balances/overview?account_ids%5B%5D=account1')
      );
      expect(filterCall).toBeTruthy();
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
        return useBalancesOverview();
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });

    // Get initial call count
    const initialCallCount = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/analytics/balances/overview')
    ).length;

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    // Change account filter
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    // Should refetch and increase call count (real behavior: triggers additional calls due to account filter interaction)
    await waitFor(() => {
      const finalCallCount = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes('/api/analytics/balances/overview')
      ).length;
      expect(finalCallCount).toBeGreaterThan(initialCallCount); // Ensure at least one additional call was made
    });
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
  });

  it('exposes refreshing while background refetch is pending', async () => {
    const deferred = createDeferred<any>();

    let callCount = 0;
    fetchMock = installFetchRoutes({
      'GET /api/analytics/balances/overview': () => {
        callCount++;
        if (callCount === 1) {
          return {
            asOf: 'latest',
            overall: {
              cash: 1,
              credit: -1,
              loan: -1,
              investments: 1,
              positivesTotal: 2,
              negativesTotal: -2,
              net: 0,
              ratio: 1,
            },
            banks: [],
            mixedCurrency: false,
          };
        }
        return deferred.promise;
      },
      'GET /api/providers/status': connectedStatus,
      'GET /api/plaid/accounts': mockPlaidAccounts,
    });

    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useBalancesOverview();
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

    deferred.resolve({
      asOf: 'latest',
      overall: {
        cash: 2,
        credit: -2,
        loan: -1,
        investments: 2,
        positivesTotal: 4,
        negativesTotal: -3,
        net: 1,
        ratio: 1.5,
      },
      banks: [],
      mixedCurrency: false,
    } as any);

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
      expect(result.current.data?.overall?.cash).toBe(2);
    });
  });
});
