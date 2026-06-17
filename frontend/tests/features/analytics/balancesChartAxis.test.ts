import { describe, expect, it } from 'bun:test';
import {
  asymmetricZeroAxisTicks,
  balancesYTickCount,
  expandNegativeDomainForLabelSpace,
  formatBalancesAxisValue,
  safeBalanceAmount,
  sortBanksAlphabetically,
  symmetricZeroAxisTicks,
} from '@/features/analytics/utils/balancesChartAxis';

describe('balancesYTickCount', () => {
  it('returns odd counts between 9 and 13 based on height', () => {
    expect(balancesYTickCount(100)).toBe(9);
    expect(balancesYTickCount(200)).toBe(11);
    expect(balancesYTickCount(250)).toBe(13);
    expect(balancesYTickCount(350)).toBe(13);
    expect(balancesYTickCount(1000)).toBe(13);
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

describe('expandNegativeDomainForLabelSpace', () => {
  it('expands cramped negative domains to reserve chart space for labels', () => {
    expect(expandNegativeDomainForLabelSpace(8_000, 100_000)).toBe(20_000);
    expect(expandNegativeDomainForLabelSpace(50_000, 100_000)).toBe(50_000);
  });
});

describe('asymmetricZeroAxisTicks', () => {
  it('uses independent positive and negative domains when both sides have data', () => {
    const { ticks, domain } = asymmetricZeroAxisTicks(163_031, 11_499, 9);

    expect(ticks).toContain(0);
    expect(domain[0]).toBeLessThan(0);
    expect(domain[1]).toBeGreaterThan(0);
    expect(Math.abs(domain[0])).toBeLessThan(domain[1]);
    expect(domain[1]).toBe(175_000);
    expect(Math.abs(domain[0])).toBeGreaterThanOrEqual(11_499);
    expect(Math.abs(domain[0])).toBeGreaterThanOrEqual(30_000);
    expect(Math.max(...ticks.filter((tick) => tick > 0))).toBeGreaterThanOrEqual(163_031);
    expect(Math.min(...ticks.filter((tick) => tick < 0))).toBeLessThanOrEqual(-11_499);
    expect(ticks.filter((tick) => tick > 0).length).toBeGreaterThanOrEqual(3);
    expect(ticks.filter((tick) => tick < 0).length).toBeGreaterThanOrEqual(1);
  });

  it('fits a 100k positive peak without doubling the axis range', () => {
    const { ticks, domain } = asymmetricZeroAxisTicks(100_000, 5_000, 9);

    expect(domain[1]).toBe(100_000);
    expect(domain[0]).toBe(-20_000);
    expect(ticks).toEqual([-20_000, -10_000, 0, 20_000, 40_000, 60_000, 80_000, 100_000]);
    expect(ticks.filter((tick) => tick < 0).length).toBeGreaterThanOrEqual(1);
    expect(ticks.filter((tick) => tick > 0).length).toBeGreaterThanOrEqual(4);
  });

  it('adds intermediate positive ticks and visible negative ticks for mixed balances', () => {
    const { ticks, domain } = asymmetricZeroAxisTicks(100_000, 8_000, 9);

    expect(domain).toEqual([-20_000, 100_000]);
    expect(ticks).toEqual([-20_000, -10_000, 0, 20_000, 40_000, 60_000, 80_000, 100_000]);
  });

  it('uses a positive-only domain when there is no negative balance', () => {
    const { ticks, domain } = asymmetricZeroAxisTicks(42_000, 0, 5);

    expect(domain[0]).toBe(0);
    expect(domain[1]).toBeGreaterThanOrEqual(42_000);
    expect(ticks.every((tick) => tick >= 0)).toBe(true);
  });

  it('uses a negative-only domain when there is no positive balance', () => {
    const { ticks, domain } = asymmetricZeroAxisTicks(0, 18_000, 5);

    expect(domain[1]).toBe(0);
    expect(domain[0]).toBeLessThanOrEqual(-18_000);
    expect(ticks.every((tick) => tick <= 0)).toBe(true);
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
