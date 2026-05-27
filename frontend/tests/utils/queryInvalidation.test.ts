import { invalidateStaleCacheQueries } from '@/utils/queryInvalidation';
import { createMockFunction } from '../mocks/mockHttpClient';

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
});
