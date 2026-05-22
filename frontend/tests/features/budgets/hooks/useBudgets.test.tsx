import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AccountFilterTestProvider } from '@tests/utils/AccountFilterTestProvider';
import { installFetchRoutes } from '@tests/utils/fetchRoutes';
import { createProviderConnection, createProviderStatus } from '@tests/utils/fixtures';
import type { ReactNode } from 'react';
import { useBudgets } from '@/features/budgets/hooks/useBudgets';
import { useCategories } from '@/features/transactions/hooks/useCategories';
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter';
import { BudgetService } from '@/services/BudgetService';
import { TransactionService } from '@/services/TransactionService';

jest.mock('@/features/transactions/hooks/useCategories', () => ({
  useCategories: jest.fn(),
}));

const useCategoriesMock = jest.mocked(useCategories);

const TestWrapper = AccountFilterTestProvider;

const defaultCategoriesMock = {
  system: ['FOOD_AND_DRINK', 'ENTERTAINMENT', 'TRANSPORTATION'],
  custom: [{ id: 'custom-1', display_name: 'Coffee', lookup_key: 'coffee' }],
  all: ['Coffee', 'ENTERTAINMENT', 'FOOD_AND_DRINK', 'TRANSPORTATION'],
  accentIndexByName: new Map([
    ['Coffee', 0],
    ['ENTERTAINMENT', 1],
    ['FOOD_AND_DRINK', 2],
    ['TRANSPORTATION', 3],
  ]),
  isLoading: false,
  error: null,
};

let fetchMock: ReturnType<typeof installFetchRoutes>;

const asBudget = (id: string, category: string, amount: number) => ({ id, category, amount });
const asTransaction = (id: string, categoryId: string, amount: number, date?: string) => {
  // Use a deterministic date in the middle of current month to avoid timing issues
  const today = new Date();
  const defaultDate = new Date(today.getFullYear(), today.getMonth(), 15)
    .toISOString()
    .slice(0, 10);

  return {
    id,
    date: date || defaultDate,
    name: 'Txn',
    merchant: 'Store',
    amount,
    category: { primary: categoryId.toUpperCase(), detailed: categoryId.toUpperCase() },
    provider: 'plaid' as const,
    account_name: 'Checking',
    account_type: 'depository',
    account_mask: '1234',
  };
};

