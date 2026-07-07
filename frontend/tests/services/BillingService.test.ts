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

  it('loads billing status from the backend billing endpoint', async () => {
    const status = {
      billing_enabled: false,
      access_status: 'unrestricted',
      can_use_own_data: true,
      is_demo_mode_active: false,
      trial_ends_at: null,
      current_period_ends_at: null,
      payment_method_required: false,
      billing_portal_available: false,
      enabled_financial_providers: ['plaid', 'diy'],
    };
    jest.mocked(ApiClient.get).mockResolvedValueOnce(status);

    await expect(BillingService.getStatus()).resolves.toEqual(status);

    expect(ApiClient.get).toHaveBeenCalledWith('/billing/status');
  });

  it('creates checkout, trial redemption, payment method, and portal requests', async () => {
    jest
      .mocked(ApiClient.post)
      .mockResolvedValueOnce({ checkout_url: 'https://checkout.test', transaction_id: 'txn_1' })
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ checkout_url: 'https://checkout.test/pay', transaction_id: 'txn_2' })
      .mockResolvedValueOnce({
        overview_url: 'https://portal.test',
        subscription_urls: ['https://portal.test/sub'],
      });

    await BillingService.createCheckout();
    await BillingService.redeemTrial({
      code: 'SUMURAI',
      country_code: 'US',
      postal_code: '60601',
    });
    await BillingService.createPaymentMethodTransaction();
    await BillingService.createPortalSession();

    expect(ApiClient.post).toHaveBeenNthCalledWith(1, '/billing/checkout');
    expect(ApiClient.post).toHaveBeenNthCalledWith(2, '/billing/trials/redeem', {
      code: 'SUMURAI',
      country_code: 'US',
      postal_code: '60601',
    });
    expect(ApiClient.post).toHaveBeenNthCalledWith(3, '/billing/payment-method');
    expect(ApiClient.post).toHaveBeenNthCalledWith(4, '/billing/portal-session');
  });
});
