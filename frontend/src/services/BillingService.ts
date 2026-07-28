import type {
  BillingCancelResponse,
  BillingCheckoutResponse,
  BillingPortalSessionResponse,
  BillingStatusResponse,
  BillingTrialStartRequest,
  BillingTrialStartResponse,
} from '@/types/api';
import { ApiClient } from './ApiClient';

export class BillingService {
  static async getStatus(): Promise<BillingStatusResponse> {
    return ApiClient.get<BillingStatusResponse>('/billing/status');
  }

  static async createCheckout(): Promise<BillingCheckoutResponse> {
    return ApiClient.post<BillingCheckoutResponse>('/billing/checkout');
  }

  static async startTrial(request: BillingTrialStartRequest): Promise<BillingTrialStartResponse> {
    return ApiClient.post<BillingTrialStartResponse>('/billing/trials/start', request);
  }

  static async createPaymentMethodTransaction(): Promise<BillingCheckoutResponse> {
    return ApiClient.post<BillingCheckoutResponse>('/billing/payment-method');
  }

  static async createPortalSession(): Promise<BillingPortalSessionResponse> {
    return ApiClient.post<BillingPortalSessionResponse>('/billing/portal-session');
  }

  static async cancelSubscription(): Promise<BillingCancelResponse> {
    return ApiClient.post<BillingCancelResponse>('/billing/subscription/cancel');
  }
}
