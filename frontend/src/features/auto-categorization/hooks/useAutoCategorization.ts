import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AutoCategorizationService } from '@/services/AutoCategorizationService';
import { type AutoCategorizationJobState, isAutoCategorizationJobActive } from '@/types/api';
import { invalidateCategorizationDependentQueries } from '@/utils/queryInvalidation';

const STATUS_QUERY_KEY = ['auto-categorization', 'status'] as const;
const POLL_INTERVAL_MS = 2000;

export interface UseAutoCategorizationResult {
  job: AutoCategorizationJobState | null;
  isActive: boolean;
  isLoading: boolean;
  isPending: boolean;
  progressLabel: string | null;
  handleAction: () => Promise<void>;
}

export function useAutoCategorization(): UseAutoCategorizationResult {
  const queryClient = useQueryClient();
  const wasActiveRef = useRef(false);

  const statusQuery = useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: () => AutoCategorizationService.getStatus(),
    refetchInterval: (query) => {
      const job = query.state.data;
      if (job && isAutoCategorizationJobActive(job.status)) {
        return POLL_INTERVAL_MS;
      }
      return false;
    },
  });

  const job = statusQuery.data ?? null;
  const isActive = job !== null && isAutoCategorizationJobActive(job.status);

  useEffect(() => {
    if (wasActiveRef.current && job && !isAutoCategorizationJobActive(job.status)) {
      void invalidateCategorizationDependentQueries(queryClient);
    }
    wasActiveRef.current = isActive;
  }, [job, isActive, queryClient]);

  const startMutation = useMutation({
    mutationFn: () => AutoCategorizationService.start(),
    onSuccess: (started) => {
      queryClient.setQueryData(STATUS_QUERY_KEY, started);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => AutoCategorizationService.cancel(),
    onSuccess: (cancelled) => {
      queryClient.setQueryData(STATUS_QUERY_KEY, cancelled);
    },
  });

  const handleAction = async () => {
    if (isActive) {
      await cancelMutation.mutateAsync();
      return;
    }
    await startMutation.mutateAsync();
  };

  const progressLabel =
    job && isActive && job.total > 0
      ? `${job.processed} / ${job.total} processed`
      : job && isActive
        ? `${job.updated} updated, ${job.skipped} skipped`
        : null;

  return {
    job,
    isActive,
    isLoading: statusQuery.isLoading,
    isPending: startMutation.isPending || cancelMutation.isPending,
    progressLabel,
    handleAction,
  };
}
