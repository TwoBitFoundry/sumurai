import { ApiClient } from '@/services/ApiClient';
import { SubscriptionService } from '@/services/SubscriptionService';
import type { SubscriptionSummary } from '@/types/api';

jest.mock('@/services/ApiClient', () => ({
  ApiClient: {
    get: jest.fn(),
  },
}));

describe('SubscriptionService.getSubscriptions — Given/When/Then', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Given backend returns summaries; When getSubscriptions; Then returns the array unchanged', async () => {
    const summaries: SubscriptionSummary[] = [
      {
        merchant: 'Spotify',
        normalized_merchant: 'spotify',
        monthly_cost: '9.99',
        cadence: 'monthly',
        last_charged: '2026-05-01',
        occurrence_count: 6,
      },
    ];
    jest.mocked(ApiClient.get).mockResolvedValueOnce(summaries);

    const result = await SubscriptionService.getSubscriptions();

    expect(ApiClient.get).toHaveBeenCalledWith('/subscriptions');
    expect(result).toEqual(summaries);
  });

  it('Given network error; When getSubscriptions; Then propagates error', async () => {
    const err = new Error('Network');
    jest.mocked(ApiClient.get).mockRejectedValueOnce(err);

    await expect(SubscriptionService.getSubscriptions()).rejects.toBe(err);
    expect(ApiClient.get).toHaveBeenCalledTimes(1);
  });
});
