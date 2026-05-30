export const CHART_PRIOR_MONTHS = 1;

export function shiftCalendarMonth(isoDate: string, deltaMonths: number): string {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) {
    return isoDate;
  }
  const date = new Date(parts.year, parts.month - 1 + deltaMonths, 1);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function chartSeriesStartDate(rangeStart: string, priorMonths = CHART_PRIOR_MONTHS): string {
  return shiftCalendarMonth(rangeStart, -priorMonths);
}

export function parseIsoDateParts(isoDate: string): { year: number; month: number } | null {
  const [yearPart, monthPart] = isoDate.slice(0, 10).split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export function generateMonthRange(startStr: string, endStr: string): string[] {
  const start = parseIsoDateParts(startStr);
  const end = parseIsoDateParts(endStr);
  if (!start || !end) {
    return [];
  }

  const months: string[] = [];
  const current = new Date(start.year, start.month - 1, 1);
  const endDate = new Date(end.year, end.month - 1, 1);

  while (current <= endDate) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

export function formatChartMonthLabel(monthKey: string): string {
  const parts = parseIsoDateParts(`${monthKey}-01`);
  if (!parts) {
    return monthKey;
  }
  const date = new Date(parts.year, parts.month - 1, 1);
  if (!Number.isFinite(date.getTime())) {
    return monthKey;
  }
  const shortMonth = date.toLocaleString('en-US', { month: 'short' });
  const shortYear = date.toLocaleString('en-US', { year: '2-digit' });
  return `${shortMonth} '${shortYear}`;
}
