import type { CustomCategory } from '@/types/api';
import { Button, cn, Modal } from '@/ui/primitives';
import { useDeleteCustomCategory } from '../hooks/useDeleteCustomCategory';

interface Props {
  open: boolean;
  category: CustomCategory | null;
  onRequestClose: () => void;
  onSuccess?: () => void;
}

export function DeleteCustomCategoryConfirm({ open, category, onRequestClose, onSuccess }: Props) {
  const { deleteCustomCategoryAsync, isPending, error } = useDeleteCustomCategory();

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
      labelledBy="delete-custom-category-title"
      description="Delete custom category confirmation"
      size="sm"
      className={cn(
        'rounded-[2rem]',
        'border',
        'border-white/65',
        'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_92%,white)]',
        'p-5',
        'shadow-[0_24px_60px_-36px_rgba(15,23,42,0.42)]',
        'backdrop-blur-2xl',
        'dark:border-white/10',
        'dark:bg-[#0f172a]/95'
      )}
    >
      <div className={cn('space-y-5')}>
        <div className={cn('space-y-2')}>
          <h2 id="delete-custom-category-title" className={cn('text-lg font-semibold')}>
            {category ? `Delete '${category.display_name}'?` : 'Delete custom category?'}
          </h2>
          <p className={cn('text-sm text-slate-600 dark:text-slate-300')}>
            Transactions in this category will fall back to their original assigned category.
          </p>
        </div>
        {error ? (
          <p className={cn('text-sm text-red-600 dark:text-red-300')}>
            {error instanceof Error ? error.message : 'Failed to delete category.'}
          </p>
        ) : null}
        <div className={cn('flex', 'items-center', 'justify-end', 'gap-3')}>
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
