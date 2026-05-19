import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { AccountFilterTestProvider } from '@tests/utils/AccountFilterTestProvider';
import { installFetchRoutes } from '@tests/utils/fetchRoutes';
import { createProviderConnection, createProviderStatus } from '@tests/utils/fixtures';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { useBalancesOverview } from '@/hooks/useBalancesOverview';
import { dispatchAccountsChanged } from '@/utils/events';

const TestWrapper = AccountFilterTestProvider;

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

describe('useBalancesOverview', () => {
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

  it('refetches balances when the linked account roster grows', async () => {
    let accounts = mockPlaidAccounts;
    const overview = {
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
      'GET /api/analytics/balances/overview': overview,
      'GET /api/providers/status': connectedStatus,
      'GET /api/providers/accounts': () => accounts,
      'GET /api/plaid/accounts': () => accounts,
    });

    const { result } = renderHook(() => useBalancesOverview(), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialOverviewCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/analytics/balances/overview')
    ).length;

    accounts = [
      ...mockPlaidAccounts,
      {
        id: 'account3',
        name: 'Mock Credit',
        account_type: 'credit',
        balance_current: -400,
        mask: '3333',
        plaid_connection_id: 'conn_2',
        institution_name: 'Second Mock Bank',
      },
    ];

    await act(async () => {
      dispatchAccountsChanged();
    });

    await waitFor(() => {
      const overviewCalls = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes('/api/analytics/balances/overview')
      ).length;
      expect(overviewCalls).toBeGreaterThan(initialOverviewCalls);
    });
  });

  it('reuses cached overview data on rerender with the same inputs', async () => {
    const { result, rerender } = renderHook(() => useBalancesOverview(), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/analytics/balances/overview')
    ).length;

    rerender();

    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/analytics/balances/overview'))
        .length
    ).toBe(initialCalls);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
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
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    await waitFor(() => {
      expect(result.current.data?.overall?.cash).toBe(1);
    });

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter((c) =>
          String(c[0]).includes('/api/analytics/balances/overview')
        ).length
      ).toBe(2);
    });

    await act(async () => {
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
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
    });
  });
});
