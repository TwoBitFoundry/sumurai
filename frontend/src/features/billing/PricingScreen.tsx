'use client';

import { Crown, FlaskConical, Loader2, Rocket, Server } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useScrollDetection } from '@/hooks/useScrollDetection';
import { HeroSubtitleInfo } from '@/layouts/HeroSubtitleInfo';
import { pageLayoutRecipes } from '@/layouts/PageLayout';
import { AuthService } from '@/services/authService';
import type { BillingStatusResponse, BillingTrialStartRequest } from '@/types/api';
import { Alert, AppTitleBar, Button, GradientShell } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { appLayout, control } from '@/ui/recipes';
import type { BillingWorkflowState } from './billingWorkflow';
import { PricingPlanCard } from './PricingPlanCard';
import { PricingTrialForm } from './PricingTrialForm';
import { useBillingWorkflow } from './useBillingWorkflow';

export interface PricingScreenProps {
  billingStatus: BillingStatusResponse;
  onDemoActivated: () => void;
  onContinueToProviders: () => void;
  onLogout?: () => void;
}

export interface PricingScreenViewProps extends PricingScreenProps {
  workflowState: BillingWorkflowState;
  onActivateDemo: () => Promise<unknown>;
  onStartTrial: (request: BillingTrialStartRequest) => Promise<void>;
  onStartCheckout: () => Promise<void>;
  onRetry: () => Promise<void>;
}

const pricingPlanCtaButton = cn('w-auto', 'min-w-40');

const workflowErrorCopy = {
  trial_already_used: 'This account has already used its free trial.',
  rate_limited: 'Too many attempts. Please wait and try again.',
  sdk: 'Checkout could not open. Please try again.',
  network: 'We could not reach billing. Check your connection and try again.',
  request: 'Billing could not complete the request. Please try again.',
} as const;

function getPricingHeroSubtitle(billingStatus: BillingStatusResponse): string {
  const options = ['Start with sample data'];

  if (!billingStatus.billing_enabled) {
    options.push('connect your own infrastructure');
  } else {
    if (billingStatus.trials_enabled) {
      options.push('start a free trial');
    }
    options.push('upgrade to Premium');
  }

  if (options.length === 1) {
    return `${options[0]}.`;
  }

  if (options.length === 2) {
    return `${options[0]} or ${options[1]}.`;
  }

  const last = options.at(-1);
  const initial = options.slice(0, -1).join(', ');
  return `${initial}, or ${last}.`;
}

