import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import type { CustomCategory } from '@/types/api';
import { Button, cn, Modal, ModalDrawerHeader } from '@/ui/primitives';
import { useDeleteCustomCategory } from '../hooks/useDeleteCustomCategory';

interface Props {
  open: boolean;
  category: CustomCategory | null;
  onRequestClose: () => void;
  onSuccess?: () => void;
}

export function DeleteCustomCategoryConfirm({ open, category, onRequestClose, onSuccess }: Props) {
  const { deleteCustomCategoryAsync, isPending, error } = useDeleteCustomCategory();
  const { isMobile } = useViewportBreakpoint();

  const handleDelete = async () => {
    if (!category) {
      return;
    }

    await deleteCustomCategoryAsync(category.id);
    onSuccess?.();
    onRequestClose();
  };

  return (
    <Modal
      isOpen={open}
      onClose={onRequestClose}
      presentation={isMobile ? 'drawer' : 'centered'}
      labelledBy="delete-custom-category-title"
      description="Delete custom category confirmation"
      data-testid={isMobile ? 'delete-custom-category-sheet' : 'delete-custom-category-dialog'}
      size="sm"
      containerClassName={
        isMobile
          ? cn(
              'p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]'
            )
          : undefined
      }
      className={cn(
        isMobile
          ? 'w-full max-w-none rounded-b-none rounded-t-[2rem] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5'
          : 'rounded-[2rem] p-5',
        'border',
        'border-white/65',
        'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_92%,white)]',
        'shadow-[0_24px_60px_-36px_rgba(15,23,42,0.42)]',
        'backdrop-blur-2xl',
        'dark:border-white/10',
        'dark:bg-[#0f172a]/95'
      )}
    >
      <div className={cn('space-y-5')}>
        {isMobile ? (
          <ModalDrawerHeader
            closeWithDialog
            onClose={onRequestClose}
            closeLabel="Close delete category dialog"
          >
            <h2 id="delete-custom-category-title" className={cn('text-lg font-semibold')}>
              {category ? `Delete '${category.display_name}'?` : 'Delete custom category?'}
            </h2>
          </ModalDrawerHeader>
        ) : (
          <div className={cn('space-y-2')}>
            <h2 id="delete-custom-category-title" className={cn('text-lg font-semibold')}>
              {category ? `Delete '${category.display_name}'?` : 'Delete custom category?'}
            </h2>
          </div>
        )}
        <p className={cn('text-sm text-slate-600 dark:text-slate-300')}>
          Transactions in this category will fall back to their original assigned category.
        </p>
        {error ? (
          <p className={cn('text-sm text-red-600 dark:text-red-300')}>
            {error instanceof Error ? error.message : 'Failed to delete category.'}
          </p>
        ) : null}
        <div
          className={cn(
            'flex',
            'gap-3',
            isMobile ? 'flex-col-reverse' : 'items-center justify-end'
          )}
        >
          <Button type="button" variant="secondary" onClick={onRequestClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              void handleDelete();
            }}
            disabled={!category || isPending}
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default DeleteCustomCategoryConfirm;
