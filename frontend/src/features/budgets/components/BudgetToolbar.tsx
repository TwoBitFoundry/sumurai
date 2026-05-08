import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Calendar as CalendarIcon, Loader2, Plus } from 'lucide-react';
import { Button, cn } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';

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
      className={cn(
        'flex',
        'flex-wrap',
        'items-center',
        'justify-between',
        'gap-3',
        'px-6',
        'py-4'
      )}
      data-testid="budget-toolbar"
    >
      <div className={cn('flex', 'items-center', 'gap-3')}>
        <div className={cn('flex', 'items-center', 'gap-2')}>
          <button
            type="button"
            onClick={onPreviousMonth}
            aria-label="Previous month"
            className={cn(designTokens.components.actions.paginationRound)}
            title="Previous month"
          >
            <ChevronLeftIcon className={cn('h-4', 'w-4')} />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Next month"
            className={cn(designTokens.components.actions.paginationRound)}
            title="Next month"
          >
            <ChevronRightIcon className={cn('h-4', 'w-4')} />
          </button>
        </div>
        <div
          className={cn(
            designTokens.typography.label,
            'text-slate-600',
            'transition-colors',
            'duration-500',
            'dark:text-slate-300'
          )}
        >
          {monthLabel}
        </div>
      </div>
      <div className={cn('flex', 'items-center', 'gap-3')}>
        <div
          className={cn(
            'inline-flex',
            'items-center',
            'gap-1',
            designTokens.typography.caption,
            'text-slate-500',
            'transition-colors',
            'duration-500',
            'dark:text-slate-400'
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
          className={cn('px-4')}
          title="Jump to current month"
        >
          <CalendarIcon className={cn('h-4', 'w-4')} />
          This Month
        </Button>
        {showAddButton && !isAdding ? (
          <Button type="button" onClick={onAddBudget} variant="primary" size="lg">
            <Plus className={cn('h-4', 'w-4')} />
            Add budget
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default BudgetToolbar;
