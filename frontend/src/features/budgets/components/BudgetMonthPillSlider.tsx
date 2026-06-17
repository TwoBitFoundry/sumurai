import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Button, cn, Pill } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { chromeBar, border as uiBorderRecipes, text as uiTextRecipes } from '@/ui/recipes';

interface BudgetMonthPillSliderProps {
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
}

export function BudgetMonthLabelPill({ monthLabel }: { monthLabel: string }) {
  return (
    <Pill
      variant="status"
      tone="info"
      className="!border-0"
      aria-label={`Selected budget month: ${monthLabel}`}
    >
      {monthLabel}
    </Pill>
  );
}

const pillControlClassName = cn(
  ...appTitleBarRecipes.pillTab,
  ...uiBorderRecipes.floatingChrome,
  'h-full',
  'w-9',
  'md:w-8',
  'lg:w-7',
  '!px-0',
  'shrink-0',
  uiTextRecipes.muted
);

export function BudgetMonthPillSlider({
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
        ...appTitleBarRecipes.bottomBarShadow,
        'min-w-0',
        'w-fit',
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
    </div>
  );
}

export default BudgetMonthPillSlider;
