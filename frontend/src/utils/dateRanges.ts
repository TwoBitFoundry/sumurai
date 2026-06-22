/**
 * Preset date ranges used by analytics filters.
 */

export type CustomDateRangeBounds = {
  start: string;
  end: string;
};

export type DashboardDateBounds = CustomDateRangeBounds;

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

function parseIsoDateLocal(isoDate: string): Date | null {
  const [yearPart, monthPart, dayPart] = isoDate.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  return date;
}

function shiftIsoDateLocal(isoDate: string, days: number): string {
  const date = parseIsoDateLocal(isoDate);
  if (!date) {
    return isoDate;
  }
  date.setDate(date.getDate() + days);
  return formatIsoDateLocal(date);
}

function clampIsoDate(isoDate: string, bounds?: DashboardDateBounds | null): string {
  if (!bounds) {
    return isoDate;
  }
  if (isoDate < bounds.start) {
    return bounds.start;
  }
  if (isoDate > bounds.end) {
    return bounds.end;
  }
  return isoDate;
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
  bounds?: DashboardDateBounds | null
): string | null {
  const maxDate = bounds?.end ?? todayIsoDateLocal();

  if (!start || !end) {
    return null;
  }
  if (bounds && start < bounds.start) {
    return 'Start date cannot be before the earliest available date.';
  }
  if (bounds && end < bounds.start) {
    return 'End date cannot be before the earliest available date.';
  }
  if (end > maxDate) {
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
  bounds?: DashboardDateBounds | null
): boolean {
  return validateCustomDateRange(start, end, bounds) === null;
}

export function clampCustomDateRangeBounds(
  bounds: CustomDateRangeBounds,
  dateBounds?: DashboardDateBounds | null
): CustomDateRangeBounds {
  const maxDate = dateBounds?.end ?? todayIsoDateLocal();
  const minDate = dateBounds?.start;
  let end = bounds.end > maxDate ? maxDate : bounds.end;

  if (minDate && end < minDate) {
    end = minDate;
  }

  let start = bounds.start;
  if (minDate && start < minDate) {
    start = minDate;
  }
  if (start > maxDate) {
    start = maxDate;
  }
  if (start > end) {
    start = end;
  }

  return { start, end };
}

export function defaultCustomDateRangeBounds(
  dateBounds?: DashboardDateBounds | null
): CustomDateRangeBounds {
  if (dateBounds) {
    const end = dateBounds.end;
    const rollingStart = shiftIsoDateLocal(end, -29);
    return clampCustomDateRangeBounds({ start: rollingStart, end }, dateBounds);
  }

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return { start: formatIsoDateLocal(start), end: formatIsoDateLocal(now) };
}

export function resolveDateRange(
  key?: DateRangeKey,
  customBounds?: CustomDateRangeBounds | null,
  dateBounds?: DashboardDateBounds | null
): { start?: string; end?: string } {
  if (key === 'custom') {
    if (customBounds?.start && customBounds?.end) {
      return clampCustomDateRangeBounds(customBounds, dateBounds);
    }
    return {};
  }

  if (key === 'all-time' && dateBounds) {
    return dateBounds;
  }

  const computed = computeDateRange(key);
  if (!computed.start || !computed.end || !dateBounds) {
    return computed;
  }

  return clampCustomDateRangeBounds(
    {
      start: computed.start,
      end: computed.end,
    },
    dateBounds
  );
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
  customBounds?: CustomDateRangeBounds | null,
  dateBounds?: DashboardDateBounds | null
): string {
  const { start, end } = resolveDateRange(key, customBounds, dateBounds);
  if (!start || !end) {
    return key === 'custom' ? 'Custom' : '';
  }
  if (start === end) {
    return formatAnalyticsDateLabel(start);
  }
  return `${formatAnalyticsDateLabel(start)} – ${formatAnalyticsDateLabel(end)}`;
}

export function dateRangeDaySpan(bounds: DashboardDateBounds): number {
  const startDate = parseIsoDateLocal(bounds.start);
  const endDate = parseIsoDateLocal(bounds.end);
  if (!startDate || !endDate) {
    return 1;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1);
}

export function isoDateToSliderOffset(isoDate: string, bounds: DashboardDateBounds): number {
  const clamped = clampIsoDate(isoDate, bounds);
  const startDate = parseIsoDateLocal(bounds.start);
  const clampedDate = parseIsoDateLocal(clamped);

  if (!startDate || !clampedDate) {
    return 0;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((clampedDate.getTime() - startDate.getTime()) / msPerDay));
}

export function sliderOffsetToIsoDate(offset: number, bounds: DashboardDateBounds): string {
  const clampedOffset = Math.min(dateRangeDaySpan(bounds) - 1, Math.max(0, Math.round(offset)));
  return shiftIsoDateLocal(bounds.start, clampedOffset);
}
