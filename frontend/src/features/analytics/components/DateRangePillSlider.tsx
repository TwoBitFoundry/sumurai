import { useMemo, useRef, useState } from 'react';
import { transactionsRowRecipes } from '@/features/transactions/components/transactionsRowRecipes';
import { Button, cn } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import {
  border as uiBorderRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import {
  type CustomDateRangeBounds,
  clampCustomDateRangeBounds,
  type DashboardDateBounds,
  type DateRangeKey as DateRange,
  defaultCustomDateRangeBounds,
  formatDateRangeLabel,
  resolveDateRange,
} from '@/utils/dateRanges';
import { CustomDateRangePicker } from './CustomDateRangePicker';

const options: Array<{ key: DateRange; label: string; hoverLabel: string }> = [
  { key: 'current-month', label: 'This mo', hoverLabel: 'Since this month' },
  { key: 'last-month', label: 'Last mo', hoverLabel: 'Since last month' },
  { key: 'ytd', label: 'YTD', hoverLabel: 'Since year start' },
];

function formatVisibleDateRangeLabel(
  dateRange: DateRange,
  customDateRange: CustomDateRangeBounds | null,
  dateBounds?: DashboardDateBounds | null
): string {
  const primary = formatDateRangeLabel(dateRange, customDateRange, dateBounds);
  if (primary && primary !== 'Custom') {
    return primary;
  }

  const resolved = resolveDateRange(dateRange, customDateRange, dateBounds);
  if (resolved.start && resolved.end) {
    return formatDateRangeLabel('custom', {
      start: resolved.start,
      end: resolved.end,
    });
  }

  return 'Custom';
}

function resolvePickerValue(
  dateRange: DateRange,
  customDateRange: CustomDateRangeBounds | null,
  dateBounds?: DashboardDateBounds | null
): CustomDateRangeBounds | null {
  if (dateRange === 'custom' && customDateRange) {
    return dateBounds ? clampCustomDateRangeBounds(customDateRange, dateBounds) : customDateRange;
  }

  const activeRange = resolveDateRange(dateRange, customDateRange, dateBounds);
  if (activeRange.start && activeRange.end) {
    return { start: activeRange.start, end: activeRange.end };
  }

  if (customDateRange) {
    return dateBounds ? clampCustomDateRangeBounds(customDateRange, dateBounds) : customDateRange;
  }

  return dateBounds ? defaultCustomDateRangeBounds(dateBounds) : null;
}

type DateRangePickerSnapshot = {
  dateRange: DateRange;
  customDateRange: CustomDateRangeBounds | null;
};

function restoreDateRangeSnapshot(
  snapshot: DateRangePickerSnapshot,
  onChange: (range: DateRange) => void,
  onCustomDateRangeChange: (bounds: CustomDateRangeBounds) => void
): void {
  if (snapshot.dateRange === 'custom' && snapshot.customDateRange) {
    onCustomDateRangeChange(snapshot.customDateRange);
    onChange('custom');
    return;
  }

  onChange(snapshot.dateRange);
}

export function DateRangeLabelPill({
  dateRange,
  customDateRange = null,
  dateBounds = null,
  dateBoundsLoading = false,
  onChange,
  onCustomDateRangeChange,
}: {
  dateRange: DateRange;
  customDateRange?: CustomDateRangeBounds | null;
  dateBounds?: DashboardDateBounds | null;
  dateBoundsLoading?: boolean;
  onChange: (range: DateRange) => void;
  onCustomDateRangeChange: (bounds: CustomDateRangeBounds) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerSnapshotRef = useRef<DateRangePickerSnapshot | null>(null);
  const appliedInSessionRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const rangeLabel = formatVisibleDateRangeLabel(dateRange, customDateRange ?? null, dateBounds);
  const pickerValue = useMemo(
    () => resolvePickerValue(dateRange, customDateRange, dateBounds),
    [customDateRange, dateBounds, dateRange]
  );

  const closePicker = (options?: { restore?: boolean }) => {
    const shouldRestore =
      options?.restore !== false && !appliedInSessionRef.current && pickerSnapshotRef.current;
    if (shouldRestore) {
      restoreDateRangeSnapshot(pickerSnapshotRef.current!, onChange, onCustomDateRangeChange);
    }
    pickerSnapshotRef.current = null;
    setPickerOpen(false);
  };

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="filterChip"
        size="sm"
        shape="pill"
        data-testid="date-range-label-pill"
        onClick={() => {
          if (pickerOpen) {
            closePicker();
            return;
          }

          pickerSnapshotRef.current = {
            dateRange,
            customDateRange: customDateRange ?? null,
          };
          appliedInSessionRef.current = false;
          setPickerOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={`Selected date range: ${rangeLabel}. Choose custom range`}
        aria-expanded={pickerOpen}
        className={cn(
          'whitespace-nowrap',
          transactionsRowRecipes.categoryFilterPill,
          ...transactionsRowRecipes.contextualFilterChipGlass,
          '!border-transparent',
          'dark:!border-transparent',
          '!bg-sky-500/20',
          'dark:!bg-sky-400/14',
          dateRange === 'custom' && [
            'ring-2',
            'ring-inset',
            'ring-sky-400/60',
            'dark:ring-sky-300/60',
          ]
        )}
      >
        <span
          className={cn(
            uiTypographyRecipes.badge,
            'normal-case',
            'tracking-normal',
            'text-sky-600',
            'dark:text-sky-200'
          )}
        >
          {rangeLabel}
        </span>
      </Button>
      <CustomDateRangePicker
        open={pickerOpen}
        anchorRef={buttonRef}
        value={pickerValue}
        bounds={dateBounds}
        loading={dateBoundsLoading}
        onApply={(bounds) => {
          appliedInSessionRef.current = true;
          onCustomDateRangeChange(bounds);
          onChange('custom');
        }}
        onRequestClose={closePicker}
      />
    </>
  );
}

export function DateRangePillSlider({
  dateRange,
  onChange,
}: {
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
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
                    ...appTitleBarRecipes.contextPillTabSize,
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
