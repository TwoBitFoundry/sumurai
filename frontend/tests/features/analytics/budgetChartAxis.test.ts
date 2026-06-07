import { describe, expect, it } from 'bun:test';
import {
  realityChartDomain,
  varianceChartDomain,
} from '@/features/analytics/utils/budgetChartAxis';

describe('varianceChartDomain', () => {
  it('includes negative and positive variance with padding', () => {
    const domain = varianceChartDomain([-3200, 1600]);
    expect(domain[0]).toBeLessThan(-3200);
    expect(domain[1]).toBeGreaterThan(1600);
    expect(domain[0]).toBeLessThanOrEqual(0);
    expect(domain[1]).toBeGreaterThanOrEqual(0);
  });

  it('pads a flat series so a single month is visible', () => {
    const domain = varianceChartDomain([-1500]);
    expect(domain[0]).toBeLessThan(-1500);
    expect(domain[1]).toBeGreaterThan(-1500);
  });

  it('returns zero domain for empty input', () => {
    expect(varianceChartDomain([])).toEqual([0, 0]);
  });
});

describe('realityChartDomain', () => {
  it('includes expenses and total budget with padding', () => {
    const domain = realityChartDomain([150, 572.53], 202);
    expect(domain[0]).toBeGreaterThanOrEqual(0);
    expect(domain[0]).toBeLessThan(150);
    expect(domain[1]).toBeGreaterThan(572.53);
    expect(domain[0]).toBeLessThanOrEqual(202);
    expect(domain[1]).toBeGreaterThanOrEqual(202);
  });

  it('defaults to budget when there is no expense data', () => {
    const domain = realityChartDomain([], 202);
    expect(domain[0]).toBe(0);
    expect(domain[1]).toBeGreaterThan(202);
  });
});
