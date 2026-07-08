import { act, renderHook, waitFor } from '@testing-library/react';
import { useBillingActions } from '@/hooks/useBillingActions';
import { BillingService } from '@/services/BillingService';

jest.mock('@/services/BillingService', () => ({
  BillingService: {
    createCheckout: jest.fn(),
    redeemTrial: jest.fn(),
    createPaymentMethodTransaction: jest.fn(),
    createPortalSession: jest.fn(),
  },
}));

describe('useBillingActions', () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  const assign = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign },
    });
  });

  it('redirects to checkout when upgrade succeeds', async () => {
    jest.mocked(BillingService.createCheckout).mockResolvedValueOnce({
      checkout_url: 'https://checkout.paddle.test/monthly',
      transaction_id: 'txn_monthly',
    });

    const { result } = renderHook(() => useBillingActions(refresh));

    await act(async () => {
      await result.current.upgrade();
    });

    expect(assign).toHaveBeenCalledWith('https://checkout.paddle.test/monthly');
    expect(result.current.error).toBeNull();
  });

  it('sets error when upgrade fails', async () => {
    jest.mocked(BillingService.createCheckout).mockRejectedValueOnce(new Error('Paddle down'));

    const { result } = renderHook(() => useBillingActions(refresh));

    await act(async () => {
      await result.current.upgrade();
    });

    expect(result.current.error).toBe('Paddle down');
    expect(assign).not.toHaveBeenCalled();
  });

  it('rejects empty trial redemption input without calling the API', async () => {
    const { result } = renderHook(() => useBillingActions(refresh));

    await act(async () => {
      await result.current.redeemTrial({
        code: ' ',
        country_code: 'US',
        postal_code: '94107',
      });
    });

    expect(BillingService.redeemTrial).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Enter a trial code, country, and postal code.');
  });

  it('refreshes billing status after trial redemption succeeds', async () => {
    jest.mocked(BillingService.redeemTrial).mockResolvedValueOnce({ status: 'pending' });

    const { result } = renderHook(() => useBillingActions(refresh));

    await act(async () => {
      await result.current.redeemTrial({
        code: 'TRIAL-2026',
        country_code: 'US',
        postal_code: '94107',
      });
    });

    await waitFor(() =>
      expect(result.current.message).toBe('Trial code accepted. Refreshing access status.')
    );
    expect(refresh).toHaveBeenCalled();
  });
});
