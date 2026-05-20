import type React from 'react';
import { useId } from 'react';
import { Button, cn, GlassCard, Modal } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { useImportTransactions } from '../hooks/useImportTransactions';

export interface ImportModalAccount {
  id: string;
  name: string;
  mask: string;
}

interface ImportModalProps {
  account: ImportModalAccount;
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (count: number, mask: string) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  account,
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const titleId = useId();
  const workflow = useImportTransactions(account.id);
  const busy = workflow.status === 'validating' || workflow.status === 'importing';

  const handleClose = () => {
    workflow.reset();
    onClose();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      await workflow.validateFile(file);
    }
  };

  const handleImport = async () => {
    const result = await workflow.importFile();
    if (result) {
      onImportSuccess?.(result.imported_count, account.mask);
      handleClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? undefined : handleClose}
      labelledBy={titleId}
      preventCloseOnBackdrop={busy}
      size="md"
    >
      <GlassCard variant="accent" rounded="xl" padding="lg" withInnerEffects={false}>
        <div className={cn('space-y-5')}>
          <div className={cn('space-y-1')}>
            <h2 id={titleId} className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}>
              Import transactions
            </h2>
            <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
              {account.name} ••{account.mask}
            </p>
          </div>

          <label
            className={cn(
              'flex',
              'cursor-pointer',
              'flex-col',
              'items-center',
              'justify-center',
              'gap-2',
              'rounded-2xl',
              'border',
              'border-dashed',
              'border-[var(--color-border-control)]',
              'p-6',
              'text-center',
              uiTypographyRecipes.caption,
              uiTextRecipes.muted
            )}
          >
            <span>{workflow.selectedFile?.name ?? 'Choose a CSV, QBO, or QFX file'}</span>
            <input
              type="file"
              accept=".csv,.qbo,.qfx"
              className="sr-only"
              disabled={busy}
              onChange={handleFileChange}
            />
          </label>

          {workflow.validationResult?.valid ? (
            <div className={cn(uiTypographyRecipes.caption, uiTextRecipes.body)}>
              {workflow.validationResult.transaction_count} transactions ready to review.
            </div>
          ) : null}

          {workflow.error ? (
            <div className={cn(uiTypographyRecipes.captionStrong, uiTextRecipes.danger)}>
              {workflow.error}
            </div>
          ) : null}

          <div className={cn('flex', 'justify-end', 'gap-3')}>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleImport}
              disabled={workflow.status !== 'preview'}
            >
              {workflow.status === 'importing' ? 'Importing...' : 'Import transactions'}
            </Button>
          </div>
        </div>
      </GlassCard>
    </Modal>
  );
};

export default ImportModal;
