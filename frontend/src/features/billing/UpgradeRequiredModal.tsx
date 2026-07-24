import { AlertTriangle } from 'lucide-react';
import { Alert, Button, cn, GlassCard, Modal } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

interface UpgradeRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewPlans: () => void;
}

export function UpgradeRequiredModal({ isOpen, onClose, onViewPlans }: UpgradeRequiredModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy="upgrade-required-title" size="md">
      <GlassCard
        variant="accent"
        rounded="xl"
        padding="lg"
        withInnerEffects={false}
        className="space-y-6"
      >
        <h2 id="upgrade-required-title" className="sr-only">
          Paid access required
        </h2>
        <Alert
          role="alert"
          variant="warning"
          title="Paid access required"
          icon={<AlertTriangle className={cn('h-5', 'w-5')} />}
          className="text-left"
        >
          <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
            Choose a plan to continue using your financial data.
          </p>
        </Alert>

        <div className={cn('flex', 'justify-end', 'gap-3')}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button type="button" variant="primary" onClick={onViewPlans}>
            View plans in Settings
          </Button>
        </div>
      </GlassCard>
    </Modal>
  );
}

export default UpgradeRequiredModal;
