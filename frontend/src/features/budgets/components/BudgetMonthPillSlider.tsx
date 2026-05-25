import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { LONGEST_BUDGET_MONTH_LABEL } from '@/features/budgets/hooks/useBudgetMonth';
import { Button, cn } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { chromeBar, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

interface BudgetMonthPillSliderProps {
  monthLabel: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
}

const pillControlClassName = cn(
  ...appTitleBarRecipes.pillTab,
  ...appTitleBarRecipes.pillTabSize,
  'h-full',
  'shrink-0',
  uiTextRecipes.muted
);

export function BudgetMonthPillSlider({
  monthLabel,
  onPreviousMonth,
  onNextMonth,
  onCurrentMonth,
}: BudgetMonthPillSliderProps) {
  return (
    <div
      className={cn(
        ...appTitleBarRecipes.pillContainer,
        ...appTitleBarRecipes.pillInset,
        ...appTitleBarRecipes.pillContainerSize,
        'min-w-0',
        'w-full',
        'max-w-full',
        'overflow-x-auto'
      )}
      data-no-swipe
      data-testid="budget-month-pill-slider"
    >
      <Button
        type="button"
        onClick={onPreviousMonth}
        variant="tab"
        size="sm"
        aria-label="Previous month"
        title="Previous month"
        className={pillControlClassName}
      >
        <span className={cn('relative', 'z-10', ...chromeBar.glyphWell)}>
          <ChevronLeftIcon className={chromeBar.glyph} />
        </span>
      </Button>
      <Button
        type="button"
        onClick={onCurrentMonth}
        variant="tab"
        size="sm"
        aria-label="This month"
        title="Jump to current month"
        className={pillControlClassName}
      >
        <span className={cn('relative', 'z-10', ...chromeBar.glyphWell)}>
          <CalendarIcon className={chromeBar.glyph} />
        </span>
      </Button>
      <Button
        type="button"
        onClick={onNextMonth}
        variant="tab"
        size="sm"
        aria-label="Next month"
        title="Next month"
        className={pillControlClassName}
      >
        <span className={cn('relative', 'z-10', ...chromeBar.glyphWell)}>
          <ChevronRightIcon className={chromeBar.glyph} />
        </span>
      </Button>
      <span
        className={cn(
          'inline-grid',
          'h-full',
          'shrink-0',
          'items-center',
          'px-2',
          uiTypographyRecipes.bodyStrong,
          uiTextRecipes.primary
        )}
      >
        <span
          className={cn('invisible', 'col-start-1', 'row-start-1', 'whitespace-nowrap')}
          aria-hidden
        >
          {LONGEST_BUDGET_MONTH_LABEL}
        </span>
        <span
          className={cn('col-start-1', 'row-start-1', 'justify-self-start', 'whitespace-nowrap')}
        >
          {monthLabel}
        </span>
      </span>
    </div>
  );
}

export default BudgetMonthPillSlider;
