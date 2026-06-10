import type { FixedExpenseSummary } from '../types/api';
import { normalizeFixedExpenseCadence } from './fixedExpenseCadences';

export interface FixedExpenseHeroStats {
  monthlyTotal: number;
  yearToDate: number;
}

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonthsClamped(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const sourceLastDayOfMonth = lastDayOfMonth(date.getFullYear(), date.getMonth());
  const targetLastDayOfMonth = lastDayOfMonth(target.getFullYear(), target.getMonth());
  const preserveMonthEnd = date.getDate() >= 29 && date.getDate() === sourceLastDayOfMonth;
  const day = preserveMonthEnd
    ? targetLastDayOfMonth
    : Math.min(date.getDate(), targetLastDayOfMonth);

  return new Date(target.getFullYear(), target.getMonth(), day);
}

function advanceFixedExpenseChargeDate(isoDate: string, cadence: string): string {
  const date = parseIsoDate(isoDate);
  const normalized = normalizeFixedExpenseCadence(cadence) ?? 'monthly';
  switch (normalized) {
    case 'weekly':
      return formatIsoDate(addDays(date, 7));
    case 'biweekly':
      return formatIsoDate(addDays(date, 14));
    case 'quarterly':
      return formatIsoDate(addMonthsClamped(date, 3));
    case 'annual':
      return formatIsoDate(addMonthsClamped(date, 12));
    default:
      return formatIsoDate(addMonthsClamped(date, 1));
  }
}

function chargeAmountFromMonthly(monthlyCost: number, cadence: string): number {
  const normalized = normalizeFixedExpenseCadence(cadence) ?? 'monthly';
  switch (normalized) {
    case 'weekly':
      return monthlyCost * (12 / 52);
    case 'biweekly':
      return monthlyCost * (12 / 26);
    case 'quarterly':
      return monthlyCost * 3;
    case 'annual':
      return monthlyCost * 12;
    default:
      return monthlyCost;
  }
}

function monthBounds(month: Date): { start: string; end: string } {
  return {
    start: formatIsoDate(new Date(month.getFullYear(), month.getMonth(), 1)),
    end: formatIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
  };
}

