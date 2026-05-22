import { Loader2, Plus } from 'lucide-react';
import type { RefObject } from 'react';
import { Button, cn } from '@/ui/primitives';
import { control, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

const budgetActionButtonClasses = cn('shrink-0', 'whitespace-nowrap');

interface BudgetToolbarProps {
  loading: boolean;
  isPickerOpen: boolean;
  addButtonRef: RefObject<HTMLButtonElement | null>;
  onAddBudget: () => void;
}

export const BudgetToolbar = ({
  loading,
  isPickerOpen,
  addButtonRef,
  onAddBudget,
}: BudgetToolbarProps) => {
  return (
    <div
      className={cn('flex', 'items-center', 'justify-end', 'gap-3')}
      data-testid="budget-toolbar"
    >
      <div
        className={cn(
          'inline-flex',
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
      <Button
        ref={addButtonRef}
        type="button"
        onClick={onAddBudget}
        variant="primary"
        size="md"
        aria-expanded={isPickerOpen}
        aria-haspopup="dialog"
        className={budgetActionButtonClasses}
      >
        <Plus className={control.glyph.md} />
        Add budget
      </Button>
    </div>
  );
};

export default BudgetToolbar;
