import { type RefObject, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  cn,
  FormLabel,
  Input,
  modalDrawerSectionLabelClassName,
  RangeSlider,
} from '@/ui/primitives';
import {
  floatingChromeGlass,
  border as uiBorderRecipes,
  effect as uiEffectRecipes,
  radius as uiRadiusRecipes,
  surface as uiSurfaceRecipes,
} from '@/ui/recipes';
import type { CustomDateRangeBounds, DashboardDateBounds } from '@/utils/dateRanges';
import {
  clampCustomDateRangeBounds,
  dateRangeDaySpan,
  defaultCustomDateRangeBounds,
  isoDateToSliderOffset,
  isValidCustomDateRange,
  sliderOffsetToIsoDate,
  validateCustomDateRange,
} from '@/utils/dateRanges';

const POPOVER_GAP_PX = 8;

interface CustomDateRangePickerProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  value: CustomDateRangeBounds | null;
  bounds: DashboardDateBounds | null;
  loading?: boolean;
  onApply: (value: CustomDateRangeBounds) => void;
  onRequestClose: () => void;
}

type PopoverPosition = {
  bottom: number;
  left: number;
};

function formatPickerBoundLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function CustomDateRangePicker({
  open,
  anchorRef,
  value,
  bounds,
  loading = false,
  onApply,
  onRequestClose,
}: CustomDateRangePickerProps) {
  const [mounted, setMounted] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);
  const hasBounds = !!bounds;
  const boundsStart = bounds?.start;
  const boundsEnd = bounds?.end;
  const valueStart = value?.start;
  const valueEnd = value?.end;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!boundsStart || !boundsEnd) {
      setStartDate('');
      setEndDate('');
      setHasInteracted(false);
      return;
    }

    const activeBounds = { start: boundsStart, end: boundsEnd };
    const defaults = clampCustomDateRangeBounds(
      valueStart && valueEnd
        ? { start: valueStart, end: valueEnd }
        : defaultCustomDateRangeBounds(activeBounds),
      activeBounds
    );
    setStartDate(defaults.start);
    setEndDate(defaults.end);
    setHasInteracted(false);
  }, [boundsEnd, boundsStart, open, valueEnd, valueStart]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const dialog = document.querySelector('[data-testid="custom-date-range-picker-popover"]');

      if (
        anchorRef.current &&
        !anchorRef.current.contains(target) &&
        dialog &&
        !dialog.contains(target)
      ) {
        onRequestClose();
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [anchorRef, onRequestClose, open]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const trigger = anchorRef.current;
      if (!trigger) {
        return;
      }
      const triggerRect = trigger.getBoundingClientRect();
      setPopoverPosition({
        bottom: window.innerHeight - triggerRect.top + POPOVER_GAP_PX,
        left: triggerRect.left + triggerRect.width / 2,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef, open]);

  const isValid = useMemo(
    () => isValidCustomDateRange(startDate, endDate, bounds),
    [bounds, endDate, startDate]
  );
  const validationMessage =
    hasInteracted && !isValid ? validateCustomDateRange(startDate, endDate, bounds) : null;
  const sliderValue = useMemo<[number, number]>(() => {
    if (!bounds) {
      return [0, 0];
    }

    const safeBounds = clampCustomDateRangeBounds(
      {
        start: startDate || bounds.start,
        end: endDate || bounds.end,
      },
      bounds
    );

    return [
      isoDateToSliderOffset(safeBounds.start, bounds),
      isoDateToSliderOffset(safeBounds.end, bounds),
    ];
  }, [bounds, endDate, startDate]);

  const handleStartChange = (nextStart: string) => {
    setHasInteracted(true);
    setStartDate(nextStart);
    if (isValidCustomDateRange(nextStart, endDate, bounds)) {
      onApply({ start: nextStart, end: endDate });
    }
  };

  const handleEndChange = (nextEnd: string) => {
    setHasInteracted(true);
    setEndDate(nextEnd);
    if (isValidCustomDateRange(startDate, nextEnd, bounds)) {
      onApply({ start: startDate, end: nextEnd });
    }
  };

  const handleSliderChange = (nextValue: [number, number]) => {
    if (!bounds) {
      return;
    }

    const nextStart = sliderOffsetToIsoDate(nextValue[0], bounds);
    const nextEnd = sliderOffsetToIsoDate(nextValue[1], bounds);

    setHasInteracted(true);
    setStartDate(nextStart);
    setEndDate(nextEnd);
  };

  const handleSliderCommit = (nextValue: [number, number]) => {
    if (!bounds) {
      return;
    }

    const nextStart = sliderOffsetToIsoDate(nextValue[0], bounds);
    const nextEnd = sliderOffsetToIsoDate(nextValue[1], bounds);

    onApply({ start: nextStart, end: nextEnd });
  };

  if (!mounted || !open || !popoverPosition) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-label="Custom date range"
      data-testid="custom-date-range-picker-popover"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onRequestClose();
        }
      }}
      style={{
        bottom: popoverPosition.bottom,
        left: popoverPosition.left,
        transform: 'translateX(-50%)',
      }}
      className={cn(
        'fixed',
        'z-50',
        'w-[min(calc(100vw-2rem),24rem)]',
        'flex',
        'flex-col',
        'overflow-hidden',
        uiRadiusRecipes.standard,
        'border',
        ...uiBorderRecipes.floatingChrome,
        ...uiSurfaceRecipes.floatingChromePanel,
        ...uiEffectRecipes.glassDropShadow,
        ...floatingChromeGlass.backdrop
      )}
    >
      <div className={cn('p-4')}>
        <p className={cn(modalDrawerSectionLabelClassName)}>Custom range</p>
      </div>
      <div data-testid="custom-date-range-picker-content" className={cn('flex flex-col gap-3 p-4')}>
        {loading ? (
          <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>
            Checking available dates...
          </p>
        ) : !hasBounds ? (
          <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>
            No dated transactions are available for this account selection.
          </p>
        ) : (
          <>
            <div className={cn('grid', 'grid-cols-2', 'gap-3')}>
              <div className={cn('space-y-2')}>
                <FormLabel htmlFor="custom-date-range-start">Start</FormLabel>
                <Input
                  id="custom-date-range-start"
                  type="date"
                  aria-label="Start date"
                  value={startDate}
                  min={bounds.start}
                  max={bounds.end}
                  onChange={(event) => handleStartChange(event.target.value)}
                  variant={validationMessage ? 'floatingChromeInvalid' : 'floatingChrome'}
                />
              </div>
              <div className={cn('space-y-2')}>
                <FormLabel htmlFor="custom-date-range-end">End</FormLabel>
                <Input
                  id="custom-date-range-end"
                  type="date"
                  aria-label="End date"
                  value={endDate}
                  min={bounds.start}
                  max={bounds.end}
                  onChange={(event) => handleEndChange(event.target.value)}
                  variant={validationMessage ? 'floatingChromeInvalid' : 'floatingChrome'}
                />
              </div>
            </div>
            <RangeSlider
              min={0}
              max={Math.max(0, dateRangeDaySpan(bounds) - 1)}
              value={sliderValue}
              onValueChange={handleSliderChange}
              onValueChangeCommitted={handleSliderCommit}
              startAriaLabel="Start date slider"
              endAriaLabel="End date slider"
            />
            <div
              className={cn(
                'flex',
                'items-center',
                'justify-between',
                'gap-3',
                'px-1',
                'text-xs',
                'text-slate-500',
                'dark:text-slate-400'
              )}
              data-testid="custom-date-range-picker-bounds"
            >
              <span>{formatPickerBoundLabel(bounds.start)}</span>
              <span>{formatPickerBoundLabel(bounds.end)}</span>
            </div>
            {validationMessage ? (
              <p className={cn('text-sm text-red-600 dark:text-red-300')}>{validationMessage}</p>
            ) : null}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export default CustomDateRangePicker;
