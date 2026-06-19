import { Button, cn, Pill } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import {
  border as uiBorderRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { type DateRangeKey as DateRange, formatDateRangeLabel } from '@/utils/dateRanges';

const options: Array<{ key: DateRange; label: string; hoverLabel: string }> = [
  { key: 'current-month', label: '1M', hoverLabel: '1 month' },
  { key: 'past-2-months', label: '2M', hoverLabel: '2 month' },
  { key: 'past-3-months', label: '3M', hoverLabel: '3 month' },
  { key: 'past-6-months', label: '6M', hoverLabel: '6 month' },
  { key: 'past-year', label: '1Y', hoverLabel: '1 year' },
  { key: 'all-time', label: '5Y', hoverLabel: '5 year' },
];

export function DateRangeLabelPill({ dateRange }: { dateRange: DateRange }) {
  const rangeLabel = formatDateRangeLabel(dateRange);

  return (
    <Pill
      variant="status"
      tone="info"
      className="!border-0"
      aria-label={`Selected date range: ${rangeLabel}`}
    >
      {rangeLabel}
    </Pill>
  );
}

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
        ...appTitleBarRecipes.bottomBarShadow,
        'min-w-0',
        'w-fit',
        'max-w-full',
        'overflow-x-auto'
      )}
      data-testid="date-range-pill-slider"
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
            title={option.hoverLabel}
            aria-label={option.hoverLabel}
            aria-pressed={isActive}
            className={cn(
              ...appTitleBarRecipes.contextPillTab,
              'shrink-0',
              isActive
                ? [...appTitleBarRecipes.contextPillTabSize, uiTextRecipes.inverse]
                : [
                    ...uiBorderRecipes.floatingChrome,
                    '!px-0',
                    'aspect-square',
                    uiTextRecipes.primary,
                  ]
            )}
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
