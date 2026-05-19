import { invalidateStaleCacheQueries } from '@/utils/queryInvalidation';

describe('invalidateStaleCacheQueries', () => {
  it('invalidates domain caches and provider connection caches', async () => {
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    const queryClient = {
      invalidateQueries,
    } as any;

    await invalidateStaleCacheQueries(queryClient, ['plaid', 'teller', 'plaid']);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['accounts'],
      refetchType: 'all',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['transactions'],
      refetchType: 'all',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['analytics'],
      refetchType: 'all',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['budgets'],
      refetchType: 'all',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['plaid', 'connections'],
      refetchType: 'all',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['teller', 'connections'],
      refetchType: 'all',
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(6);
  });
});
