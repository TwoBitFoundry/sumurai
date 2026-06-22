import * as Slider from '@radix-ui/react-slider';
import type React from 'react';
import { border as uiBorderRecipes, surface as uiSurfaceRecipes } from '@/ui/recipes';
import { cn } from './utils';

export interface RangeSliderProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Slider.Root>, 'defaultValue' | 'value'> {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  onValueChangeCommitted?: (value: [number, number]) => void;
  disabled?: boolean;
  minStepsBetweenThumbs?: number;
  startAriaLabel?: string;
  endAriaLabel?: string;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  onValueChangeCommitted,
  disabled = false,
  minStepsBetweenThumbs = 0,
  startAriaLabel = 'Start value',
  endAriaLabel = 'End value',
  className,
  ...props
}: RangeSliderProps) {
  return (
    <Slider.Root
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      minStepsBetweenThumbs={minStepsBetweenThumbs}
      onValueChange={(nextValue) => onValueChange(nextValue as [number, number])}
      onValueCommit={(nextValue) => onValueChangeCommitted?.(nextValue as [number, number])}
      className={cn('relative', 'flex', 'h-8', 'w-full', 'items-center', 'touch-none', className)}
      data-testid="range-slider"
      {...props}
    >
      <Slider.Track
        className={cn(
          'relative',
          'h-2',
          'w-full',
          'rounded-full',
          'border',
          ...uiBorderRecipes.floatingChrome,
          ...uiSurfaceRecipes.insetWell
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none',
            'absolute',
            '-left-1',
            'top-1/2',
            'h-3',
            'w-3',
            '-translate-y-1/2',
            'rounded-full',
            'border',
            'border-[var(--color-border-strong)]',
            'bg-[var(--color-surface-elevated-card)]',
            'shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-border-glass)_25%,transparent)]',
            'dark:border-[var(--color-border-glass)]',
            'dark:bg-[var(--color-surface-elevated-card)]'
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none',
            'absolute',
            '-right-1',
            'top-1/2',
            'h-3',
            'w-3',
            '-translate-y-1/2',
            'rounded-full',
            'border',
            'border-[var(--color-border-strong)]',
            'bg-[var(--color-surface-elevated-card)]',
            'shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-border-glass)_25%,transparent)]',
            'dark:border-[var(--color-border-glass)]',
            'dark:bg-[var(--color-surface-elevated-card)]'
          )}
        />
        <Slider.Range
          className={cn('absolute', 'h-full', 'rounded-full', 'bg-[var(--color-brand-sky)]')}
        />
      </Slider.Track>
      <Slider.Thumb
        aria-label={startAriaLabel}
        className={cn(
          'block',
          'h-[1.125rem]',
          'w-[1.125rem]',
          'rounded-full',
          'border-2',
          'border-[var(--color-border-focus-active)]',
          'bg-[var(--color-surface-elevated-card)]',
          'shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-border-glass)_35%,transparent),0_8px_24px_color-mix(in_srgb,var(--color-effect-glass-shadow)_22%,transparent)]',
          'focus-visible:outline-none',
          'focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-border-focus-active)_22%,transparent),0_0_0_1px_color-mix(in_srgb,var(--color-border-glass)_35%,transparent),0_8px_24px_color-mix(in_srgb,var(--color-effect-glass-shadow)_22%,transparent)]',
          'disabled:cursor-not-allowed',
          'disabled:opacity-60'
        )}
      />
      <Slider.Thumb
        aria-label={endAriaLabel}
        className={cn(
          'block',
          'h-[1.125rem]',
          'w-[1.125rem]',
          'rounded-full',
          'border-2',
          'border-[var(--color-border-focus-active)]',
          'bg-[var(--color-surface-elevated-card)]',
          'shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-border-glass)_35%,transparent),0_8px_24px_color-mix(in_srgb,var(--color-effect-glass-shadow)_22%,transparent)]',
          'focus-visible:outline-none',
          'focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-border-focus-active)_22%,transparent),0_0_0_1px_color-mix(in_srgb,var(--color-border-glass)_35%,transparent),0_8px_24px_color-mix(in_srgb,var(--color-effect-glass-shadow)_22%,transparent)]',
          'disabled:cursor-not-allowed',
          'disabled:opacity-60'
        )}
      />
    </Slider.Root>
  );
}

export default RangeSlider;
