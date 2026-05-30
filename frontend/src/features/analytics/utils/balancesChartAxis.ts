export function compareBankNames(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function sortBanksAlphabetically<T extends { bankName: string }>(banks: readonly T[]): T[] {
  return [...banks].sort((left, right) => compareBankNames(left.bankName, right.bankName));
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
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  if (norm <= 1) return mag;
  if (norm <= 2) return 2 * mag;
  if (norm <= 5) return 5 * mag;
  return 10 * mag;
}

export function balancesYTickCount(chartInnerHeight: number) {
  const count = Math.min(7, Math.max(5, Math.floor(chartInnerHeight / 50)));
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
