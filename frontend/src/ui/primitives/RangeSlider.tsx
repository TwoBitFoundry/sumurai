import type React from 'react';
import { border as uiBorderRecipes, surface as uiSurfaceRecipes } from '@/ui/recipes';
import styles from './RangeSlider.module.css';
import { cn } from './utils';

export interface RangeSliderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
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
  disabled = false,
  minStepsBetweenThumbs = 0,
  startAriaLabel = 'Start value',
  endAriaLabel = 'End value',
  className,
  ...props
}: RangeSliderProps) {
  const [start, end] = value;
  const span = Math.max(1, max - min);
  const clampedStart = Math.max(min, Math.min(start, max));
  const clampedEnd = Math.max(min, Math.min(end, max));
  const startPercent = ((clampedStart - min) / span) * 100;
  const endPercent = ((clampedEnd - min) / span) * 100;

  const handleStartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextStart = Math.min(Number(event.target.value), clampedEnd - minStepsBetweenThumbs);
    onValueChange([Math.max(min, nextStart), clampedEnd]);
  };

  const handleEndChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextEnd = Math.max(Number(event.target.value), clampedStart + minStepsBetweenThumbs);
    onValueChange([clampedStart, Math.min(max, nextEnd)]);
  };

  return (
    <div
      className={cn('relative', 'flex', 'h-8', 'items-center', className)}
      data-testid="range-slider"
      {...props}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none',
          'absolute',
          'left-0',
          'right-0',
          'top-1/2',
          'h-2',
          '-translate-y-1/2',
          'border',
          ...uiBorderRecipes.floatingChrome,
          ...uiSurfaceRecipes.insetWell,
          'rounded-full'
        )}
      />
      <div
        aria-hidden
        className={cn(
          'pointer-events-none',
          'absolute',
          'top-1/2',
          'h-2',
          '-translate-y-1/2',
          'bg-[var(--color-brand-sky)]',
          'dark:bg-[var(--color-brand-sky-dark)]',
          'rounded-full'
        )}
        style={{
          left: `${startPercent}%`,
          width: `${Math.max(0, endPercent - startPercent)}%`,
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clampedStart}
        onChange={handleStartChange}
        aria-label={startAriaLabel}
        disabled={disabled}
        className={styles.input}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clampedEnd}
        onChange={handleEndChange}
        aria-label={endAriaLabel}
        disabled={disabled}
        className={styles.input}
      />
    </div>
  );
}

export default RangeSlider;
