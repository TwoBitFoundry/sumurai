import { compareInstitutionNames } from '@/domain/institutionSort';

export { compareInstitutionNames as compareBankNames } from '@/domain/institutionSort';

export function sortBanksAlphabetically<T extends { bankName: string }>(banks: readonly T[]): T[] {
  return [...banks].sort((left, right) => compareInstitutionNames(left.bankName, right.bankName));
}

export function safeBalanceAmount(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function formatBalancesAxisValue(n: number) {
  if (!Number.isFinite(n)) {
    return '0';
  }
  const sign = n < 0 ? '-' : '';
  const absolute = Math.abs(n);
  if (absolute >= 1e12) return `${sign}${Math.round(absolute / 1e12)}T`;
  if (absolute >= 1e9) {
    const rounded = Math.round(absolute / 1e9);
    if (rounded >= 1000) return `${sign}1T`;
    return `${sign}${rounded}B`;
  }
  if (absolute >= 1e6) {
    const rounded = Math.round(absolute / 1e6);
    if (rounded >= 1000) return `${sign}1B`;
    return `${sign}${rounded}M`;
  }
  if (absolute >= 1e4) {
    const rounded = Math.round(absolute / 1e3);
    if (rounded >= 1000) return `${sign}1M`;
    return `${sign}${rounded}k`;
  }
  return `${sign}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(absolute)}`;
}

function niceAxisStep(rawStep: number) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  if (norm <= 1) return mag;
  if (norm <= 2) return 2 * mag;
  if (norm <= 5) return 5 * mag;
  return 10 * mag;
}

const NEGATIVE_DOMAIN_MIN_SHARE = 0.15;

export function expandNegativeDomainForLabelSpace(
  actualNegativeBound: number,
  positiveBound: number,
  minShare = NEGATIVE_DOMAIN_MIN_SHARE
) {
  if (actualNegativeBound <= 0 || positiveBound <= 0) {
    return 0;
  }

  const minNegativeBound = (positiveBound * minShare) / (1 - minShare);
  const targetBound = Math.max(actualNegativeBound, minNegativeBound);
  if (targetBound <= actualNegativeBound + 1e-9) {
    return actualNegativeBound;
  }

  const step = niceAxisStep(targetBound / 2);
  const intervals = Math.max(1, Math.ceil(targetBound / step));
  return step * intervals;
}

function enumerateNiceSteps(minStep: number, maxStep: number): number[] {
  const lower = Math.max(minStep, 1e-9);
  const upper = Math.max(maxStep, lower);
  const steps = new Set<number>();
  let magnitude = 10 ** Math.floor(Math.log10(lower));

  while (magnitude <= upper * 10) {
    for (const multiplier of [1, 2, 2.5, 5, 10]) {
      const step = multiplier * magnitude;
      if (step >= lower && step <= upper) {
        steps.add(step);
      }
    }
    magnitude *= 10;
  }

  return [...steps].sort((left, right) => left - right);
}

function isBetterAxisFit(
  domainBound: number,
  tickCount: number,
  maxTicks: number,
  best: { domainBound: number; ticks: number[] } | null
): boolean {
  if (!best) {
    return true;
  }

  if (domainBound < best.domainBound - 1e-9) {
    return true;
  }
  if (domainBound > best.domainBound + 1e-9) {
    return false;
  }

  const bestTickCount = best.ticks.length;
  const candidateInBudget = tickCount <= maxTicks;
  const bestInBudget = bestTickCount <= maxTicks;

  if (candidateInBudget && !bestInBudget) {
    return true;
  }
  if (!candidateInBudget && bestInBudget) {
    return false;
  }
  if (candidateInBudget && bestInBudget) {
    return tickCount > bestTickCount;
  }
  return tickCount < bestTickCount;
}

function computeCoarseInBudgetAxis(
  maxValue: number,
  maxTicks: number
): { domainBound: number; ticks: number[] } {
  const safeMaxTicks = Math.max(2, maxTicks);

  for (let intervals = safeMaxTicks - 1; intervals >= 1; intervals -= 1) {
    const step = niceAxisStep(maxValue / intervals);
    const domainBound = step * intervals;
    if (domainBound + 1e-9 < maxValue) {
      continue;
    }
    const ticks = Array.from({ length: intervals + 1 }, (_, index) => index * step);
    return { domainBound, ticks };
  }

  return { domainBound: maxValue, ticks: [0, maxValue] };
}

function computeTightSignedAxis(
  maxValue: number,
  minTicks: number,
  maxTicks: number
): { domainBound: number; ticks: number[] } {
  if (maxValue <= 0) {
    return { domainBound: 0, ticks: [0] };
  }

  const safeMinTicks = Math.max(2, minTicks);
  const safeMaxTicks = Math.max(safeMinTicks, maxTicks);
  const idealStep = maxValue / (safeMinTicks - 1);
  const candidateStepSet = new Set(enumerateNiceSteps(idealStep / 10, maxValue));
  if (safeMaxTicks <= 2) {
    candidateStepSet.add(maxValue);
  }
  const candidateSteps = [...candidateStepSet].sort((left, right) => left - right);

  let best: { domainBound: number; ticks: number[] } | null = null;

  for (const step of candidateSteps) {
    const intervals = Math.ceil(maxValue / step);
    const tickCount = intervals + 1;
    if (tickCount < safeMinTicks) {
      continue;
    }

    const domainBound = step * intervals;
    const ticks = Array.from({ length: tickCount }, (_, index) => index * step);
    const topTick = ticks[ticks.length - 1] ?? 0;
    if (topTick < maxValue) {
      continue;
    }

    const exceedsBudget = tickCount > safeMaxTicks;
    if (
      exceedsBudget &&
      best &&
      domainBound >= best.domainBound - 1e-9 &&
      best.ticks.length <= safeMaxTicks
    ) {
      continue;
    }

    if (isBetterAxisFit(domainBound, tickCount, safeMaxTicks, best)) {
      best = { domainBound, ticks };
    }
  }

  if (best) {
    if (best.ticks.length > safeMaxTicks) {
      return computeCoarseInBudgetAxis(maxValue, safeMaxTicks);
    }
    return best;
  }

  const fallbackStep = niceAxisStep(maxValue);
  return { domainBound: fallbackStep, ticks: [0, fallbackStep] };
}

