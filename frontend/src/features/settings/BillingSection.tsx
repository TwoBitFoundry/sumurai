import { CreditCard, KeyRound, LockKeyhole } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useBillingActions } from '@/hooks/useBillingActions';
import { useBillingStatus } from '@/hooks/useBillingStatus';
import { Alert, Button, FormLabel, Input } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import {
  settingsSecurityLayout,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

const accessLabels = {
  unrestricted: 'Available',
  demo: 'Demo',
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  paused: 'Paused',
  canceled: 'Canceled',
  expired: 'Expired',
} as const;

const blockedAccessStates = new Set(['demo', 'past_due', 'paused', 'canceled', 'expired']);

const formatBillingDate = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));

export function BillingSection() {
  const { status, shouldShowBilling, refresh } = useBillingStatus();
  const { actionPending, message, error, upgrade, addPaymentMethod, openPortal, redeemTrial } =
    useBillingActions(refresh);
  const [trialCode, setTrialCode] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [postalCode, setPostalCode] = useState('');

  if (!shouldShowBilling || !status) {
    return null;
  }

  const blocked = blockedAccessStates.has(status.access_status) && !status.can_use_own_data;
  const canManage = status.billing_portal_available;

  const handleTrialRedeem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = trialCode.trim();
    const country = countryCode.trim().toUpperCase();
    const postal = postalCode.trim();

    if (!code || !country || !postal) {
      return;
    }

    void redeemTrial({
      code,
      country_code: country,
      postal_code: postal,
    });
  };

  return (
    <section className={cn('border-t', 'border-[var(--color-border-subtle)]', 'pt-5', 'space-y-4')}>
      <div className={cn(settingsSecurityLayout.sectionHeader)}>
        <div className={cn(settingsSecurityLayout.sectionIntro)}>
          <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>Billing</h2>
          <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
            Paid access unlocks your own connected data in production.
          </p>
          {status.trial_ends_at ? (
            <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.subtle)}>
              Trial ends {formatBillingDate(status.trial_ends_at)}.
            </p>
          ) : null}
          {status.current_period_ends_at && status.access_status === 'active' ? (
            <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.subtle)}>
              Current period ends {formatBillingDate(status.current_period_ends_at)}.
            </p>
          ) : null}
        </div>
        <div className={cn('flex', 'flex-wrap', 'gap-2')}>
          {blocked ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={upgrade}
              disabled={actionPending !== null}
            >
              {actionPending === 'checkout' ? 'Opening...' : 'Upgrade'}
            </Button>
          ) : null}
          {status.payment_method_required ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={addPaymentMethod}
              disabled={actionPending !== null}
            >
              {actionPending === 'payment-method' ? 'Opening...' : 'Add payment method'}
            </Button>
          ) : null}
          {canManage ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={openPortal}
              disabled={actionPending !== null}
            >
              {actionPending === 'portal' ? 'Opening...' : 'Manage billing'}
            </Button>
          ) : null}
        </div>
      </div>

      <Alert
        variant={status.can_use_own_data ? 'success' : 'warning'}
        title={`Status: ${accessLabels[status.access_status]}`}
        icon={
          status.can_use_own_data ? (
            <CreditCard className={cn('h-5', 'w-5')} />
          ) : (
            <LockKeyhole className={cn('h-5', 'w-5')} />
          )
        }
      >
        {status.can_use_own_data
          ? 'Own-data features are available for this account.'
          : 'Read, export, disconnect, and delete stay available. Connecting and writing own data requires paid access or a valid trial.'}
      </Alert>

      {error ? (
        <Alert variant="error" title="Billing action failed">
          {error}
        </Alert>
      ) : null}

      {message ? (
        <Alert variant="success" title="Request accepted">
          {message}
        </Alert>
      ) : null}

      {!status.can_use_own_data ? (
        <form onSubmit={handleTrialRedeem} className={cn('grid', 'gap-3', 'md:grid-cols-3')}>
          <div className={cn('space-y-2')}>
            <FormLabel htmlFor="trial-code">Trial code</FormLabel>
            <Input
              id="trial-code"
              value={trialCode}
              onChange={(event) => setTrialCode(event.target.value)}
              disabled={actionPending !== null}
            />
          </div>
          <div className={cn('space-y-2')}>
            <FormLabel htmlFor="billing-country">Country</FormLabel>
            <Input
              id="billing-country"
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              disabled={actionPending !== null}
              maxLength={2}
            />
          </div>
          <div className={cn('space-y-2')}>
            <FormLabel htmlFor="billing-postal-code">Postal code</FormLabel>
            <Input
              id="billing-postal-code"
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              disabled={actionPending !== null}
            />
          </div>
          <div className={cn('md:col-span-3')}>
            <Button type="submit" variant="secondary" size="md" disabled={actionPending !== null}>
              <KeyRound aria-hidden className={cn('h-4', 'w-4')} />
              {actionPending === 'trial' ? 'Redeeming...' : 'Redeem trial code'}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
