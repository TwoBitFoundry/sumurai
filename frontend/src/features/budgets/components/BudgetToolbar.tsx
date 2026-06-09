import { Check, Loader2, Pencil, Plus } from 'lucide-react';
import type { RefObject } from 'react';
import { Button, cn } from '@/ui/primitives';
import { control, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

const budgetActionButtonClasses = cn('w-auto', 'shrink-0', 'whitespace-nowrap');

interface BudgetToolbarProps {
  loading: boolean;
  isPickerOpen: boolean;
  addButtonRef: RefObject<HTMLButtonElement | null>;
  onAddBudget: () => void;
  isEditing: boolean;
  canEdit: boolean;
  onStartEdit: () => void;
  onSaveEdit: () => void;
}

export const BudgetToolbar = ({
  loading,
  isPickerOpen,
  addButtonRef,
  onAddBudget,
  isEditing,
  canEdit,
  onStartEdit,
  onSaveEdit,
}: BudgetToolbarProps) => {
  return (
    <div className={cn('inline-flex', 'items-stretch', 'gap-3')} data-testid="budget-toolbar">
      <div
        className={cn(
          'flex',
          'items-center',
          'gap-1',
          uiTypographyRecipes.caption,
          uiTextRecipes.subtle,
          'transition-colors',
          'duration-500'
        )}
      >
        {loading && (
          <>
            <Loader2 className={cn('h-3.5', 'w-3.5', 'animate-spin')} aria-hidden="true" />
            Updating
          </>
        )}
      </div>
      {isEditing ? (
        <Button
          type="button"
          onClick={onSaveEdit}
          variant="success"
          size="md"
          aria-label="Save budgets"
          title="Save budgets"
          className={budgetActionButtonClasses}
        >
          <Check className={control.glyph.md} />
        </Button>
      ) : (
        <>
          {canEdit && (
            <Button
              type="button"
              onClick={onStartEdit}
              variant="secondary"
              size="md"
              aria-label="Edit budgets"
              title="Edit budgets"
              className={budgetActionButtonClasses}
            >
              <Pencil className={control.glyph.md} />
            </Button>
          )}
          <Button
            ref={addButtonRef}
            type="button"
            onClick={onAddBudget}
            variant="primary"
            size="md"
            aria-label="Budget"
            aria-expanded={isPickerOpen}
            aria-haspopup="dialog"
            className={budgetActionButtonClasses}
          >
            <Plus className={control.glyph.md} />
          </Button>
        </>
      )}
    </div>
  );
};

export default BudgetToolbar;
