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
              shape="square"
              aria-label="Edit budgets"
              title="Edit budgets"
              className={cn(budgetActionButtonClasses, 'shrink-0')}
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
            aria-label="Add budget"
            title="Add budget"
            aria-expanded={isPickerOpen}
            aria-haspopup="dialog"
            className={cn(
              budgetActionButtonClasses,
              'normal-case',
              'max-md:aspect-square',
              'max-md:w-11',
              'max-md:gap-0',
              'max-md:px-0'
            )}
          >
            <Plus className={control.glyph.md} />
            <span className="hidden md:inline">Budget</span>
          </Button>
        </>
      )}
    </div>
  );
};

export default BudgetToolbar;
