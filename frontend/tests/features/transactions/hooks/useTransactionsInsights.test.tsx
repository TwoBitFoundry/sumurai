import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { useTransactionsInsights } from '@/features/transactions/hooks/useTransactionsInsights';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { TransactionService } from '@/services/TransactionService';

jest.mock('@/hooks/useAccountFilter', () => ({
  useAccountFilter: jest.fn(),
}));

jest.mock('@/services/TransactionService', () => ({
  TransactionService: {
    getTransactionsInsights: jest.fn(),
  },
}));

describe('useTransactionsInsights', () => {
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

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAccountFilter).mockReturnValue({
      selectedAccountIds: ['account1'],
      allAccountIds: ['account1', 'account2'],
      isAllAccountsSelected: false,
      accountsByBank: {},
      loading: false,
      setSelectedAccountIds: jest.fn(),
      toggleBank: jest.fn(),
      toggleAccount: jest.fn(),
      removeAccountsByIds: jest.fn(),
    } as any);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('loads transaction insights without page state in the query path', async () => {
    jest.mocked(TransactionService.getTransactionsInsights).mockResolvedValue({
      total_count: 3,
      total_spent: 60,
      average_amount: 20,
      largest: { amount: 30, merchant: 'Coffee Collective' },
      recurring_count: 1,
      recurring_merchants: ['Coffee Collective'],
      top_categories: ['FOOD_AND_DRINK'],
    } as any);

    const { result, rerender } = renderHook(
      ({ page }) => {
        void page;
        return useTransactionsInsights({
          search: 'coffee',
          selectedCategory: 'FOOD_AND_DRINK',
          dateRange: undefined,
        });
      },
      {
        initialProps: { page: 1 },
        wrapper: Wrapper,
      }
    );

    await waitFor(() => {
      expect(result.current.insights?.total_count).toBe(3);
    });

    expect(TransactionService.getTransactionsInsights).toHaveBeenCalledWith({
      search: 'coffee',
      categoryPrimary: 'FOOD_AND_DRINK',
      startDate: undefined,
      endDate: undefined,
      accountIds: ['account1'],
    });

    jest.mocked(TransactionService.getTransactionsInsights).mockClear();

    rerender({ page: 2 });

    await waitFor(() => {
      expect(result.current.insights?.total_count).toBe(3);
    });

    expect(TransactionService.getTransactionsInsights).not.toHaveBeenCalled();
  });
});
