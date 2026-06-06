import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AccountFilterTestProvider } from '@tests/utils/AccountFilterTestProvider';
import { type ReactNode, useState } from 'react';
import { AccountFilterContext } from '@/context/AccountFilterContext';
import { useTransactionCategories } from '@/features/transactions/hooks/useTransactionCategories';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter';
import { PlaidService } from '@/services/PlaidService';
import { TransactionService } from '@/services/TransactionService';
import { setSessionTransactionsPage } from '@/utils/sessionPreferences';

jest.mock('@/services/TransactionService', () => ({
  TransactionService: {
    getTransactions: jest.fn(),
    getTransactionCategories: jest.fn(),
  },
}));

jest.mock('@/services/PlaidService', () => ({
  PlaidService: {
    getAccounts: jest.fn(),
    getStatus: jest.fn(),
  },
}));

jest.mock('@/features/transactions/hooks/useTransactionCategories', () => ({
  useTransactionCategories: jest.fn(),
}));

const asTransaction = (id: string, date = '2024-02-10') => ({
  id,
  date,
  name: 'Transaction',
  merchant: 'Store',
  amount: 100,
  category: { primary: 'GROCERIES', detailed: 'GROCERIES' },
  account_name: 'Checking',
  account_type: 'depository',
  account_mask: '1234',
});

const mockPlaidAccounts = [
  {
    id: 'account1',
    name: 'Mock Checking',
    account_type: 'depository',
    balance_ledger: 1200,
    balance_available: 1190,
    balance_current: 1200,
    mask: '1111',
    plaid_connection_id: 'conn_1',
    institution_name: 'Mock Bank',
    provider: 'plaid',
  },
  {
    id: 'account2',
    name: 'Mock Savings',
    account_type: 'depository',
    balance_ledger: 5400,
    balance_available: 5400,
    balance_current: 5400,
    mask: '2222',
    plaid_connection_id: 'conn_1',
    institution_name: 'Mock Bank',
    provider: 'plaid',
  },
];

const TestWrapper = AccountFilterTestProvider;

const stableAccountFilterValue = {
  selectedAccountIds: ['account1', 'account2'],
  allAccountIds: ['account1', 'account2'],
  isAllAccountsSelected: true,
  accountsByBank: {},
  loading: false,
  setSelectedAccountIds: jest.fn(),
  toggleBank: jest.fn(),
  toggleAccount: jest.fn(),
  removeAccountsByIds: jest.fn(),
};

