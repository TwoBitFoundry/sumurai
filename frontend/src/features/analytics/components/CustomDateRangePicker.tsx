import { type RefObject, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn, Input, modalDrawerSectionLabelClassName } from '@/ui/primitives';
import {
  floatingChromeGlass,
  modalDrawer,
  border as uiBorderRecipes,
  effect as uiEffectRecipes,
  radius as uiRadiusRecipes,
  surface as uiSurfaceRecipes,
} from '@/ui/recipes';
import type { CustomDateRangeBounds, DashboardDateBounds } from '@/utils/dateRanges';
import {
  clampCustomDateRangeBounds,
  defaultCustomDateRangeBounds,
  isValidCustomDateRange,
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!bounds) {
      setStartDate('');
      setEndDate('');
      setHasInteracted(false);
      return;
    }

    const defaults = clampCustomDateRangeBounds(
      value ?? defaultCustomDateRangeBounds(bounds),
      bounds
    );
    setStartDate(defaults.start);
    setEndDate(defaults.end);
    setHasInteracted(false);
  }, [bounds, open, value]);

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
      <div className={cn('border-b', 'p-4', ...uiBorderRecipes.divider)}>
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
            <div className={cn(modalDrawer.formRow)}>
              <div className={cn(modalDrawer.formField)}>
                <label
                  htmlFor="custom-date-range-start"
                  className={cn(modalDrawerSectionLabelClassName)}
                >
                  Start
                </label>
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
              <div className={cn(modalDrawer.formField)}>
                <label
                  htmlFor="custom-date-range-end"
                  className={cn(modalDrawerSectionLabelClassName)}
                >
                  End
                </label>
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
