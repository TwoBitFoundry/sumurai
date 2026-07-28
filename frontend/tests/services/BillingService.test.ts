import { ApiClient } from '@/services/ApiClient';
import { BillingService } from '@/services/BillingService';

jest.mock('@/services/ApiClient', () => ({
  ApiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('BillingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the billing status GET endpoint', async () => {
    const response = {
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
      enabled_financial_providers: ['diy'],
    } as unknown as import('@/types/api').BillingEnabledStatusResponse;
    jest.mocked(ApiClient.get).mockResolvedValueOnce(response);

    await expect(BillingService.getStatus()).resolves.toEqual(response);

    expect(ApiClient.get).toHaveBeenCalledWith('/billing/status');
  });

  it('uses the checkout POST endpoint', async () => {
    const response = { checkout_url: 'https://checkout.test', transaction_id: 'txn_1' };
    jest.mocked(ApiClient.post).mockResolvedValueOnce(response);

    await expect(BillingService.createCheckout()).resolves.toEqual(response);

    expect(ApiClient.post).toHaveBeenCalledWith('/billing/checkout');
  });

  it('uses the trial POST endpoint with the billing address', async () => {
    const request = { country_code: 'US', postal_code: '78701' };
    const response = { status: 'pending' } as const;
    jest.mocked(ApiClient.post).mockResolvedValueOnce(response);

    await expect(BillingService.startTrial(request)).resolves.toEqual(response);

    expect(ApiClient.post).toHaveBeenCalledWith('/billing/trials/start', request);
  });

  it('uses the payment-method POST endpoint', async () => {
    const response = { checkout_url: 'https://checkout.test', transaction_id: 'txn_2' };
    jest.mocked(ApiClient.post).mockResolvedValueOnce(response);

    await expect(BillingService.createPaymentMethodTransaction()).resolves.toEqual(response);

    expect(ApiClient.post).toHaveBeenCalledWith('/billing/payment-method');
  });

  it('uses the portal-session POST endpoint', async () => {
    const response = {
      overview_url: 'https://portal.test',
      subscription_urls: ['https://portal.test/subscription'],
    };
    jest.mocked(ApiClient.post).mockResolvedValueOnce(response);

    await expect(BillingService.createPortalSession()).resolves.toEqual(response);

    expect(ApiClient.post).toHaveBeenCalledWith('/billing/portal-session');
  });

  it('uses the subscription cancellation POST endpoint', async () => {
    const response = { status: 'scheduled', scheduled_cancel_at: '2026-08-23T12:00:00Z' } as const;
    jest.mocked(ApiClient.post).mockResolvedValueOnce(response);

    await expect(BillingService.cancelSubscription()).resolves.toEqual(response);

    expect(ApiClient.post).toHaveBeenCalledWith('/billing/subscription/cancel');
  });
});