function allocateTickBudgets(
  maxPositive: number,
  maxNegativeAbs: number,
  totalTicks: number
): { positiveMaxTicks: number; negativeMaxTicks: number } {
  if (maxNegativeAbs <= 0) {
    return { positiveMaxTicks: totalTicks, negativeMaxTicks: 0 };
  }
  if (maxPositive <= 0) {
    return { positiveMaxTicks: 0, negativeMaxTicks: totalTicks };
  }

  const negativeMaxTicks = 2;
  const positiveMaxTicks = Math.max(2, totalTicks - negativeMaxTicks + 1);

  return { positiveMaxTicks, negativeMaxTicks };
}

export function balancesYTickCount(chartInnerHeight: number) {
  const count = Math.min(13, Math.max(9, Math.floor(chartInnerHeight / 18)));
  return count % 2 === 0 ? count - 1 : count;
}

export function symmetricZeroAxisTicks(
  maxExtent: number,
  tickCount: number
): { ticks: number[]; domain: [number, number] } {
  const safeExtent = Number.isFinite(maxExtent) ? Math.max(0, maxExtent) : 0;
  const safeTickCount = Number.isFinite(tickCount) ? Math.max(5, tickCount | 0) : 5;
  const oddTickCount = safeTickCount % 2 === 0 ? safeTickCount - 1 : safeTickCount;

  if (safeExtent <= 0) {
    return { ticks: [0], domain: [0, 0] };
  }
  const halfIntervals = (oddTickCount - 1) / 2;
  if (halfIntervals <= 0) {
    return { ticks: [0], domain: [0, 0] };
  }
  const step = niceAxisStep(safeExtent / halfIntervals);
  const niceMax = step * halfIntervals;
  const ticks: number[] = [];
  for (let i = -halfIntervals; i <= halfIntervals; i += 1) {
    const tick = i * step;
    ticks.push(Number.isFinite(tick) ? tick : 0);
  }
  return { ticks, domain: [-niceMax, niceMax] };
}

export function asymmetricZeroAxisTicks(
  maxPositive: number,
  maxNegativeAbs: number,
  tickCount: number
): { ticks: number[]; domain: [number, number] } {
  const safePositive = Number.isFinite(maxPositive) ? Math.max(0, maxPositive) : 0;
  const safeNegative = Number.isFinite(maxNegativeAbs) ? Math.max(0, maxNegativeAbs) : 0;
  const safeTickCount = Number.isFinite(tickCount) ? Math.max(7, tickCount | 0) : 7;
  const oddTickCount = safeTickCount % 2 === 0 ? safeTickCount - 1 : safeTickCount;

  if (safePositive <= 0 && safeNegative <= 0) {
    return { ticks: [0], domain: [0, 0] };
  }

  if (safeNegative <= 0) {
    const positive = computeTightSignedAxis(safePositive, 2, oddTickCount);
    return { ticks: positive.ticks, domain: [0, positive.domainBound] };
  }

  if (safePositive <= 0) {
    const negative = computeTightSignedAxis(safeNegative, 2, oddTickCount);
    const negativeTicks = negative.ticks
      .filter((tick) => tick > 0)
      .map((tick) => -tick)
      .sort((left, right) => left - right);
    return { ticks: [...negativeTicks, 0], domain: [-negative.domainBound, 0] };
  }

  const { positiveMaxTicks, negativeMaxTicks } = allocateTickBudgets(
    safePositive,
    safeNegative,
    oddTickCount
  );
  const positive = computeTightSignedAxis(safePositive, 2, positiveMaxTicks);
  const tightNegative = computeTightSignedAxis(safeNegative, 2, negativeMaxTicks);
  const displayNegativeBound = expandNegativeDomainForLabelSpace(
    tightNegative.domainBound,
    positive.domainBound
  );
  const negativeTickBudget =
    displayNegativeBound > tightNegative.domainBound + 1e-9 ? 3 : negativeMaxTicks;
  const displayNegative = computeTightSignedAxis(displayNegativeBound, 2, negativeTickBudget);
  let negativeTicks = displayNegative.ticks
    .filter((tick) => tick > 0)
    .map((tick) => -tick)
    .sort((left, right) => left - right);
  if (displayNegativeBound > 0 && negativeTicks.length === 0) {
    negativeTicks = [-displayNegativeBound];
  }
  const positiveTicks = positive.ticks.filter((tick) => tick > 0);
  const ticks = [...negativeTicks, 0, ...positiveTicks];

  return { ticks, domain: [-displayNegativeBound, positive.domainBound] };
}
