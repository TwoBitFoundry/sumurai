import { Button, cn } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import type { DateRangeKey as DateRange } from '@/utils/dateRanges';

const options: Array<{ key: DateRange; label: string }> = [
  { key: 'current-month', label: '1M' },
  { key: 'past-2-months', label: '2M' },
  { key: 'past-3-months', label: '3M' },
  { key: 'past-6-months', label: '6M' },
  { key: 'past-year', label: '1Y' },
  { key: 'all-time', label: '5Y' },
];

export function DateRangePillSlider({
  dateRange,
  onChange,
}: {
  dateRange: DateRange;
  onChange: (r: DateRange) => void;
}) {
  return (
    <div
      className={cn(
        ...appTitleBarRecipes.pillContainer,
        ...appTitleBarRecipes.contextPillInset,
        ...appTitleBarRecipes.pillContainerSize,
        'min-w-0',
        'w-full',
        'max-w-full',
        'overflow-x-auto'
      )}
    >
      {options.map((option) => {
        const isActive = option.key === dateRange;

        return (
          <Button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            variant={isActive ? 'tabActive' : 'tab'}
            size="inherit"
            className={cn(
              ...appTitleBarRecipes.contextPillTab,
              ...appTitleBarRecipes.contextPillTabSize,
              'shrink-0',
              isActive ? uiTextRecipes.inverse : uiTextRecipes.primary
            )}
            aria-pressed={isActive}
          >
            <span className={cn('relative z-10', uiTypographyRecipes.bodyStrong)}>
              {option.label}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