export function resolveYtdReferenceDate(month: Date, today: Date = new Date()): Date {
  const monthEnd = startOfDay(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const todayStart = startOfDay(today);
  return monthEnd.getTime() > todayStart.getTime() ? todayStart : monthEnd;
}

function resolveMonthChargeUpperBound(month: Date, today: Date): string {
  const { end: monthEnd } = monthBounds(month);
  const todayIso = formatIsoDate(startOfDay(today));
  return monthEnd < todayIso ? monthEnd : todayIso;
}

function fastForwardToChargeWindow(
  summary: FixedExpenseSummary,
  rangeStart: string
): { chargeDate: string; advances: number } | null {
  let chargeDate = summary.first_charged;
  let advances = 0;

  while (chargeDate < rangeStart && chargeDate <= summary.last_charged) {
    if (advances >= summary.occurrence_count) {
      return null;
    }

    const next = advanceFixedExpenseChargeDate(chargeDate, summary.cadence);
    if (next <= chargeDate) {
      return null;
    }

    advances += 1;
    chargeDate = next;
  }

  if (chargeDate > summary.last_charged) {
    return null;
  }

  return { chargeDate, advances };
}

function isIsoDateInMonth(isoDate: string, month: Date): boolean {
  const { start, end } = monthBounds(month);
  return isoDate >= start && isoDate <= end;
}

function resolveMonthReferenceIso(month: Date, today: Date): string {
  const { start: monthStart, end: monthEnd } = monthBounds(month);
  const todayIso = formatIsoDate(startOfDay(today));
  if (todayIso < monthStart) {
    return monthStart;
  }
  if (todayIso > monthEnd) {
    return monthEnd;
  }
  return todayIso;
}

export function listScheduledChargeDatesInMonth(
  summary: Pick<FixedExpenseSummary, 'first_charged' | 'cadence'>,
  month: Date
): string[] {
  const { start: monthStart, end: monthEnd } = monthBounds(month);
  const dueDates: string[] = [];
  let chargeDate = summary.first_charged;
  let guard = 0;

  while (chargeDate < monthStart && guard < 512) {
    const next = advanceFixedExpenseChargeDate(chargeDate, summary.cadence);
    if (next <= chargeDate) {
      break;
    }
    chargeDate = next;
    guard += 1;
  }

  while (chargeDate <= monthEnd && guard < 512) {
    if (chargeDate >= monthStart) {
      dueDates.push(chargeDate);
    }
    const next = advanceFixedExpenseChargeDate(chargeDate, summary.cadence);
    if (next <= chargeDate) {
      break;
    }
    chargeDate = next;
    guard += 1;
  }

  return dueDates;
}

function listActualChargeDates(summary: FixedExpenseSummary): ReadonlySet<string> {
  const charges = new Set<string>();
  if (summary.occurrence_count <= 0) {
    return charges;
  }

  let chargeDate = summary.first_charged;
  let advances = 0;

  while (chargeDate <= summary.last_charged) {
    charges.add(chargeDate);

    if (advances >= summary.occurrence_count) {
      break;
    }

    const next = advanceFixedExpenseChargeDate(chargeDate, summary.cadence);
    if (next <= chargeDate) {
      break;
    }

    advances += 1;
    chargeDate = next;
  }

  return charges;
}

export type FixedExpenseDueDateStatus = 'paid' | 'upcoming' | 'missed';

export type FixedExpenseDueDateInMonth = {
  isoDate: string;
  day: number;
  status: FixedExpenseDueDateStatus;
};

export function listFixedExpenseDueDatesInMonth(
  summary: FixedExpenseSummary,
  month: Date,
  today: Date = new Date()
): FixedExpenseDueDateInMonth[] {
  const dueDates = listScheduledChargeDatesInMonth(summary, month);
  if (dueDates.length === 0) {
    return [];
  }

  const actualCharges = listActualChargeDates(summary);
  const { start: monthStart } = monthBounds(month);
  const todayIso = formatIsoDate(startOfDay(today));
  const isFutureMonth = todayIso < monthStart;
  const referenceIso = isFutureMonth ? null : resolveMonthReferenceIso(month, today);

  return dueDates.map((isoDate) => {
    const day = parseIsoDate(isoDate).getDate();

    if (actualCharges.has(isoDate)) {
      return { isoDate, day, status: 'paid' as const };
    }

    if (isFutureMonth || (referenceIso !== null && isoDate > referenceIso)) {
      return { isoDate, day, status: 'upcoming' as const };
    }

    return { isoDate, day, status: 'missed' as const };
  });
}

export function formatFixedExpenseDueDatesInMonth(
  summary: FixedExpenseSummary,
  month: Date,
  today: Date = new Date()
): string {
  const dueDates = listFixedExpenseDueDatesInMonth(summary, month, today);
  if (dueDates.length === 0) {
    return '';
  }

  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(month);

  return `${monthLabel} ${dueDates.map((entry) => entry.day).join(', ')}`;
}

function hasScheduledChargeInMonth(summary: FixedExpenseSummary, month: Date): boolean {
  return listScheduledChargeDatesInMonth(summary, month).length > 0;
}

export type FixedExpenseMonthState = 'paid' | 'due' | 'missed';

export function resolveFixedExpenseMonthState(
  summary: FixedExpenseSummary,
  month: Date,
  today: Date = new Date()
): FixedExpenseMonthState {
  const dueDates = listFixedExpenseDueDatesInMonth(summary, month, today);
  if (dueDates.length === 0) {
    return 'due';
  }

  if (dueDates.some((entry) => entry.status === 'missed')) {
    return 'missed';
  }

  if (dueDates.some((entry) => entry.status === 'upcoming')) {
    return 'due';
  }

  return 'paid';
}

export function hasFixedExpenseChargeInMonth(summary: FixedExpenseSummary, month: Date): boolean {
  if (summary.occurrence_count <= 0) {
    return false;
  }

  if (isIsoDateInMonth(summary.last_charged, month)) {
    return true;
  }

  return hasScheduledChargeInMonth(summary, month);
}

export function computeFixedExpenseMonthCost(
  summary: FixedExpenseSummary,
  month: Date,
  today: Date = new Date()
): number {
  const monthly = parseFloat(summary.monthly_cost);
  if (!Number.isFinite(monthly) || summary.occurrence_count <= 0) {
    return 0;
  }

  const { start: monthStart } = monthBounds(month);
  const monthEnd = resolveMonthChargeUpperBound(month, today);
  if (monthEnd < monthStart) {
    return 0;
  }

  const chargeAmount = chargeAmountFromMonthly(monthly, summary.cadence);
  const positioned = fastForwardToChargeWindow(summary, monthStart);
  if (!positioned) {
    return 0;
  }

  let total = 0;
  let chargeDate = positioned.chargeDate;
  let advances = positioned.advances;

  while (chargeDate <= monthEnd && chargeDate <= summary.last_charged) {
    if (chargeDate >= monthStart) {
      total += chargeAmount;
    }

    if (advances >= summary.occurrence_count) {
      break;
    }

    const next = advanceFixedExpenseChargeDate(chargeDate, summary.cadence);
    if (next <= chargeDate) {
      break;
    }

    advances += 1;
    chargeDate = next;
  }

  return total;
}

export function computeFixedExpenseYtdCost(
  summary: FixedExpenseSummary,
  referenceDate: Date = new Date()
): number {
  const monthly = parseFloat(summary.monthly_cost);
  if (!Number.isFinite(monthly) || summary.occurrence_count <= 0) {
    return 0;
  }

  const chargeAmount = chargeAmountFromMonthly(monthly, summary.cadence);
  const yearStart = `${referenceDate.getFullYear()}-01-01`;
  const refIso = formatIsoDate(startOfDay(referenceDate));
  const positioned = fastForwardToChargeWindow(summary, yearStart);
  if (!positioned) {
    return 0;
  }

  let total = 0;
  let chargeDate = positioned.chargeDate;
  let advances = positioned.advances;

  while (chargeDate <= refIso && chargeDate <= summary.last_charged) {
    if (chargeDate >= yearStart) {
      total += chargeAmount;
    }

    if (advances >= summary.occurrence_count) {
      break;
    }

    const next = advanceFixedExpenseChargeDate(chargeDate, summary.cadence);
    if (next <= chargeDate) {
      break;
    }

    advances += 1;
    chargeDate = next;
  }

  return total;
}

export class FixedExpenseCalculator {
  static computeFixedExpenseHeroStats(
    summaries: FixedExpenseSummary[],
    month: Date,
    today: Date = new Date()
  ): FixedExpenseHeroStats {
    const ytdRef = resolveYtdReferenceDate(month, today);

    const monthlyTotal = summaries.reduce(
      (sum, summary) => sum + computeFixedExpenseMonthCost(summary, month, today),
      0
    );

    const yearToDate = summaries.reduce(
      (sum, summary) => sum + computeFixedExpenseYtdCost(summary, ytdRef),
      0
    );

    return { monthlyTotal, yearToDate };
  }
}
