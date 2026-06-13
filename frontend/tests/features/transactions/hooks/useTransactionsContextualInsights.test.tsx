import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { useTransactionsContextualInsights } from '@/features/transactions/hooks/useTransactionsContextualInsights';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { TransactionService } from '@/services/TransactionService';

jest.mock('@/hooks/useAccountFilter', () => ({
  useAccountFilter: jest.fn(),
}));

jest.mock('@/services/TransactionService', () => ({
  TransactionService: {
    getTransactionsContextualInsights: jest.fn(),
  },
}));

describe('useTransactionsContextualInsights', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 60 * 1000,
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
      selectedAccountIds: ['account1', 'account2'],
      allAccountIds: ['account1', 'account2'],
      isAllAccountsSelected: true,
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

  it('derives category display state before insights data resolves', () => {
    jest
      .mocked(TransactionService.getTransactionsContextualInsights)
      .mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(
      () =>
        useTransactionsContextualInsights({
          search: '',
          selectedCategory: 'TRAVEL',
          dateRange: undefined,
        }),
      { wrapper: Wrapper }
    );

    expect(result.current.insights).toBeNull();
    expect(result.current.displayState).toBe('b');
  });

  it('uses API state once insights data resolves', async () => {
    jest.mocked(TransactionService.getTransactionsContextualInsights).mockResolvedValue({
      state: 'b',
      card1: {
        value: 100,
        format: 'currency',
        secondary: 1,
        comparison: null,
        share: null,
        label: null,
      },
      card2: {
        value: 25,
        format: 'currency',
        secondary: null,
        comparison: null,
        share: null,
        label: null,
      },
      card3: null,
    } as any);

    const { result } = renderHook(
      () =>
        useTransactionsContextualInsights({
          search: '',
          selectedCategory: 'TRAVEL',
          dateRange: undefined,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.insights?.state).toBe('b');
    });
    expect(result.current.displayState).toBe('b');
  });

  it('derives account display state for a single selected account', () => {
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
    jest
      .mocked(TransactionService.getTransactionsContextualInsights)
      .mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(
      () =>
        useTransactionsContextualInsights({
          search: '',
          selectedCategory: null,
          dateRange: undefined,
        }),
      { wrapper: Wrapper }
    );

    expect(result.current.displayState).toBe('d');
  });
});
