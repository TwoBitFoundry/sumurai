/**
 * Preset date ranges used by analytics filters.
 */

export type CustomDateRangeBounds = {
  start: string;
  end: string;
};

export type DateRangeKey =
  | 'current-month'
  | 'last-month'
  | 'ytd'
  | 'custom'
  | 'past-2-months'
  | 'past-3-months'
  | 'past-6-months'
  | 'past-year'
  | 'all-time';

export const DEFAULT_DASHBOARD_DATE_RANGE: DateRangeKey = 'last-month';

export function computeDateRange(key?: DateRangeKey): { start?: string; end?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstOfMonth = (year: number, month0: number) => new Date(year, month0, 1);
  const lastOfMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0);
  const fmt = formatIsoDateLocal;

  switch (key) {
    case 'current-month': {
      const start = firstOfMonth(y, m);
      const end = now;
      return { start: fmt(start), end: fmt(end) };
    }
    case 'last-month': {
      const start = firstOfMonth(y, m - 1);
      const end = now;
      return { start: fmt(start), end: fmt(end) };
    }
    case 'ytd': {
      const start = firstOfMonth(y, 0);
      const end = now;
      return { start: fmt(start), end: fmt(end) };
    }
    case 'custom':
      return {};
    case 'past-2-months': {
      const start = firstOfMonth(y, m - 1);
      const end = lastOfMonth(y, m);
      return { start: fmt(start), end: fmt(end) };
    }
    case 'past-3-months': {
      const start = firstOfMonth(y, m - 2);
      const end = lastOfMonth(y, m);
      return { start: fmt(start), end: fmt(end) };
    }
    case 'past-6-months': {
      const start = firstOfMonth(y, m - 5);
      const end = lastOfMonth(y, m);
      return { start: fmt(start), end: fmt(end) };
    }
    case 'past-year': {
      const start = firstOfMonth(y, m - 11);
      const end = lastOfMonth(y, m);
      return { start: fmt(start), end: fmt(end) };
    }
    case 'all-time': {
      const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      return { start: fmt(fiveYearsAgo), end: fmt(now) };
    }
    default:
      return {};
  }
}

export function formatIsoDateLocal(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function todayIsoDateLocal(): string {
  return formatIsoDateLocal(new Date());
}

export function validateCustomDateRange(
  start: string,
  end: string,
  today: string = todayIsoDateLocal()
): string | null {
  if (!start || !end) {
    return null;
  }
  if (end > today) {
    return 'End date cannot be after today.';
  }
  if (start > end) {
    return 'Choose a start date on or before the end date.';
  }
  return null;
}

export function isValidCustomDateRange(
  start: string,
  end: string,
  today: string = todayIsoDateLocal()
): boolean {
  return validateCustomDateRange(start, end, today) === null;
}

export function clampCustomDateRangeBounds(
  bounds: CustomDateRangeBounds,
  today: string = todayIsoDateLocal()
): CustomDateRangeBounds {
  const end = bounds.end > today ? today : bounds.end;
  const start = bounds.start > end ? end : bounds.start;
  return { start, end };
}

export function defaultCustomDateRangeBounds(): CustomDateRangeBounds {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return { start: formatIsoDateLocal(start), end: formatIsoDateLocal(now) };
}

export function resolveDateRange(
  key?: DateRangeKey,
  customBounds?: CustomDateRangeBounds | null
): { start?: string; end?: string } {
  if (key === 'custom') {
    if (customBounds?.start && customBounds?.end) {
      return { start: customBounds.start, end: customBounds.end };
    }
    return {};
  }
  return computeDateRange(key);
}

function formatAnalyticsDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateRangeLabel(
  key: DateRangeKey,
  customBounds?: CustomDateRangeBounds | null
): string {
  const { start, end } = resolveDateRange(key, customBounds);
  if (!start || !end) {
    return key === 'custom' ? 'Custom' : '';
  }
  if (start === end) {
    return formatAnalyticsDateLabel(start);
  }
  return `${formatAnalyticsDateLabel(start)} – ${formatAnalyticsDateLabel(end)}`;
}
