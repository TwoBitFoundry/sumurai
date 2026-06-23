import { AlertTriangle } from 'lucide-react';
import { Alert, Button, cn, GlassCard, Modal } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

interface DemoExitWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DemoExitWarningModal({ isOpen, onConfirm, onCancel }: DemoExitWarningModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} labelledBy="demo-exit-warning-title" size="md">
      <GlassCard
        variant="accent"
        rounded="xl"
        padding="lg"
        withInnerEffects={false}
        className="space-y-6"
        data-testid="demo-exit-warning-modal"
      >
        <Alert
          id="demo-exit-warning-title"
          variant="warning"
          title="Leave demo mode?"
          icon={<AlertTriangle className={cn('h-5', 'w-5')} />}
          className="text-left"
        >
          <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
            Your demo accounts, transactions, budgets, and category changes will be deleted and you
            will start fresh.
          </p>
        </Alert>

        <div className={cn('flex', 'justify-end', 'gap-3')}>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm}>
            Continue
          </Button>
        </div>
      </GlassCard>
    </Modal>
  );
}

export default DemoExitWarningModal;
