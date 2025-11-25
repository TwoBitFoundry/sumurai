export type DateRangeKey =
  | "current-month"
  | "past-2-months"
  | "past-3-months"
  | "past-6-months"
  | "past-year"
  | "all-time";

export function computeDateRange(key?: DateRangeKey): { start?: string; end?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const firstOfMonth = (year: number, month0: number) => new Date(year, month0, 1);
  const lastOfMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (key) {
    case 'current-month': {
      return { start: fmt(firstOfMonth(y, m)), end: fmt(lastOfMonth(y, m)) };
    }
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

