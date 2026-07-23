import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { BILLING_STATUS_QUERY_KEY, useBillingStatus } from '@/features/billing/useBillingStatus';
import { useBillingWorkflow } from '@/features/billing/useBillingWorkflow';
import { BillingService } from '@/services/BillingService';
import type { BillingStatusResponse, BillingTrialStartRequest } from '@/types/api';
import { dispatchNavigateToAccounts } from '@/utils/events';
import { CancelMembershipModal } from './CancelMembershipModal';
import { PlanSectionView } from './PlanSectionView';
import { resolvePlanPolicy } from './planPolicy';

const workflowErrorCopy = {
  trial_already_used: 'This account has already used its free trial.',
  rate_limited: 'Too many attempts. Please wait and try again.',
  sdk: 'Checkout could not open. Please try again.',
  network: 'We could not reach billing. Check your connection and try again.',
  request: 'Billing could not complete the request. Please try again.',
} as const;

export function PlanSection() {
  const queryClient = useQueryClient();
  const billingStatus = useBillingStatus();
  const workflow = useBillingWorkflow();
  const [trialFormOpen, setTrialFormOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [portalPending, setPortalPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const policy = billingStatus.data ? resolvePlanPolicy(billingStatus.data) : null;
  const queryError =
    billingStatus.isError && billingStatus.error instanceof Error
      ? billingStatus.error.message
      : billingStatus.isError
        ? 'Billing could not be reached.'
        : null;
  const workflowPending =
    workflow.status === 'creating' ||
    workflow.status === 'checkout_open' ||
    workflow.status === 'waiting_activation';
  const workflowError =
    workflow.status === 'error' && workflow.error
      ? workflowErrorCopy[workflow.error.kind]
      : workflow.status === 'timeout'
        ? 'Plan activation is taking longer than expected.'
        : null;
  const pending = workflowPending || cancelPending || portalPending;

  useEffect(() => {
    if (workflow.status === 'activated') {
      setTrialFormOpen(false);
      setMutationError(null);
    }
  }, [workflow.status]);

  const paddleConfig = () => {
    if (!billingStatus.data?.billing_enabled) {
      return null;
    }
    return {
      token: billingStatus.data.paddle_client_token,
      environment: billingStatus.data.paddle_environment,
    };
  };

  const startTrial = async (request: BillingTrialStartRequest) => {
    setMutationError(null);
    await workflow.startCardlessTrial(request);
  };

  const upgradePremium = async () => {
    const config = paddleConfig();
    if (!config || !billingStatus.data?.billing_enabled) {
      return;
    }
    setMutationError(null);
    if (billingStatus.data.access_status === 'trialing') {
      await workflow.startTrialPaymentMethod(config);
      return;
    }
    await workflow.startPremiumCheckout(config);
  };

  const updatePaymentMethod = async () => {
    const config = paddleConfig();
    if (!config) {
      return;
    }
    setMutationError(null);
    await workflow.startPastDueRecovery(config);
  };

  const cancelMembership = async () => {
    if (cancelPending) {
      return;
    }
    setCancelPending(true);
    setMutationError(null);
    try {
      const response = await BillingService.cancelSubscription();
      queryClient.setQueryData<BillingStatusResponse>(BILLING_STATUS_QUERY_KEY, (current) =>
        current?.billing_enabled
          ? { ...current, scheduled_cancel_at: response.scheduled_cancel_at }
          : current
      );
      setCancelConfirmOpen(false);
      await billingStatus.refetch();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Cancellation failed. Try again.');
    } finally {
      setCancelPending(false);
    }
  };

  const manageBilling = async () => {
    if (portalPending) {
      return;
    }
    setPortalPending(true);
    setMutationError(null);
    try {
      const session = await BillingService.createPortalSession();
      window.open(session.overview_url, '_blank', 'noopener');
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Billing portal unavailable.');
    } finally {
      setPortalPending(false);
    }
  };

  return (
    <>
      <PlanSectionView
        policy={policy}
        isLoading={billingStatus.isPending}
        queryError={queryError}
        isEmpty={!billingStatus.isPending && !billingStatus.isError && !billingStatus.data}
        mutationPending={pending}
        mutationError={mutationError ?? workflowError}
        mutationRetryLabel={workflow.status === 'timeout' ? 'Retry activation' : undefined}
        trialFormOpen={trialFormOpen}
        onRetry={() => void billingStatus.refetch()}
        onRetryMutation={workflow.status === 'timeout' ? () => void workflow.retry() : undefined}
        onStartTrialRequest={startTrial}
        onCancelTrialForm={() => setTrialFormOpen(false)}
        onSwitchSelfHosted={dispatchNavigateToAccounts}
        onStartTrial={() => {
          setMutationError(null);
          setTrialFormOpen(true);
        }}
        onUpgradePremium={() => void upgradePremium()}
        onUpdatePaymentMethod={() => void updatePaymentMethod()}
        onCancelMembership={() => {
          setMutationError(null);
          setCancelConfirmOpen(true);
        }}
        onManageBilling={() => void manageBilling()}
      />
      <CancelMembershipModal
        isOpen={cancelConfirmOpen}
        isPending={cancelPending}
        error={mutationError}
        onConfirm={() => void cancelMembership()}
        onClose={() => {
          if (!cancelPending) {
            setCancelConfirmOpen(false);
            setMutationError(null);
          }
        }}
      />
    </>
  );
}

export default PlanSection;