function StableAccountFilterWrapper({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AccountFilterContext.Provider value={stableAccountFilterValue}>
        {children}
      </AccountFilterContext.Provider>
    </QueryClientProvider>
  );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe('useTransactions', () => {
  let sessionStorageData: Record<string, string> = {};

  beforeEach(() => {
    sessionStorageData = {};
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (key: string) => sessionStorageData[key] ?? null,
        setItem: (key: string, value: string) => {
          sessionStorageData[key] = value;
        },
        removeItem: (key: string) => {
          delete sessionStorageData[key];
        },
        clear: () => {
          sessionStorageData = {};
        },
      },
      writable: true,
    });
    jest.clearAllMocks();
    jest.mocked(TransactionService.getTransactions).mockResolvedValue({
      transactions: [],
      total: 0,
      page: 1,
      page_size: 10,
    } as any);
    jest.mocked(TransactionService.getTransactionCategories).mockResolvedValue([]);
    jest.mocked(PlaidService.getAccounts).mockResolvedValue(mockPlaidAccounts as any);
    jest.mocked(PlaidService.getStatus).mockResolvedValue({
      is_connected: true,
      institution_name: 'First Platypus Bank',
      connection_id: 'conn_1',
    } as any);
    jest.mocked(useTransactionCategories).mockReturnValue({
      categories: [],
      loading: false,
    });
  });

  it('remounting serves cached transactions immediately without extra getTransactions while fresh', async () => {
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

    jest.mocked(TransactionService.getTransactions).mockImplementation(
      async () =>
        ({
          transactions: [asTransaction('t1'), asTransaction('t2')],
          total: 4,
          page: 1,
          page_size: 10,
        }) as any
    );
    jest
      .mocked(TransactionService.getTransactionCategories)
      .mockResolvedValue(['FOOD_AND_DRINK', 'TRANSPORTATION']);
    jest.mocked(useTransactionCategories).mockReturnValue({
      categories: ['FOOD_AND_DRINK', 'TRANSPORTATION'],
      loading: false,
    });

    const { result, unmount } = renderHook(() => useTransactions({ pageSize: 10 }), {
      wrapper: RemountWrapper,
    });

    await waitFor(() => {
      expect(result.current.transactions).toHaveLength(2);
    });
    await waitFor(() => {
      expect(result.current.categories).toEqual(['FOOD_AND_DRINK', 'TRANSPORTATION']);
    });

    const callCount = jest.mocked(TransactionService.getTransactions).mock.calls.length;
    const txIds = result.current.transactions.map((t) => t.id);

    unmount();

    const { result: next } = renderHook(() => useTransactions({ pageSize: 10 }), {
      wrapper: RemountWrapper,
    });

    await waitFor(() => {
      expect(next.current.isLoading).toBe(false);
      expect(next.current.transactions.map((t) => t.id)).toEqual(txIds);
      expect(next.current.categories).toEqual(['FOOD_AND_DRINK', 'TRANSPORTATION']);
    });

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(jest.mocked(TransactionService.getTransactions).mock.calls.length).toBe(callCount);
    });
  });

  it('maps a failed getTransactions to a user-facing error', async () => {
    jest.mocked(TransactionService.getTransactions).mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useTransactions({ pageSize: 10 }), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load transactions.');
    });
    expect(result.current.transactions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('maps 401 from getTransactions to an auth message', async () => {
    jest.mocked(TransactionService.getTransactions).mockRejectedValue({ status: 401 });

    const { result } = renderHook(() => useTransactions({ pageSize: 10 }), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.error).toBe('You are not authenticated. Please log in again.');
    });
  });

  it('loads categories and the first server page on mount', async () => {
    jest.mocked(TransactionService.getTransactions).mockImplementation(
      async () =>
        ({
          transactions: [asTransaction('t1'), asTransaction('t2')],
          total: 4,
          page: 1,
          page_size: 10,
        }) as any
    );
    jest
      .mocked(TransactionService.getTransactionCategories)
      .mockResolvedValue(['FOOD_AND_DRINK', 'TRANSPORTATION']);
    jest.mocked(useTransactionCategories).mockReturnValue({
      categories: ['FOOD_AND_DRINK', 'TRANSPORTATION'],
      loading: false,
    });

    const { result } = renderHook(
      () => {
        return useTransactions({ pageSize: 10 });
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(result.current.categories).toEqual(['FOOD_AND_DRINK', 'TRANSPORTATION']);
      expect(result.current.transactions).toHaveLength(2);
      expect(result.current.totalItems).toBe(4);
    });

    expect(TransactionService.getTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        page_size: 10,
      })
    );
    expect(result.current.totalPages).toBe(1);
  });

  it('restores the saved page on mount without resetting to page one', async () => {
    setSessionTransactionsPage(3);

    jest.mocked(TransactionService.getTransactions).mockImplementation(async (filters?: any) => {
      const page = filters?.page ?? 1;
      return {
        transactions: [asTransaction(`t${page}`)],
        total: 25,
        page,
        page_size: 10,
      } as any;
    });

    const { result } = renderHook(() => useTransactions({ pageSize: 10 }), {
      wrapper: StableAccountFilterWrapper,
    });

    await waitFor(() => {
      expect(result.current.currentPage).toBe(3);
      expect(TransactionService.getTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 3,
          page_size: 10,
        })
      );
    });
  });

  it('fetches the next server page when currentPage changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    jest.mocked(TransactionService.getTransactions).mockImplementation(async (filters?: any) => {
      if (filters?.page === 2) {
        return {
          transactions: Array.from({ length: 5 }, (_, i) => asTransaction(`t${i + 11}`)),
          total: 15,
          page: 2,
          page_size: 10,
        } as any;
      }

      return {
        transactions: Array.from({ length: 10 }, (_, i) => asTransaction(`t${i + 1}`)),
        total: 15,
        page: 1,
        page_size: 10,
      } as any;
    });

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useTransactions({ pageSize: 10 });
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    jest.mocked(TransactionService.getTransactions).mockClear();

    await act(async () => {
      result.current.setCurrentPage(2);
    });

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 2,
          page_size: 10,
        })
      );
    });
    expect(result.current.currentPage).toBe(2);
    expect(result.current.transactions).toHaveLength(5);
    expect(result.current.totalPages).toBe(2);
  });

  it('keeps the latest page when an older request resolves after a newer one', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;
    const firstPage = createDeferred<any>();
    const secondPage = createDeferred<any>();

    jest.mocked(TransactionService.getTransactions).mockImplementation(async (filters?: any) => {
      if (filters?.page === 2) {
        return secondPage.promise;
      }

      return firstPage.promise;
    });

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useTransactions({ pageSize: 10 });
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    await act(async () => {
      result.current.setCurrentPage(2);
    });

    await act(async () => {
      secondPage.resolve({
        transactions: Array.from({ length: 5 }, (_, i) => asTransaction(`t${i + 11}`)),
        total: 15,
        page: 2,
        page_size: 10,
      });
    });

    await waitFor(() => {
      expect(result.current.currentPage).toBe(2);
      expect(result.current.transactions[0].id).toBe('t11');
    });

    await act(async () => {
      firstPage.resolve({
        transactions: Array.from({ length: 10 }, (_, i) => asTransaction(`t${i + 1}`)),
        total: 15,
        page: 1,
        page_size: 10,
      });
    });

    await waitFor(() => {
      expect(result.current.currentPage).toBe(2);
      expect(result.current.transactions[0].id).toBe('t11');
      expect(result.current.transactions).toHaveLength(5);
    });
  });

  it('refetches from page one when search changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    jest.mocked(TransactionService.getTransactions).mockImplementation(async (filters?: any) => {
      if (filters?.search === 'coffee') {
        return {
          transactions: [asTransaction('t2')],
          total: 1,
          page: 1,
          page_size: 10,
        } as any;
      }

      return {
        transactions: [asTransaction('t1')],
        total: 12,
        page: 1,
        page_size: 10,
      } as any;
    });

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useTransactions({ pageSize: 10 });
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    jest.mocked(TransactionService.getTransactions).mockClear();

    await act(async () => {
      result.current.setCurrentPage(2);
    });

    await act(async () => {
      result.current.setSearch('coffee');
    });

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          search: 'coffee',
        })
      );
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('refetches from page one when category changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    jest.mocked(TransactionService.getTransactions).mockImplementation(async (filters?: any) => {
      if (filters?.categoryPrimary === 'FOOD_AND_DRINK') {
        return {
          transactions: [asTransaction('t2')],
          total: 1,
          page: 1,
          page_size: 10,
        } as any;
      }

      return {
        transactions: [asTransaction('t1')],
        total: 12,
        page: 1,
        page_size: 10,
      } as any;
    });

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useTransactions({ pageSize: 10 });
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    jest.mocked(TransactionService.getTransactions).mockClear();

    await act(async () => {
      result.current.setCurrentPage(2);
    });

    await act(async () => {
      result.current.setSelectedCategory('FOOD_AND_DRINK');
    });

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          categoryPrimary: 'FOOD_AND_DRINK',
        })
      );
    });
    expect(result.current.currentPage).toBe(1);
  });

  it('updates tableAnimationKey when category changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useTransactions({ pageSize: 10 });
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    const initialKey = result.current.tableAnimationKey;

    await act(async () => {
      result.current.setSelectedCategory('FOOD_AND_DRINK');
    });

    await waitFor(() => {
      expect(result.current.tableAnimationKey).not.toBe(initialKey);
      expect(result.current.tableAnimationKey).toContain('FOOD_AND_DRINK');
    });
  });

  it('should pass account filter to service when not all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    jest.mocked(TransactionService.getTransactions).mockImplementation(async (filters?: any) => {
      if (filters?.accountIds?.includes('account1')) {
        return {
          transactions: [asTransaction('t2')],
          total: 1,
          page: 1,
          page_size: 10,
        } as any;
      }

      return {
        transactions: [asTransaction('t1')],
        total: 1,
        page: 1,
        page_size: 10,
      } as any;
    });

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useTransactions({ pageSize: 10 });
      },
      { wrapper: TestWrapper }
    );

    jest.mocked(TransactionService.getTransactions).mockClear();

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          accountIds: ['account1'],
        })
      );
    });

    expect(result.current.currentPage).toBe(1);
  });
});
