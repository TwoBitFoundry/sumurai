import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Calendar as CalendarIcon, Loader2, Plus } from 'lucide-react';
import { Button, cn, PaginationButton } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

const budgetActionButtonClasses = cn('shrink-0', 'whitespace-nowrap', 'h-10', 'px-4', 'py-2');

interface BudgetToolbarProps {
  monthLabel: string;
  loading: boolean;
  isAdding: boolean;
  showAddButton: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
  onAddBudget: () => void;
}

export const BudgetToolbar = ({
  monthLabel,
  loading,
  isAdding,
  showAddButton,
  onPreviousMonth,
  onNextMonth,
  onCurrentMonth,
  onAddBudget,
}: BudgetToolbarProps) => {
  return (
    <div
      className={cn('flex', 'flex-wrap', 'items-start', 'justify-between', 'gap-3')}
      data-testid="budget-toolbar"
    >
      <div className={cn('flex', 'items-center', 'gap-3')}>
        <div className={cn('flex', 'items-center', 'gap-2')}>
          <PaginationButton
            type="button"
            onClick={onPreviousMonth}
            aria-label="Previous month"
            title="Previous month"
          >
            <ChevronLeftIcon className={cn('h-4', 'w-4')} />
          </PaginationButton>
          <PaginationButton
            type="button"
            onClick={onNextMonth}
            aria-label="Next month"
            title="Next month"
          >
            <ChevronRightIcon className={cn('h-4', 'w-4')} />
          </PaginationButton>
        </div>
        <div
          className={cn(
            uiTypographyRecipes.label,
            uiTextRecipes.muted,
            'transition-colors',
            'duration-500'
          )}
        >
          {monthLabel}
        </div>
      </div>
      <div
        className={cn('flex', 'items-center', 'gap-3', 'flex-nowrap', 'overflow-x-auto', 'pb-1')}
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
          type="button"
          onClick={onCurrentMonth}
          variant="ghost"
          size="md"
          className={budgetActionButtonClasses}
          title="Jump to current month"
        >
          <CalendarIcon className={cn('h-4', 'w-4')} />
          This Month
        </Button>
        {showAddButton && !isAdding ? (
          <Button
            type="button"
            onClick={onAddBudget}
            variant="primary"
            size="md"
            className={budgetActionButtonClasses}
          >
            <Plus className={cn('h-4', 'w-4')} />
            Add budget
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default BudgetToolbar;
