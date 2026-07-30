import { AlertTriangle } from 'lucide-react';
import {
  Alert,
  Button,
  FormLabel,
  GlassCard,
  Input,
  Modal,
  ModalDrawerHeader,
} from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

export const settingsConfirmationCodeTypography = 'font-mono font-bold';

interface DeleteAccountModalProps {
  isOpen: boolean;
  isDeleting: boolean;
  error: string | null;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteAccountModal({
  isOpen,
  isDeleting,
  error,
  confirmText,
  onConfirmTextChange,
  onConfirm,
  onClose,
}: DeleteAccountModalProps) {
  const inputVariant = confirmText && confirmText !== 'DELETE' ? 'invalid' : 'default';

  return (
    <Modal
      isOpen={isOpen}
      onClose={isDeleting ? undefined : onClose}
      labelledBy="delete-account-modal-title"
      size="md"
      preventCloseOnBackdrop={isDeleting}
    >
      <GlassCard variant="auth" padding="lg">
        <ModalDrawerHeader
          onClose={onClose}
          closeLabel="Close delete account dialog"
          closeDisabled={isDeleting}
        >
          <h2
            id="delete-account-modal-title"
            className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}
          >
            Delete Account?
          </h2>
        </ModalDrawerHeader>

        <Alert
          variant="error"
          title="All to be severed:"
          icon={<AlertTriangle className={cn('h-5', 'w-5')} />}
          className={cn('mb-6', 'mt-4')}
        >
          <ul className={cn('space-y-1', uiTypographyRecipes.caption)}>
            <li>• All bank connections</li>
            <li>• All transactions and bank information</li>
            <li>• All budgets and settings</li>
            <li>• Your user account and login credentials</li>
          </ul>
        </Alert>

        {error ? (
          <Alert variant="error" title="Deletion failed" className={cn('mb-4')}>
            {error}
          </Alert>
        ) : null}

        <div className={cn('mb-6', 'flex', 'flex-col', 'gap-3')}>
          <FormLabel htmlFor="confirm-delete">
            Type <span className={cn(settingsConfirmationCodeTypography)}>DELETE</span> to confirm
          </FormLabel>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(event) => onConfirmTextChange(event.target.value)}
            placeholder="DELETE"
            disabled={isDeleting}
            variant={inputVariant}
            data-variant={inputVariant}
          />
        </div>

        <div className={cn('flex', 'justify-center')}>
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={confirmText !== 'DELETE' || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete forever'}
          </Button>
        </div>
      </GlassCard>
    </Modal>
  );
}

export default DeleteAccountModal;
