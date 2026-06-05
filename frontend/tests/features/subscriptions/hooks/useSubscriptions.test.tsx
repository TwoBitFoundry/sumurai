import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { useSubscriptions } from '@/features/subscriptions/hooks/useSubscriptions';
import { SubscriptionService } from '@/services/SubscriptionService';
import type { SubscriptionSummary } from '@/types/api';

jest.mock('@/services/SubscriptionService', () => ({
  SubscriptionService: {
    getSubscriptions: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    const [client] = useState(queryClient);
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
};

const makeSummary = (merchant: string): SubscriptionSummary => ({
  merchant,
  normalized_merchant: merchant.toLowerCase(),
  monthly_cost: '9.99',
  cadence: 'monthly',
  last_charged: '2026-05-01',
  occurrence_count: 3,
});

describe('useSubscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Given backend returns summaries; When hook loads; Then exposes subscriptions data', async () => {
    const summaries = [makeSummary('Spotify'), makeSummary('Netflix')];
    jest.mocked(SubscriptionService.getSubscriptions).mockResolvedValueOnce(summaries);

    const { result } = renderHook(() => useSubscriptions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscriptions).toEqual(summaries);
    expect(result.current.error).toBeNull();
  });

  it('Given fetch fails; When hook loads; Then exposes error state', async () => {
    jest
      .mocked(SubscriptionService.getSubscriptions)
      .mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSubscriptions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).not.toBeNull();
    expect(result.current.subscriptions).toEqual([]);
  });

  it('Given empty response; When hook loads; Then subscriptions is empty array', async () => {
    jest.mocked(SubscriptionService.getSubscriptions).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useSubscriptions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscriptions).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
