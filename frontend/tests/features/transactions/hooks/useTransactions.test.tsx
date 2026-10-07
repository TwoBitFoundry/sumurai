import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter';
import { PlaidService } from '@/services/PlaidService';
import { TransactionService } from '@/services/TransactionService';

jest.mock('@/services/TransactionService', () => ({
  TransactionService: {
    getTransactions: jest.fn(),
  },
}));

jest.mock('@/services/PlaidService', () => ({
  PlaidService: {
    getAccounts: jest.fn(),
    getStatus: jest.fn(),
  },
}));

const asTransaction = (id: string, date = '2026-09-10') => ({
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

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <AccountFilterProvider>{children}</AccountFilterProvider>
);

describe('useTransactions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(TransactionService.getTransactions).mockResolvedValue([]);
    jest.mocked(PlaidService.getAccounts).mockResolvedValue(mockPlaidAccounts as any);
    jest.mocked(PlaidService.getStatus).mockResolvedValue({
      is_connected: true,
      institution_name: 'First Platypus Bank',
      connection_id: 'conn_1',
    } as any);
  });

  it('should refetch transactions when account filter changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    // Mock transactions response
    jest
      .mocked(TransactionService.getTransactions)
      .mockResolvedValue([asTransaction('t1'), asTransaction('t2')] as any);

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useTransactions();
      },
      { wrapper: TestWrapper }
    );

    // Wait for initial load
    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledTimes(1);
    });

    // Verify initial call was made without account filter (all accounts)
    expect(TransactionService.getTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({})
    );

    // Clear the mock to track new calls
    jest.mocked(TransactionService.getTransactions).mockClear();

    // Change account filter to specific accounts
    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    // Should refetch with account filter
    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          accountIds: ['account1'],
        })
      );
    });
  });

  it('should reset pagination when account filter changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    // Mock a large set of transactions
    const testPeriod = { month: 8, year: 2026 };
    const transactions = Array.from({ length: 25 }, (_, i) => asTransaction(`t${i + 1}`));
    jest.mocked(TransactionService.getTransactions).mockResolvedValue(transactions as any);

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useTransactions({ pageSize: 10, period: testPeriod });
      },
      { wrapper: TestWrapper }
    );

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.transactions).toHaveLength(25);
    });

    // Navigate to page 2
    await act(async () => {
      result.current.setCurrentPage(2);
    });

    expect(result.current.currentPage).toBe(2);

    // Change account filter
    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1']);
    });

    // Pagination should reset to page 1
    await waitFor(() => {
      expect(result.current.currentPage).toBe(1);
    });
  });

  it('should pass account filter to service when not all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    jest.mocked(TransactionService.getTransactions).mockResolvedValue([asTransaction('t1')] as any);

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useTransactions();
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledTimes(1);
    });

    // Clear mock and set specific accounts
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
  });

  it('should pass the local account filter to the service when selected', async () => {
    jest.mocked(TransactionService.getTransactions).mockResolvedValue([asTransaction('t1')] as any);

    const { result } = renderHook(() => useTransactions({ initialAccountId: 'account2' }), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          accountIds: ['account2'],
        })
      );
    });

    jest.mocked(TransactionService.getTransactions).mockClear();

    await act(async () => {
      result.current.setSelectedAccountId('account1');
    });

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          accountIds: ['account1'],
        })
      );
    });
  });

  it('should expose account options for the transaction account selector', async () => {
    jest.mocked(PlaidService.getAccounts).mockResolvedValueOnce([
      ...mockPlaidAccounts,
      {
        id: 'manual-investment',
        name: 'Brokerage',
        account_type: 'investment',
        balance_current: 10000,
        mask: null,
        institution_name: 'Robinhood',
        provider: 'teller',
        provider_account_id: null,
        provider_connection_id: null,
      },
      {
        id: 'manual-property',
        name: 'Primary Home',
        account_type: 'property',
        balance_current: 850000,
        mask: null,
        institution_name: 'Home',
        provider: 'teller',
        provider_account_id: null,
        provider_connection_id: null,
      },
    ] as any);

    const { result } = renderHook(() => useTransactions(), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.accountOptions.map((account) => account.id)).toEqual([
        'account1',
        'account2',
      ]);
    });
  });

  it('should include MD DIR ACH education rule matches in selected category results', async () => {
    jest.mocked(TransactionService.getTransactions).mockResolvedValue([
      {
        ...asTransaction('education-spend', '2024-02-10'),
        merchant: 'GERMANTOWN FACTS',
        amount: 1177.5,
        category: { primary: 'EDUCATION', detailed: 'EDUCATION' },
      },
      {
        ...asTransaction('education-transfer', '2024-02-11'),
        name: 'MD DIR ACH CONTRIB 060926',
        merchant: 'MD DIR ACH CONTRIB 060926',
        amount: 100,
        category: { primary: 'EDUCATION', detailed: 'EDUCATION' },
      },
    ] as any);

    const { result } = renderHook(
      () =>
        useTransactions({
          period: { year: 2024, month: 1 },
        }),
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(result.current.categories).toEqual(['Education']);
    });

    await act(async () => {
      result.current.setSelectedCategory('Education');
    });

    await waitFor(() => {
      expect(result.current.transactions.map((transaction) => transaction.id)).toEqual([
        'education-transfer',
        'education-spend',
      ]);
    });

    expect(result.current.categories).toEqual(['Education']);
  });

  it('should not pass account filter when all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    jest.mocked(TransactionService.getTransactions).mockResolvedValue([asTransaction('t1')] as any);

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useTransactions();
      },
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2']);
    });

    // Clear mock and select a subset first
    jest.mocked(TransactionService.getTransactions).mockClear();

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

    jest.mocked(TransactionService.getTransactions).mockClear();

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds([...accountFilterHook!.allAccountIds]);
    });

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledWith(expect.objectContaining({}));
    });
  });

  it('should auto-filter duplicate candidate pending transactions when posted match exists', async () => {
    jest.mocked(TransactionService.getTransactions).mockResolvedValue([
      {
        ...asTransaction('posted-1', '2026-09-17'),
        account_id: 'acc_1',
        amount: 12.71,
        name: 'AMAZON MKTPL*5R7VQ2VS1',
        merchant: 'AMAZON MKTPL*5R7VQ2VS1',
        pending: false,
      },
      {
        ...asTransaction('pending-1', '2026-09-16'),
        account_id: 'acc_1',
        amount: 12.71,
        name: 'AMAZON MKTPLACE PMTS',
        merchant: 'AMAZON MKTPLACE PMTS',
        pending: true,
      },
      {
        ...asTransaction('pending-alone', '2026-09-18'),
        account_id: 'acc_1',
        amount: 18.69,
        name: 'ExxonMobil',
        merchant: 'ExxonMobil',
        pending: true,
      },
    ] as any);

    const { result } = renderHook(
      () =>
        useTransactions({
          period: { year: 2026, month: 8 },
        }),
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(result.current.transactions.map((t) => t.id)).toEqual(['pending-alone', 'posted-1']);
      expect(result.current.duplicateCandidateIds).toEqual(['pending-1']);
    });
  });
});
