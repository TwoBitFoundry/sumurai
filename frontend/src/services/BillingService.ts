import { ApiClient } from '@/services/ApiClient';
import type {
  BillingCheckoutResponse,
  BillingPortalSessionResponse,
  BillingStatusResponse,
  TrialRedeemRequest,
  TrialRedeemResponse,
} from '@/types/api';

export class BillingService {
  static async getStatus(): Promise<BillingStatusResponse> {
    return ApiClient.get<BillingStatusResponse>('/billing/status');
  }

  static async createCheckout(): Promise<BillingCheckoutResponse> {
    return ApiClient.post<BillingCheckoutResponse>('/billing/checkout');
  }

  static async redeemTrial(request: TrialRedeemRequest): Promise<TrialRedeemResponse> {
    return ApiClient.post<TrialRedeemResponse>('/billing/trials/redeem', request);
  }

  static async createPaymentMethodTransaction(): Promise<BillingCheckoutResponse> {
    return ApiClient.post<BillingCheckoutResponse>('/billing/payment-method');
  }

  static async createPortalSession(): Promise<BillingPortalSessionResponse> {
    return ApiClient.post<BillingPortalSessionResponse>('/billing/portal-session');
  }
}
