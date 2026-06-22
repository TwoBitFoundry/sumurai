import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { useInfiniteTransactions } from '@/features/transactions/hooks/useInfiniteTransactions';
import { TransactionService } from '@/services/TransactionService';

jest.mock('@/services/TransactionService', () => ({
  TransactionService: {
    getTransactionsPage: jest.fn(),
  },
}));

jest.mock('@/hooks/useAccountFilter', () => ({
  useAccountFilter: jest.fn(() => ({
    selectedAccountIds: ['account1'],
    allAccountIds: ['account1'],
    isAllAccountsSelected: true,
    loading: false,
  })),
}));

const makeTransaction = (id: string) => ({
  id,
  merchant_name: 'Test',
  normalized_merchant: 'test',
  amount: 10,
  date: '2024-01-01',
  category_primary: 'FOOD',
  category_detailed: null,
  is_custom_category: false,
  pending: false,
  logo_url: null,
  account_id: 'account1',
  account_name: 'Checking',
  account_type: 'depository',
  institution_name: 'Bank',
  display_name: 'Test',
  effective_category: 'FOOD',
  effective_merchant: 'test',
});

const makePage = (ids: string[], nextCursor: string | null, hasMore: boolean) => ({
  transactions: ids.map(makeTransaction),
  next_cursor: nextCursor,
  prev_cursor: ids.length > 0 ? `cursor:${ids[0]}` : null,
  has_more: hasMore,
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 5 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useInfiniteTransactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches first page with no cursor', async () => {
    jest
      .mocked(TransactionService.getTransactionsPage)
      .mockResolvedValue(makePage(['tx1', 'tx2'], 'cursor:tx2', true));

    const { result } = renderHook(() => useInfiniteTransactions({}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.rows.length).toBe(2));

    const call = jest.mocked(TransactionService.getTransactionsPage).mock.calls[0]?.[0];
    expect(call?.cursor).toBeUndefined();
    expect(result.current.hasNextPage).toBe(true);
  });

  it('sends prior next_cursor when fetching next page', async () => {
    jest
      .mocked(TransactionService.getTransactionsPage)
      .mockResolvedValueOnce(makePage(['tx1', 'tx2'], 'cursor-abc', true))
      .mockResolvedValueOnce(makePage(['tx3', 'tx4'], null, false));

    const { result } = renderHook(() => useInfiniteTransactions({}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.rows.length).toBe(2));

    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.rows.length).toBe(4));

    const calls = jest.mocked(TransactionService.getTransactionsPage).mock.calls;
    expect(calls[1]?.[0]?.cursor).toBe('cursor-abc');
  });

  it('rows are in-order concatenation of pages with no duplicates', async () => {
    jest
      .mocked(TransactionService.getTransactionsPage)
      .mockResolvedValueOnce(makePage(['tx1', 'tx2'], 'cur2', true))
      .mockResolvedValueOnce(makePage(['tx3', 'tx4'], null, false));

    const { result } = renderHook(() => useInfiniteTransactions({}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.rows.length).toBe(2));
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.rows.length).toBe(4));

    expect(result.current.rows.map((r) => r.id)).toEqual(['tx1', 'tx2', 'tx3', 'tx4']);
  });

  it('sets hasNextPage false and stops fetching when has_more is false', async () => {
    jest
      .mocked(TransactionService.getTransactionsPage)
      .mockResolvedValue(makePage(['tx1'], null, false));

    const { result } = renderHook(() => useInfiniteTransactions({}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.rows.length).toBe(1));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('resets to fresh query when filters change', async () => {
    jest
      .mocked(TransactionService.getTransactionsPage)
      .mockResolvedValueOnce(makePage(['tx-food'], 'cur1', true))
      .mockResolvedValueOnce(makePage(['tx-travel'], null, false));

    const { result, rerender } = renderHook(
      ({ filters }: { filters: Parameters<typeof useInfiniteTransactions>[0] }) =>
        useInfiniteTransactions(filters),
      {
        wrapper: makeWrapper(),
        initialProps: { filters: { categoryPrimary: 'FOOD' } },
      }
    );

    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual(['tx-food']));

    const foodCall = jest.mocked(TransactionService.getTransactionsPage).mock.calls[0]?.[0];
    expect(foodCall?.categoryPrimary).toBe('FOOD');

    rerender({ filters: { categoryPrimary: 'TRAVEL' } });

    expect(result.current.rows.map((row) => row.id)).toEqual(['tx-food']);

    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual(['tx-travel']));

    const travelCall = jest
      .mocked(TransactionService.getTransactionsPage)
      .mock.calls.find((c) => c[0]?.categoryPrimary === 'TRAVEL')?.[0];
    expect(travelCall?.cursor).toBeUndefined();
    expect(travelCall?.categoryPrimary).toBe('TRAVEL');
  });

  it('does not keep previous rows when explicit account filters change', async () => {
    jest
      .mocked(TransactionService.getTransactionsPage)
      .mockResolvedValueOnce(makePage(['tx-checking'], null, false))
      .mockResolvedValueOnce(makePage(['tx-card'], null, false));

    const { result, rerender } = renderHook(
      ({ filters }: { filters: Parameters<typeof useInfiniteTransactions>[0] }) =>
        useInfiniteTransactions(filters),
      {
        wrapper: makeWrapper(),
        initialProps: { filters: { accountIds: ['account-checking'] } },
      }
    );

    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual(['tx-checking']));

    rerender({ filters: { accountIds: ['account-card'] } });

    expect(result.current.rows).toEqual([]);

    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual(['tx-card']));
  });
});
