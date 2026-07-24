import { Check, Crown, FlaskConical, type LucideIcon, Rocket, Server } from 'lucide-react';
import { PricingTrialForm } from '@/features/billing/PricingTrialForm';
import type { BillingTrialStartRequest } from '@/types/api';
import { Alert, Button, GlassCard } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import {
  controlIconWell,
  providerSelectionCard,
  settingsPlanLayout,
  settingsSecurityLayout,
  status as uiStatusRecipes,
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

function resolvePlanIcon(planLabel: string | null): LucideIcon {
  switch (planLabel) {
    case 'Demo mode':
      return FlaskConical;
    case 'Free trial':
      return Rocket;
    case 'Premium':
      return Crown;
    default:
      return Server;
  }
}

function PlanMarkPanel({ policy }: { policy: PlanPolicy }) {
  const Icon = resolvePlanIcon(policy.planLabel);
  const title = policy.planLabel ?? policy.statusCopy;

  return (
    <div className={cn(...settingsPlanLayout.markPanel)}>
      <span className={cn(...settingsPlanLayout.markWell)} aria-hidden>
        <Icon className={cn(...settingsPlanLayout.markGlyph)} />
      </span>
      <div className={cn('space-y-2')}>
        <p className={cn(uiTypographyRecipes.badge, uiTextRecipes.accent)}>Current plan</p>
        <h3 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>{title}</h3>
      </div>
    </div>
  );
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

  const headerActions =
    policy && !trialFormOpen && policy.actions.length > 0 ? policy.actions : null;

  return (
    <GlassCard
      variant="accent"
      rounded="lg"
      padding="none"
      withInnerEffects={false}
      containerClassName={cn(...providerSelectionCard.shell, ...providerSelectionCard.padding)}
    >
      <section className={cn('flex', 'flex-col', 'gap-6')} aria-labelledby="plan-section-title">
        <div className={cn(settingsSecurityLayout.sectionHeader)}>
          <div className={cn(settingsSecurityLayout.sectionIntro)}>
            <h2
              id="plan-section-title"
              className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}
            >
              Choose your Path
            </h2>
            <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
              {policy?.introCopy ??
                'Manage Sumurai access for this deployment — demo, self-hosted, or subscription.'}
            </p>
          </div>
          {headerActions ? (
            <div className={cn(...settingsPlanLayout.headerActions)}>
              {headerActions.map((planAction) => (
                <Button
                  key={planAction.id}
                  type="button"
                  variant={planAction.variant}
                  size="lg"
                  disabled={mutationPending}
                  onClick={callbacks[planAction.id]}
                  className={cn(...settingsPlanLayout.headerAction)}
                >
                  {planAction.label}
                </Button>
              ))}
            </div>
          ) : null}
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
          <div className={cn(...settingsPlanLayout.stage)}>
            <PlanMarkPanel policy={policy} />

            <div className={cn(...settingsPlanLayout.copyPanel)}>
              <div className={cn(...settingsPlanLayout.statusBlock)}>
                <p className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}>
                  {policy.statusCopy}
                </p>
                <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>{policy.detail}</p>
              </div>

              {policy.highlights.length > 0 ? (
                <div className={cn('space-y-3')}>
                  {policy.highlights.map((highlight) => (
                    <div
                      key={highlight}
                      className={cn(
                        'grid',
                        'grid-cols-[1.5rem_minmax(0,1fr)]',
                        'items-center',
                        'gap-x-2',
                        ...settingsPlanLayout.nestedShell,
                        'p-2.5',
                        'md:p-3'
                      )}
                    >
                      <Check
                        aria-hidden
                        className={cn(...controlIconWell.md, ...uiStatusRecipes.success.icon)}
                      />
                      <span
                        className={cn(
                          'min-w-0',
                          uiTypographyRecipes.bodyStrong,
                          uiTextRecipes.primary
                        )}
                      >
                        {highlight}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

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
                <div className={cn('flex', 'w-full', 'flex-col', 'gap-3')}>
                  <PricingTrialForm disabled={mutationPending} onStartTrial={onStartTrialRequest} />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className={cn(...settingsPlanLayout.headerAction)}
                    disabled={mutationPending}
                    onClick={onCancelTrialForm}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </GlassCard>
  );
}

export default PlanSectionView;
