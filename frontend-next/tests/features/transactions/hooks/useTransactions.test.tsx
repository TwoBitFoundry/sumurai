import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { TransactionService } from '@/services/TransactionService';
import { PlaidService } from '@/services/PlaidService';
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter';

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
    expect(TransactionService.getTransactions).toHaveBeenLastCalledWith({});

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
      expect(TransactionService.getTransactions).toHaveBeenCalledWith({
        accountIds: ['account1'],
      });
    });
  });

  it('should reset pagination when account filter changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>;

    // Mock a large set of transactions
    const transactions = Array.from({ length: 25 }, (_, i) => asTransaction(`t${i + 1}`));
    jest.mocked(TransactionService.getTransactions).mockResolvedValue(transactions as any);

    const { result } = renderHook(
      () => {
        accountFilterHook = useAccountFilter();
        return useTransactions({ pageSize: 10 });
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
      expect(TransactionService.getTransactions).toHaveBeenCalledWith({
        accountIds: ['account1'],
      });
    });
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
      expect(TransactionService.getTransactions).toHaveBeenCalledWith({
        accountIds: ['account1'],
      });
    });

    jest.mocked(TransactionService.getTransactions).mockClear();

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds([...accountFilterHook!.allAccountIds]);
    });

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledWith({});
    });
  });
});
