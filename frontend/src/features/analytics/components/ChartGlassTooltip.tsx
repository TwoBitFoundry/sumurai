import type { ReactNode } from 'react';
import { isValidElement } from 'react';
import type { TooltipContentProps } from 'recharts';
import {
  type DebouncedFadePresenceOptions,
  useDebouncedFadePresence,
} from '@/hooks/useDebouncedFadePresence';
import { cn } from '@/ui/primitives';
import { chartTooltip, font, text as uiTextRecipes } from '@/ui/recipes';

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
  labelClassName?: string;
  valueClassNameForEntry?: (
    entry: NonNullable<TooltipContentProps<number, string>['payload']>[number],
    index: number
  ) => string | undefined;
};

export function ChartGlassTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
  valueClassName,
  labelClassName,
  valueClassNameForEntry,
}: ChartGlassTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const formattedLabel = labelFormatter
    ? labelFormatter(label ?? '', payload)
    : label != null && label !== ''
      ? label
      : null;
  const labelUsesCustomContent = isValidElement(formattedLabel);

  return (
    <ChartTooltipShell>
      {formattedLabel != null && formattedLabel !== '' ? (
        <p
          className={cn(
            labelClassName
              ? font.caption
              : labelUsesCustomContent
                ? font.caption
                : chartTooltip.label,
            labelClassName
          )}
        >
          {formattedLabel}
        </p>
      ) : null}
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

        const rowValueClassName =
          valueClassNameForEntry?.(entry, index) ?? valueClassName ?? uiTextRecipes.primary;
        const usesColoredValue =
          valueClassNameForEntry != null ||
          (valueClassName != null && valueClassName !== uiTextRecipes.primary);

        return (
          <p key={rowKey} className={cn(usesColoredValue ? font.caption : chartTooltip.row)}>
            {displayName ? (
              <span className={cn(usesColoredValue ? uiTextRecipes.body : undefined)}>
                {displayName} :{' '}
              </span>
            ) : null}
            <span className={cn(rowValueClassName)}>{displayValue}</span>
          </p>
        );
      })}
    </ChartTooltipShell>
  );
}

export default ChartGlassTooltip;
