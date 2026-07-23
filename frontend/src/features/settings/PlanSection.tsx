import { useBillingStatus } from '@/features/billing/useBillingStatus';
import { PlanSectionView } from './PlanSectionView';
import { resolvePlanPolicy } from './planPolicy';

const noop = () => {};

export function PlanSection() {
  const billingStatus = useBillingStatus();
  const policy = billingStatus.data ? resolvePlanPolicy(billingStatus.data) : null;
  const queryError =
    billingStatus.isError && billingStatus.error instanceof Error
      ? billingStatus.error.message
      : billingStatus.isError
        ? 'Billing could not be reached.'
        : null;

  return (
    <PlanSectionView
      policy={policy}
      isLoading={billingStatus.isPending}
      queryError={queryError}
      isEmpty={!billingStatus.isPending && !billingStatus.isError && !billingStatus.data}
      mutationPending={false}
      mutationError={null}
      onRetry={() => void billingStatus.refetch()}
      onSwitchSelfHosted={noop}
      onStartTrial={noop}
      onUpgradePremium={noop}
      onUpdatePaymentMethod={noop}
      onCancelMembership={noop}
      onManageBilling={noop}
    />
  );
}

export default PlanSection;