const mockPlaidAccounts = [
  {
    id: 'account1',
    name: 'Mock Checking',
    account_type: 'depository',
    balance_ledger: 1200,
    balance_available: 1180,
    balance_current: 1200,
    mask: '1111',
    plaid_connection_id: 'conn_1',
    institution_name: 'Mock Bank',
    provider: 'plaid',
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

describe('useBudgets', () => {
  const createConnectedStatus = () =>
    createProviderStatus({
      connections: [
        createProviderConnection({
          is_connected: true,
          institution_name: 'Mock Bank',
          connection_id: 'conn_1',
        }),
      ],
    });

  beforeEach(() => {
    jest.clearAllMocks();
    useCategoriesMock.mockReturnValue(defaultCategoriesMock);
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [],
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('includes system and custom categories in categoryOptions without month transactions', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [],
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    });

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.categoryOptions).toEqual([
        'Coffee',
        'ENTERTAINMENT',
        'FOOD_AND_DRINK',
        'TRANSPORTATION',
      ]);
      expect(result.current.availableCategoryOptions).toEqual([
        'Coffee',
        'ENTERTAINMENT',
        'FOOD_AND_DRINK',
        'TRANSPORTATION',
      ]);
    });
  });

  it('excludes categories that already have budgets from availableCategoryOptions', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [asBudget('1', 'FOOD_AND_DRINK', 100)],
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    });

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.availableCategoryOptions).not.toContain('FOOD_AND_DRINK');
      expect(result.current.availableCategoryOptions).toContain('Coffee');
    });
  });

  it('fetches budgets and transactions on mount', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [asBudget('1', 'groceries', 100)],
      'GET /api/transactions': [asTransaction('t1', 'groceries', -50)],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    });

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper });

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1);
    });

    expect(result.current.budgets[0].category).toBe('groceries');
    expect(result.current.budgets[0].amount).toBe(100);
  });

  it('loads transactions based on budget categories', async () => {
    let accountFilterHook: any;

    fetchMock = installFetchRoutes({
      'GET /api/budgets': [asBudget('1', 'groceries', 100)],
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    });

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useBudgets();
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(accountFilterHook.allAccountIds).toEqual(['account1']);
    });

    // Set selected accounts to trigger transaction loading
    await act(async () => {
      accountFilterHook.setSelectedAccountIds(['account1']);
    });

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1);
    });

    // Check that transactions endpoint was called with category filter
    const transactionCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('/api/transactions')
    );
    expect(transactionCall).toBeTruthy();
  });

  it('creates budget optimistically', async () => {
    const budgetsStore: ReturnType<typeof asBudget>[] = [];
    fetchMock = installFetchRoutes({
      'GET /api/budgets': () => budgetsStore,
      'POST /api/budgets': () => {
        const created = asBudget('server-1', 'groceries', 200);
        budgetsStore.push(created);
        return created;
      },
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    });

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.add('groceries', 200);
    });

    expect(result.current.budgets).toHaveLength(1);
    expect(result.current.budgets[0].category).toBe('groceries');
    expect(result.current.budgets[0].amount).toBe(200);
  });

  it('handles create budget failure', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [],
      'POST /api/budgets': () => new Response('fail', { status: 500 }),
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    });

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper });

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      try {
        await result.current.add('groceries', 200);
      } catch {
        // Expected to fail
      }
    });

    expect(result.current.budgets).toHaveLength(0);
  });

  it('updates budget optimistically', async () => {
    const budgetsStore = [asBudget('1', 'groceries', 100)];
    const getBudgetsSpy = jest.spyOn(BudgetService, 'getBudgets').mockImplementation(async () => {
      return [...budgetsStore];
    });
    const updateBudgetSpy = jest
      .spyOn(BudgetService, 'updateBudget')
      .mockImplementation(async (_id, budgetData) => {
        budgetsStore[0] = asBudget('1', 'groceries', budgetData.amount ?? 100);
        return budgetsStore[0];
      });
    const getTransactionsSpy = jest
      .spyOn(TransactionService, 'getTransactions')
      .mockResolvedValue([]);

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper });

    try {
      await waitFor(() => {
        expect(result.current.budgets).toHaveLength(1);
      });

      await act(async () => {
        await result.current.update('1', 250);
      });

      await waitFor(() => {
        expect(result.current.budgets[0].amount).toBe(250);
      });
    } finally {
      getBudgetsSpy.mockRestore();
      updateBudgetSpy.mockRestore();
      getTransactionsSpy.mockRestore();
    }
  });

  it('handles update budget failure', async () => {
    const budgetsStore = [asBudget('1', 'groceries', 100)];
    fetchMock = installFetchRoutes({
      'GET /api/budgets': () => budgetsStore,
      'PUT /api/budgets/1': () => {
        throw Object.assign(new Error('fail'), { status: 500 });
      },
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    });

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper });

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1);
    });

    await act(async () => {
      await result.current.update('1', 250);
    });

    expect(result.current.budgets[0].amount).toBe(100);
  });

  it('deletes budget optimistically', async () => {
    const budgetsStore = [asBudget('1', 'groceries', 100)];
    fetchMock = installFetchRoutes({
      'GET /api/budgets': () => budgetsStore,
      'DELETE /api/budgets/1': () => {
        budgetsStore.length = 0;
        return new Response(null, { status: 204 });
      },
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    });

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper });

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1);
    });

    await act(async () => {
      await result.current.remove('1');
    });

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(0);
    });
  });

  it('handles delete budget failure', async () => {
    const budgetsStore = [asBudget('1', 'groceries', 100)];
    fetchMock = installFetchRoutes({
      'GET /api/budgets': () => budgetsStore,
      'DELETE /api/budgets/1': () => {
        throw Object.assign(new Error('fail'), { status: 500 });
      },
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    });

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper });

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1);
    });

    await act(async () => {
      await result.current.remove('1');
    });

    expect(result.current.budgets).toHaveLength(1);
  });

  it('remounting shows cached budgets without extra budget fetches while fresh', async () => {
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

    fetchMock = installFetchRoutes({
      'GET /api/budgets': [asBudget('1', 'groceries', 100)],
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    });

    const { result, unmount } = renderHook(() => useBudgets(), { wrapper: RemountWrapper });

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1);
    });

    const budgetFetchCount = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/budgets')
    ).length;

    unmount();

    const { result: next } = renderHook(() => useBudgets(), { wrapper: RemountWrapper });

    await waitFor(() => {
      expect(next.current.isLoading).toBe(false);
      expect(next.current.budgets).toHaveLength(1);
      expect(next.current.budgets[0].id).toBe('1');
    });

    const budgetFetchCountAfter = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/budgets')
    ).length;
    expect(budgetFetchCountAfter).toBe(budgetFetchCount);
  });

  it('changing month refetches transactions but not budgets while budgets stay fresh', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [asBudget('1', 'groceries', 100)],
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    });

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper });

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1);
    });

    const budgetFetchCount = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/budgets')
    ).length;
    const transactionFetchCount = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/transactions')
    ).length;

    await act(() => {
      result.current.goToNextMonth();
    });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/transactions')).length
      ).toBeGreaterThan(transactionFetchCount);
    });

    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/budgets')).length).toBe(
      budgetFetchCount
    );
  });
});
