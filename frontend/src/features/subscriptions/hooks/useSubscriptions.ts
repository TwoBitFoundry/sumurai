import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { SubscriptionService } from '../../../services/SubscriptionService';
import type { SubscriptionSummary } from '../../../types/api';

export interface UseSubscriptionsResult {
  isLoading: boolean;
  error: string | null;
  subscriptions: SubscriptionSummary[];
}

export function useSubscriptions(): UseSubscriptionsResult {
  const query = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => SubscriptionService.getSubscriptions(),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const error = useMemo(() => {
    if (!query.isError || query.error == null) return null;
    return 'Failed to load subscriptions.';
  }, [query.isError, query.error]);

  return {
    isLoading: query.isPending,
    error,
    subscriptions: query.data ?? [],
  };
}
