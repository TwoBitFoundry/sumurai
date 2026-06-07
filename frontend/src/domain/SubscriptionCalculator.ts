import type { SubscriptionSummary } from '../types/api';
import { normalizeSubscriptionCadence } from './subscriptionCadences';

export interface SubscriptionHeroStats {
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

function advanceSubscriptionChargeDate(isoDate: string, cadence: string): string {
  const date = parseIsoDate(isoDate);
  const normalized = normalizeSubscriptionCadence(cadence) ?? 'monthly';
  switch (normalized) {
    case 'quarterly':
      return formatIsoDate(addMonthsClamped(date, 3));
    case 'annual':
      return formatIsoDate(addMonthsClamped(date, 12));
    default:
      return formatIsoDate(addMonthsClamped(date, 1));
  }
}

function chargeAmountFromMonthly(monthlyCost: number, cadence: string): number {
  const normalized = normalizeSubscriptionCadence(cadence) ?? 'monthly';
  switch (normalized) {
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
  summary: SubscriptionSummary,
  rangeStart: string
): { chargeDate: string; advances: number } | null {
  let chargeDate = summary.first_charged;
  let advances = 0;

  while (chargeDate < rangeStart && chargeDate <= summary.last_charged) {
    if (advances >= summary.occurrence_count) {
      return null;
    }

    const next = advanceSubscriptionChargeDate(chargeDate, summary.cadence);
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

export function computeSubscriptionMonthCost(
  summary: SubscriptionSummary,
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

    const next = advanceSubscriptionChargeDate(chargeDate, summary.cadence);
    if (next <= chargeDate) {
      break;
    }

    advances += 1;
    chargeDate = next;
  }

  return total;
}

export function computeSubscriptionYtdCost(
  summary: SubscriptionSummary,
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

    const next = advanceSubscriptionChargeDate(chargeDate, summary.cadence);
    if (next <= chargeDate) {
      break;
    }

    advances += 1;
    chargeDate = next;
  }

  return total;
}

export class SubscriptionCalculator {
  static computeSubscriptionHeroStats(
    summaries: SubscriptionSummary[],
    month: Date,
    today: Date = new Date()
  ): SubscriptionHeroStats {
    const ytdRef = resolveYtdReferenceDate(month, today);

    const monthlyTotal = summaries.reduce(
      (sum, summary) => sum + computeSubscriptionMonthCost(summary, month, today),
      0
    );

    const yearToDate = summaries.reduce(
      (sum, summary) => sum + computeSubscriptionYtdCost(summary, ytdRef),
      0
    );

    return { monthlyTotal, yearToDate };
  }
}
