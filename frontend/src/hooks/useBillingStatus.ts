import { useQuery } from '@tanstack/react-query';
import { BillingService } from '@/services/BillingService';

export const billingStatusQueryKey = ['billing', 'status'] as const;

export function useBillingStatus() {
  const query = useQuery({
    queryKey: billingStatusQueryKey,
    queryFn: () => BillingService.getStatus(),
    retry: false,
    staleTime: 60_000,
  });

  const status = query.data ?? null;
  const billingEnabled = status?.billing_enabled === true;

  return {
    status,
    loading: query.isPending,
    error: query.error ?? null,
    billingEnabled,
    shouldShowBilling: billingEnabled,
    refresh: async () => {
      await query.refetch();
    },
  };
}
