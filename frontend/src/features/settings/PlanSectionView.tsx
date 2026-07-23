import { PricingTrialForm } from '@/features/billing/PricingTrialForm';
import type { BillingTrialStartRequest } from '@/types/api';
import { Alert, Button, GlassCard } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import {
  settingsSecurityLayout,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import type { PlanActionId, PlanPolicy } from './planPolicy';

export interface PlanSectionViewProps {
  policy: PlanPolicy | null;
  isLoading: boolean;
  queryError: string | null;
  isEmpty: boolean;
  mutationPending: boolean;
  mutationError: string | null;
  mutationRetryLabel?: string;
  trialFormOpen?: boolean;
  onRetry: () => void;
  onRetryMutation?: () => void;
  onStartTrialRequest?: (request: BillingTrialStartRequest) => Promise<void>;
  onCancelTrialForm?: () => void;
  onSwitchSelfHosted: () => void;
  onStartTrial: () => void;
  onUpgradePremium: () => void;
  onUpdatePaymentMethod: () => void;
  onCancelMembership: () => void;
  onManageBilling: () => void;
}

export function PlanSectionView({
  policy,
  isLoading,
  queryError,
  isEmpty,
  mutationPending,
  mutationError,
  mutationRetryLabel,
  trialFormOpen = false,
  onRetry,
  onRetryMutation,
  onStartTrialRequest,
  onCancelTrialForm,
  onSwitchSelfHosted,
  onStartTrial,
  onUpgradePremium,
  onUpdatePaymentMethod,
  onCancelMembership,
  onManageBilling,
}: PlanSectionViewProps) {
  if (!policy && !isLoading && !queryError && !isEmpty) {
    return null;
  }

  const callbacks: Record<PlanActionId, () => void> = {
    switch_self_hosted: onSwitchSelfHosted,
    start_trial: onStartTrial,
    upgrade_premium: onUpgradePremium,
    update_payment_method: onUpdatePaymentMethod,
    cancel_membership: onCancelMembership,
    manage_billing: onManageBilling,
  };

  return (
    <GlassCard variant="default" padding="lg">
      <section className={cn('space-y-4')} aria-labelledby="plan-section-title">
        <div className={cn(settingsSecurityLayout.sectionIntro)}>
          <h2
            id="plan-section-title"
            className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}
          >
            Plan
          </h2>
          <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
            Manage your Sumurai access.
          </p>
        </div>

        {isLoading ? (
          <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>Loading plan…</p>
        ) : null}

        {queryError ? (
          <Alert role="alert" variant="error" title="Plan unavailable">
            <div className={cn('flex', 'flex-col', 'items-start', 'gap-3')}>
              <p>{queryError}</p>
              <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
                Retry
              </Button>
            </div>
          </Alert>
        ) : null}

        {isEmpty ? (
          <Alert variant="info" title="Plan unavailable">
            No plan information is available.
          </Alert>
        ) : null}

        {policy ? (
          <div className={cn('space-y-4')}>
            <div className={cn('space-y-1')}>
              {policy.planLabel ? (
                <h3 className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}>
                  {policy.planLabel}
                </h3>
              ) : null}
              <p className={cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.primary)}>
                {policy.statusCopy}
              </p>
              <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>{policy.detail}</p>
            </div>

            {policy.alert ? (
              <Alert role="alert" variant={policy.alert.variant} title={policy.alert.title}>
                {policy.alert.message}
              </Alert>
            ) : null}

            {mutationPending ? (
              <p role="status" className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                Updating plan…
              </p>
            ) : null}

            {mutationError ? (
              <Alert role="alert" variant="error" title="Plan update failed">
                <div className={cn('flex', 'flex-col', 'items-start', 'gap-3')}>
                  <p>{mutationError}</p>
                  {mutationRetryLabel && onRetryMutation ? (
                    <Button type="button" variant="secondary" size="sm" onClick={onRetryMutation}>
                      {mutationRetryLabel}
                    </Button>
                  ) : null}
                </div>
              </Alert>
            ) : null}

            {trialFormOpen && onStartTrialRequest ? (
              <div className={cn('space-y-3')}>
                <PricingTrialForm disabled={mutationPending} onStartTrial={onStartTrialRequest} />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className={cn('w-full')}
                  disabled={mutationPending}
                  onClick={onCancelTrialForm}
                >
                  Cancel
                </Button>
              </div>
            ) : policy.actions.length > 0 ? (
              <div className={cn('flex', 'flex-col', 'gap-3', 'md:flex-row', 'md:flex-wrap')}>
                {policy.actions.map((planAction) => (
                  <Button
                    key={planAction.id}
                    type="button"
                    variant={planAction.variant}
                    size="md"
                    disabled={mutationPending}
                    onClick={callbacks[planAction.id]}
                    className={cn('w-full', 'md:w-auto')}
                  >
                    {planAction.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </GlassCard>
  );
}

export default PlanSectionView;
