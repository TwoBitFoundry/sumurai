import { invalidateBudgetQueries, invalidateStaleCacheQueries } from '@/utils/queryInvalidation';
import { createMockFunction } from '../mocks/mockHttpClient';

describe('invalidateBudgetQueries', () => {
  it('invalidates budgets for active and inactive subscribers', async () => {
    const invalidateQueries = createMockFunction().mockResolvedValue(undefined);
    const queryClient = {
      invalidateQueries,
    } as any;

    await invalidateBudgetQueries(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['budgets'],
      refetchType: 'all',
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });
});

describe('invalidateStaleCacheQueries', () => {
  it('invalidates domain caches and provider connection caches', async () => {
    const invalidateQueries = createMockFunction().mockResolvedValue(undefined);
    const queryClient = {
      invalidateQueries,
    } as any;

    await invalidateStaleCacheQueries(queryClient, ['plaid', 'teller', 'plaid']);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['accounts'],
      refetchType: 'active',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['transactions'],
      refetchType: 'active',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['analytics'],
      refetchType: 'active',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['budgets'],
      refetchType: 'active',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['plaid', 'connections'],
      refetchType: 'active',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['teller', 'connections'],
      refetchType: 'active',
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(6);
  });

  it('removes transaction queries before invalidating when requested', async () => {
    const cancelQueries = createMockFunction().mockResolvedValue(undefined);
    const removeQueries = createMockFunction();
    const resetQueries = createMockFunction().mockResolvedValue(undefined);
    const invalidateQueries = createMockFunction().mockResolvedValue(undefined);
    const queryClient = {
      cancelQueries,
      removeQueries,
      resetQueries,
      invalidateQueries,
    } as any;

    await invalidateStaleCacheQueries(queryClient, ['plaid'], {
      resetTransactions: 'remove',
    });

    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(removeQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(resetQueries).not.toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['transactions'],
      refetchType: 'active',
    });
  });

  it('resets transaction queries before invalidating when requested', async () => {
    const cancelQueries = createMockFunction().mockResolvedValue(undefined);
    const removeQueries = createMockFunction();
    const resetQueries = createMockFunction().mockResolvedValue(undefined);
    const invalidateQueries = createMockFunction().mockResolvedValue(undefined);
    const queryClient = {
      cancelQueries,
      removeQueries,
      resetQueries,
      invalidateQueries,
    } as any;

    await invalidateStaleCacheQueries(queryClient, ['teller'], {
      resetTransactions: 'reset',
    });

    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(resetQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(removeQueries).not.toHaveBeenCalled();
  });
});
