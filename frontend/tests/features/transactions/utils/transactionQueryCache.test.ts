import { describe, expect, it } from 'bun:test';
import {
  resetTransactionQueries,
  withUpdatedTransactionCategory,
  withUpdatedTransactionCategoryInInfiniteData,
} from '@/features/transactions/utils/transactionQueryCache';
import type { Transaction } from '@/types/api';
import { createMockFunction } from '../../../mocks/mockHttpClient';

const makeTransaction = (id: string, primary: string): Transaction => ({
  id,
  date: '2024-01-01',
  name: 'Merchant',
  amount: 10,
  category: { primary },
});

describe('transactionQueryCache', () => {
  it('updates the matching transaction category', () => {
    const updated = withUpdatedTransactionCategory(makeTransaction('tx-1', 'Food'), {
      transactionId: 'tx-1',
      categoryName: 'Coffee',
      isCustom: true,
    });

    expect(updated.category.primary).toBe('Coffee');
    expect(updated.category.is_custom).toBe(true);
    expect(updated.category.is_overridden).toBe(true);
  });

  it('leaves other transactions unchanged', () => {
    const unchanged = withUpdatedTransactionCategory(makeTransaction('tx-2', 'Food'), {
      transactionId: 'tx-1',
      categoryName: 'Coffee',
      isCustom: true,
    });

    expect(unchanged.category.primary).toBe('Food');
    expect(unchanged.category.is_overridden).toBeUndefined();
  });

  it('updates categories across infinite query pages', () => {
    const next = withUpdatedTransactionCategoryInInfiniteData(
      {
        pages: [
          {
            transactions: [makeTransaction('tx-1', 'Food')],
            next_cursor: 'cursor-1',
            prev_cursor: null,
            has_more: true,
          },
          {
            transactions: [makeTransaction('tx-2', 'Travel')],
            next_cursor: null,
            prev_cursor: 'cursor-1',
            has_more: false,
          },
        ],
        pageParams: [undefined, 'cursor-1'],
      },
      {
        transactionId: 'tx-2',
        categoryName: 'Coffee',
        isCustom: false,
      }
    );

    expect(next.pages[0]?.transactions[0]?.category.primary).toBe('Food');
    expect(next.pages[1]?.transactions[0]?.category.primary).toBe('Coffee');
    expect(next.pages[1]?.transactions[0]?.category.is_overridden).toBe(true);
  });

  it('removes transaction queries from the cache', async () => {
    const cancelQueries = createMockFunction().mockResolvedValue(undefined);
    const removeQueries = createMockFunction();
    const resetQueries = createMockFunction().mockResolvedValue(undefined);
    const queryClient = {
      cancelQueries,
      removeQueries,
      resetQueries,
    } as any;

    await resetTransactionQueries(queryClient, 'remove');

    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(removeQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(resetQueries).not.toHaveBeenCalled();
  });

  it('resets active transaction queries', async () => {
    const cancelQueries = createMockFunction().mockResolvedValue(undefined);
    const removeQueries = createMockFunction();
    const resetQueries = createMockFunction().mockResolvedValue(undefined);
    const queryClient = {
      cancelQueries,
      removeQueries,
      resetQueries,
    } as any;

    await resetTransactionQueries(queryClient, 'reset');

    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(resetQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(removeQueries).not.toHaveBeenCalled();
  });
});
