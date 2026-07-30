import { PricingTrialForm } from '@/features/billing/PricingTrialForm';
import type { BillingTrialStartRequest } from '@/types/api';
import { Alert, Button, cn, GlassCard, Modal } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

interface TrialStartModalProps {
  isOpen: boolean;
  isPending: boolean;
  error: string | null;
  onStartTrial: (request: BillingTrialStartRequest) => Promise<void>;
  onClose: () => void;
}

export function TrialStartModal({
  isOpen,
  isPending,
  error,
  onStartTrial,
  onClose,
}: TrialStartModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isPending ? undefined : onClose}
      labelledBy="start-trial-title"
      size="md"
      preventCloseOnBackdrop={isPending}
      onEscapeKeyDown={isPending ? (event) => event.preventDefault() : undefined}
    >
      <GlassCard
        variant="accent"
        rounded="xl"
        padding="lg"
        withInnerEffects={false}
        className="space-y-6"
      >
        <div className={cn('space-y-2')}>
          <h2
            id="start-trial-title"
            className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}
          >
            Start your free trial
          </h2>
          <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
            Confirm your billing location to connect your own financial accounts.
          </p>
        </div>

        {error ? (
          <Alert role="alert" variant="error" title="Trial could not start">
            {error}
          </Alert>
        ) : null}

        <PricingTrialForm disabled={isPending} onStartTrial={onStartTrial} />

        <div className={cn('flex', 'justify-end')}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </GlassCard>
    </Modal>
  );
}

export default TrialStartModal;
