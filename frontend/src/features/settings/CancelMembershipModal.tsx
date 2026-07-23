import { AlertTriangle } from 'lucide-react';
import { Alert, Button, cn, GlassCard, Modal } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

interface CancelMembershipModalProps {
  isOpen: boolean;
  isPending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function CancelMembershipModal({
  isOpen,
  isPending,
  error,
  onConfirm,
  onClose,
}: CancelMembershipModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isPending ? undefined : onClose}
      labelledBy="cancel-membership-title"
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
        <h2 id="cancel-membership-title" className="sr-only">
          Cancel membership?
        </h2>
        <Alert
          variant="warning"
          title="Cancel membership?"
          icon={<AlertTriangle className={cn('h-5', 'w-5')} aria-hidden />}
        >
          <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
            Premium remains available through the current billing period. Your membership will not
            renew after that date.
          </p>
        </Alert>

        {error ? (
          <Alert role="alert" variant="error" title="Cancellation failed">
            {error}
          </Alert>
        ) : null}

        <div className={cn('flex', 'justify-end', 'gap-3')}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Keep membership
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Canceling…' : 'Cancel membership'}
          </Button>
        </div>
      </GlassCard>
    </Modal>
  );
}

export default CancelMembershipModal;
