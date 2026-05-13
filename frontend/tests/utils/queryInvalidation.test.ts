import { invalidateStaleCacheQueries } from '@/utils/queryInvalidation';

describe('invalidateStaleCacheQueries', () => {
  it('invalidates domain caches and provider connection caches', async () => {
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    const queryClient = {
      invalidateQueries,
    } as any;

    await invalidateStaleCacheQueries(queryClient, ['plaid', 'teller', 'plaid']);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['accounts'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['analytics'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['budgets'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['plaid', 'connections'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['teller', 'connections'] });
    expect(invalidateQueries).toHaveBeenCalledTimes(6);
  });
});
