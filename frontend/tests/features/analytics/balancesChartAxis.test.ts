import { describe, expect, it } from 'bun:test';
import {
  balancesYTickCount,
  formatBalancesAxisValue,
  safeBalanceAmount,
  sortBanksAlphabetically,
  symmetricZeroAxisTicks,
} from '@/features/analytics/utils/balancesChartAxis';

describe('balancesYTickCount', () => {
  it('returns odd counts between 5 and 7 based on height', () => {
    expect(balancesYTickCount(100)).toBe(5);
    expect(balancesYTickCount(200)).toBe(5);
    expect(balancesYTickCount(250)).toBe(5);
    expect(balancesYTickCount(350)).toBe(7);
    expect(balancesYTickCount(1000)).toBe(7);
  });
});

describe('symmetricZeroAxisTicks', () => {
  it('centers zero with symmetric domain and ticks', () => {
    const { ticks, domain } = symmetricZeroAxisTicks(42_000, 5);
    expect(ticks).toContain(0);
    expect(domain[0]).toBe(-domain[1]);
    expect(ticks[0]).toBe(domain[0]);
    expect(ticks[ticks.length - 1]).toBe(domain[1]);
    expect(ticks.length).toBe(5);
  });

  it('covers data extent on both sides', () => {
    const { domain } = symmetricZeroAxisTicks(42_000, 7);
    expect(domain[1]).toBeGreaterThanOrEqual(42_000);
    expect(domain[0]).toBeLessThanOrEqual(-42_000);
  });

  it('returns a single zero tick when extent is empty', () => {
    expect(symmetricZeroAxisTicks(0, 7)).toEqual({
      ticks: [0],
      domain: [0, 0],
    });
  });

  it('ignores non-finite extent and tick count', () => {
    const { ticks, domain } = symmetricZeroAxisTicks(Number.NaN, Number.NaN);
    expect(ticks).toEqual([0]);
    expect(domain).toEqual([0, 0]);
    expect(ticks.every((tick) => Number.isFinite(tick))).toBe(true);
  });
});

describe('safeBalanceAmount', () => {
  it('coerces strings and rejects non-finite values', () => {
    expect(safeBalanceAmount('12500.55' as unknown as number)).toBe(12500.55);
    expect(safeBalanceAmount(Number.NaN)).toBe(0);
    expect(safeBalanceAmount(null)).toBe(0);
  });
});

describe('formatBalancesAxisValue', () => {
  it('does not render NaN for non-finite input', () => {
    expect(formatBalancesAxisValue(Number.NaN)).toBe('0');
  });
});

describe('sortBanksAlphabetically', () => {
  it('orders institutions by bank name case-insensitively', () => {
    const banks = [
      { bankName: 'OnePay', cash: 1 },
      { bankName: 'chime', cash: 2 },
      { bankName: 'Ally', cash: 3 },
    ];
    expect(sortBanksAlphabetically(banks).map((bank) => bank.bankName)).toEqual([
      'Ally',
      'chime',
      'OnePay',
    ]);
  });

  it('does not mutate the input array', () => {
    const banks = [{ bankName: 'Zeta' }, { bankName: 'Alpha' }];
    const copy = [...banks];
    sortBanksAlphabetically(banks);
    expect(banks).toEqual(copy);
  });
});
