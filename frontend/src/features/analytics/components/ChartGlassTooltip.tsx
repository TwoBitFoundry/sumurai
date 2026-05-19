import type { ReactNode } from 'react';
import type { TooltipContentProps } from 'recharts';
import {
  type DebouncedFadePresenceOptions,
  useDebouncedFadePresence,
} from '@/hooks/useDebouncedFadePresence';
import { cn } from '@/ui/primitives';
import { chartTooltip, text as uiTextRecipes } from '@/ui/recipes';

export function ChartTooltipShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(chartTooltip.shell, className)} role="tooltip">
      {children}
    </div>
  );
}

type ChartTooltipFadeHostProps<T> = {
  active: T | null | undefined;
  children: (content: T) => ReactNode;
  wrapperClassName?: string;
  presence?: DebouncedFadePresenceOptions;
};

export function ChartTooltipFadeHost<T>({
  active,
  children,
  wrapperClassName,
  presence,
}: ChartTooltipFadeHostProps<T>) {
  const { content, visible, fadeDurationMs } = useDebouncedFadePresence(active, presence);

  if (content == null) {
    return null;
  }

  return (
    <div
      className={cn(chartTooltip.fade, visible ? 'opacity-100' : 'opacity-0', wrapperClassName)}
      style={{ transitionDuration: `${fadeDurationMs}ms` }}
    >
      {children(content)}
    </div>
  );
}

export const chartTooltipRechartsContentStyle = {
  background: 'transparent',
  border: 'none',
  boxShadow: 'none',
  padding: 0,
  borderRadius: 'var(--radius-standard)',
} as const;

export const chartTooltipRechartsWrapperStyle = {
  background: 'transparent',
  border: 'none',
  boxShadow: 'none',
  padding: 0,
  outline: 'none',
  zIndex: 50,
  pointerEvents: 'none',
} as const;

export const chartTooltipRechartsProps = {
  contentStyle: chartTooltipRechartsContentStyle,
  wrapperStyle: chartTooltipRechartsWrapperStyle,
} as const;

type ChartGlassTooltipProps = TooltipContentProps<number, string> & {
  valueClassName?: string;
};

export function ChartGlassTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
  valueClassName,
}: ChartGlassTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const formattedLabel =
    label != null && label !== ''
      ? labelFormatter
        ? labelFormatter(label, payload)
        : label
      : null;

  return (
    <ChartTooltipShell>
      {formattedLabel ? <p className={cn(chartTooltip.label)}>{formattedLabel}</p> : null}
      {payload.map((entry, index) => {
        const rawValue = entry.value;
        const numericValue =
          typeof rawValue === 'number' ? rawValue : Number(rawValue ?? Number.NaN);
        const entryName = entry.name != null ? String(entry.name) : '';
        const rowKey = String(entry.dataKey ?? entryName) || `tooltip-row-${index}`;
        let displayValue = Number.isFinite(numericValue) ? String(rawValue) : '—';
        let displayName = entryName;

        if (formatter) {
          const formatted = formatter(numericValue, entryName, entry, index, payload);
          if (Array.isArray(formatted)) {
            displayValue = String(formatted[0] ?? '');
            displayName = String(formatted[1] ?? entryName);
          } else if (formatted != null) {
            displayValue = String(formatted);
          }
        }

        return (
          <p key={rowKey} className={cn(chartTooltip.row)}>
            {displayName ? <span>{displayName} : </span> : null}
            <span className={cn(valueClassName ?? uiTextRecipes.primary)}>{displayValue}</span>
          </p>
        );
      })}
    </ChartTooltipShell>
  );
}

export default ChartGlassTooltip;