function PricingHero({ billingStatus }: { billingStatus: BillingStatusResponse }) {
  const title = 'Choose your Sumurai path';
  const subtitle = getPricingHeroSubtitle(billingStatus);

  return (
    <section className={cn(...pageLayoutRecipes.shell)}>
      <div className={cn(pageLayoutRecipes.shellSurface)}>
        <div className={cn(pageLayoutRecipes.innerRing)} />
      </div>
      <div className={cn('relative', 'z-10', 'flex', 'flex-col', 'gap-5')}>
        <div className={cn('min-w-0', 'max-w-2xl', 'space-y-3')}>
          <div className={cn(...pageLayoutRecipes.titleInlineHost)}>
            <h1 className={cn(pageLayoutRecipes.titleInlineHeading)}>{title}</h1>{' '}
            <HeroSubtitleInfo pageTitle={title} subtitle={subtitle} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function PricingScreenView({
  billingStatus,
  workflowState,
  onActivateDemo,
  onDemoActivated,
  onContinueToProviders,
  onLogout,
  onStartTrial,
  onStartCheckout,
  onRetry,
}: PricingScreenViewProps) {
  const scrolled = useScrollDetection();
  const isOnline = useOnlineStatus();
  const [trialFormOpen, setTrialFormOpen] = useState(false);
  const [demoActivating, setDemoActivating] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const activationHandled = useRef(false);
  const workflowBusy =
    workflowState.status === 'creating' ||
    workflowState.status === 'checkout_open' ||
    workflowState.status === 'waiting_activation';
  const actionsDisabled = workflowBusy || demoActivating;

  useEffect(() => {
    if (workflowState.status === 'activated' && !activationHandled.current) {
      activationHandled.current = true;
      onContinueToProviders();
    }
    if (workflowState.status === 'idle') {
      activationHandled.current = false;
    }
  }, [onContinueToProviders, workflowState.status]);

  const activateDemo = async () => {
    setDemoActivating(true);
    setDemoError(null);
    try {
      await onActivateDemo();
      onDemoActivated();
    } catch {
      setDemoError('Demo mode could not be activated. Please try again.');
    } finally {
      setDemoActivating(false);
    }
  };

  return (
    <GradientShell>
      <div className={cn('flex', 'min-h-screen', 'flex-col')}>
        <AppTitleBar
          state="onboarding"
          scrolled={scrolled}
          isOnline={isOnline}
          onLogout={onLogout}
        />

        <main className={cn('flex', 'flex-1', 'items-start', 'pt-3', 'pb-8', 'md:pt-6', 'lg:pt-8')}>
          <div
            className={cn(
              ...appLayout.contentShellWithGutter,
              'flex',
              'min-w-0',
              'flex-col',
              'gap-6'
            )}
          >
            <PricingHero billingStatus={billingStatus} />

            {workflowState.status === 'waiting_activation' ? (
              <Alert
                role="status"
                aria-label="Payment received"
                aria-live="polite"
                variant="info"
                title="Payment received"
                icon={<Loader2 aria-hidden className={cn(control.glyph.md, 'animate-spin')} />}
              >
                We are finishing setup. This usually takes only a moment.
              </Alert>
            ) : null}

            {workflowState.status === 'timeout' ? (
              <Alert
                role="alert"
                variant="warning"
                title="Activation is taking longer than expected"
              >
                <div className={cn('flex', 'flex-col', 'items-start', 'gap-3')}>
                  <p>Your payment may still be processing. Retry the status check.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void onRetry()}
                  >
                    Retry activation
                  </Button>
                </div>
              </Alert>
            ) : null}

            {workflowState.status === 'error' && workflowState.error ? (
              <Alert role="alert" variant="error" title="Billing needs attention">
                {workflowErrorCopy[workflowState.error.kind]}
              </Alert>
            ) : null}

            {demoError ? (
              <Alert role="alert" variant="error" title="Demo mode unavailable">
                {demoError}
              </Alert>
            ) : null}

            <div
              className={cn(
                'grid',
                'grid-cols-1',
                'gap-6',
                'md:grid-cols-2',
                billingStatus.billing_enabled && billingStatus.trials_enabled
                  ? 'lg:grid-cols-3'
                  : 'lg:grid-cols-2',
                'md:gap-4'
              )}
            >
              <PricingPlanCard
                meta="Explore at no cost"
                title="Demo mode"
                detail="See Sumurai in action with safe sample data. No financial account required."
                icon={FlaskConical}
                features={[
                  'Play around with demo data',
                  'Explore how all the features work first',
                  'Upgrade to connect real accounts',
                ]}
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className={pricingPlanCtaButton}
                  disabled={actionsDisabled}
                  onClick={() => void activateDemo()}
                >
                  {demoActivating ? (
                    <Loader2 aria-hidden className={cn(control.glyph.sm, 'animate-spin')} />
                  ) : null}
                  {billingStatus.is_demo_mode_active ? 'Return to demo mode' : 'Try demo mode'}
                </Button>
              </PricingPlanCard>

              {!billingStatus.billing_enabled ? (
                <PricingPlanCard
                  meta="Free"
                  title="Self Hosted"
                  detail="Free, with your own data on your own infrastructure."
                  icon={Server}
                  features={[
                    'Choose your own financial providers with BYOK options',
                    'Fully control your deployment and data destiny',
                    'Always free core Sumurai experience',
                  ]}
                >
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    className={pricingPlanCtaButton}
                    disabled={actionsDisabled}
                    onClick={onContinueToProviders}
                  >
                    Continue
                  </Button>
                </PricingPlanCard>
              ) : null}

              {billingStatus.billing_enabled && billingStatus.trials_enabled ? (
                <PricingPlanCard
                  meta="Free trial"
                  title="Free trial"
                  detail="Connect your data and explore Premium before your first charge."
                  icon={Rocket}
                  features={[
                    'Premium access during trial',
                    'Connect your own accounts',
                    'No card required to start',
                  ]}
                >
                  {trialFormOpen ? (
                    <PricingTrialForm disabled={actionsDisabled} onStartTrial={onStartTrial} />
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      className={pricingPlanCtaButton}
                      disabled={actionsDisabled}
                      onClick={() => setTrialFormOpen(true)}
                    >
                      Choose free trial
                    </Button>
                  )}
                </PricingPlanCard>
              ) : null}

              {billingStatus.billing_enabled ? (
                <PricingPlanCard
                  meta="$8 per month"
                  title="Premium"
                  detail="Your financial life, connected and ready for deeper planning."
                  icon={Crown}
                  features={[
                    'Connect your own accounts',
                    'Premium planning workflows',
                    'Secure managed billing',
                  ]}
                >
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    className={pricingPlanCtaButton}
                    disabled={actionsDisabled}
                    onClick={() => void onStartCheckout()}
                  >
                    {workflowState.status === 'creating' ? (
                      <Loader2 aria-hidden className={cn(control.glyph.sm, 'animate-spin')} />
                    ) : null}
                    Upgrade to Premium
                  </Button>
                </PricingPlanCard>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </GradientShell>
  );
}

export function PricingScreen(props: PricingScreenProps) {
  const workflow = useBillingWorkflow();
  const workflowState: BillingWorkflowState = {
    status: workflow.status,
    error: workflow.error,
    billingStatus: workflow.billingStatus,
  };
  const startCheckout = () => {
    if (!props.billingStatus.billing_enabled) {
      return Promise.resolve();
    }
    return workflow.startPremiumCheckout({
      token: props.billingStatus.paddle_client_token,
      environment: props.billingStatus.paddle_environment,
    });
  };

  return (
    <PricingScreenView
      {...props}
      workflowState={workflowState}
      onActivateDemo={AuthService.activateDemoModeOnboarding}
      onStartTrial={workflow.startCardlessTrial}
      onStartCheckout={startCheckout}
      onRetry={workflow.retry}
    />
  );
}
