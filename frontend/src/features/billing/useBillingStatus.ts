import { useQuery } from '@tanstack/react-query';
import { BillingService } from '@/services/BillingService';
import type { BillingDisabledStatusResponse } from '@/types/api';

export const BILLING_STATUS_QUERY_KEY = ['billing', 'status'] as const;

export interface UseBillingStatusOptions {
  enabled?: boolean;
}

export const createDisabledBillingStatus = (): BillingDisabledStatusResponse => ({
  billing_enabled: false,
  trials_enabled: false,
  paddle_client_token: null,
  paddle_environment: null,
  access_status: 'unrestricted',
  can_use_own_data: true,
  is_demo_mode_active: false,
  trial_ends_at: null,
  current_period_ends_at: null,
  scheduled_cancel_at: null,
  payment_method_required: false,
  billing_portal_available: false,
  enabled_financial_providers: ['plaid', 'teller', 'simplefin', 'diy'],
});

export function useBillingStatus(options: UseBillingStatusOptions = {}) {
  const query = useQuery({
    queryKey: BILLING_STATUS_QUERY_KEY,
    queryFn: () => BillingService.getStatus(),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
  const data = query.data ?? (query.isError ? createDisabledBillingStatus() : undefined);

  return { ...query, data };
}
