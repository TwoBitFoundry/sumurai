import { normalizeSubscriptionCadence } from '@/domain/subscriptionCadences';

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

function ordinalDay(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${day}th`;
  }

  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export function formatSubscriptionDateLabel(
  isoDate: string,
  referenceDate: Date = new Date()
): string {
  const date = parseIsoDate(isoDate);
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
  const dayLabel = ordinalDay(date.getDate());

  if (date.getFullYear() === referenceDate.getFullYear()) {
    return `${monthLabel}, ${dayLabel}`;
  }

  const shortYear = String(date.getFullYear()).slice(-2);

  return `${monthLabel}, ${dayLabel} '${shortYear}`;
}

function addCadencePeriod(isoDate: string, cadence: string): string {
  const date = parseIsoDate(isoDate);
  const normalized = normalizeSubscriptionCadence(cadence) ?? 'monthly';

  switch (normalized) {
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'annual':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
      break;
  }

  return formatIsoDate(date);
}

export function computeSubscriptionNextDueDate(
  lastCharged: string,
  cadence: string,
  referenceDate: Date = new Date()
): string {
  const reference = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  let nextDue = addCadencePeriod(lastCharged, cadence);

  while (parseIsoDate(nextDue).getTime() <= reference.getTime()) {
    nextDue = addCadencePeriod(nextDue, cadence);
  }

  return nextDue;
}

function isSameMonth(leftIsoDate: string, rightIsoDate: string): boolean {
  const left = parseIsoDate(leftIsoDate);
  const right = parseIsoDate(rightIsoDate);

  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export type SubscriptionDateRangeDisplay = {
  since: string | null;
  nextDue: string;
};

export function getSubscriptionDateRangeDisplay(
  subscription: {
    first_charged: string;
    last_charged: string;
    cadence: string;
    occurrence_count: number;
  },
  referenceDate: Date = new Date()
): SubscriptionDateRangeDisplay {
  const nextDueIso = computeSubscriptionNextDueDate(
    subscription.last_charged,
    subscription.cadence,
    referenceDate
  );
  const nextDueLabel = formatSubscriptionDateLabel(nextDueIso, referenceDate);
  const sinceLabel = formatSubscriptionDateLabel(subscription.first_charged, referenceDate);

  if (!isSameMonth(subscription.first_charged, subscription.last_charged)) {
    return { since: sinceLabel, nextDue: nextDueLabel };
  }

  if (subscription.occurrence_count === 1 && !isSameMonth(subscription.first_charged, nextDueIso)) {
    return { since: sinceLabel, nextDue: nextDueLabel };
  }

  return { since: null, nextDue: nextDueLabel };
}

export function formatSubscriptionDateRangeLabel(
  subscription: {
    first_charged: string;
    last_charged: string;
    cadence: string;
    occurrence_count: number;
  },
  referenceDate: Date = new Date()
): string {
  const { since, nextDue } = getSubscriptionDateRangeDisplay(subscription, referenceDate);

  if (!since) {
    return nextDue;
  }

  return `${since} to ${nextDue}`;
}
