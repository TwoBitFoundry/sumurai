import { useCallback, useState } from 'react';
import { BillingService } from '@/services/BillingService';
import type { TrialRedeemRequest } from '@/types/api';

const redirectTo = (url: string) => {
  window.location.assign(url);
};

export function useBillingActions(refresh: () => Promise<void>) {
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAction = useCallback(async (name: string, action: () => Promise<void>) => {
    setActionPending(name);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Billing action failed');
    } finally {
      setActionPending(null);
    }
  }, []);

  const upgrade = useCallback(
    () =>
      runAction('checkout', async () => {
        const checkout = await BillingService.createCheckout();
        redirectTo(checkout.checkout_url);
      }),
    [runAction]
  );

  const addPaymentMethod = useCallback(
    () =>
      runAction('payment-method', async () => {
        const checkout = await BillingService.createPaymentMethodTransaction();
        redirectTo(checkout.checkout_url);
      }),
    [runAction]
  );

  const openPortal = useCallback(
    () =>
      runAction('portal', async () => {
        const portal = await BillingService.createPortalSession();
        redirectTo(portal.overview_url);
      }),
    [runAction]
  );

  const redeemTrial = useCallback(
    (request: TrialRedeemRequest) => {
      if (!request.code.trim() || !request.country_code.trim() || !request.postal_code.trim()) {
        setError('Enter a trial code, country, and postal code.');
        return Promise.resolve();
      }

      return runAction('trial', async () => {
        await BillingService.redeemTrial(request);
        setMessage('Trial code accepted. Refreshing access status.');
        await refresh();
      });
    },
    [refresh, runAction]
  );

  return {
    actionPending,
    message,
    error,
    upgrade,
    addPaymentMethod,
    openPortal,
    redeemTrial,
  };
}
