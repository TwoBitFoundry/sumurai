import { computeYtdTotals } from '@/services/AnalyticsService';
import type { AnalyticsCashFlowPoint } from '@/types/api';

describe('computeYtdTotals', () => {
  const series: AnalyticsCashFlowPoint[] = [
    { month: '2025-11', income: 1000, expenses: 400, net: 600 },
    { month: '2025-12', income: 2000, expenses: 500, net: 1500 },
    { month: '2026-01', income: 3000, expenses: 800, net: 2200 },
    { month: '2026-02', income: 2500, expenses: 600, net: 1900 },
    { month: '2026-03', income: 1500, expenses: 700, net: 800 },
  ];

  it('sums income and expenses only for months in the target year', () => {
    expect(computeYtdTotals(series, 2026)).toEqual({
      incomeYtd: 7000,
      expensesYtd: 2100,
    });
  });

  it('excludes months outside the target year', () => {
    expect(computeYtdTotals(series, 2025)).toEqual({
      incomeYtd: 3000,
      expensesYtd: 900,
    });
  });

  it('returns zeros for an empty series', () => {
    expect(computeYtdTotals([], 2026)).toEqual({
      incomeYtd: 0,
      expensesYtd: 0,
    });
  });

  it('handles a partial year with only early months', () => {
    const partial: AnalyticsCashFlowPoint[] = [
      { month: '2026-01', income: 1000, expenses: 200, net: 800 },
      { month: '2026-02', income: 1200, expenses: 300, net: 900 },
      { month: '2026-03', income: 800, expenses: 150, net: 650 },
      { month: '2026-04', income: 900, expenses: 250, net: 650 },
      { month: '2026-05', income: 1100, expenses: 400, net: 700 },
      { month: '2026-06', income: 950, expenses: 350, net: 600 },
    ];

    expect(computeYtdTotals(partial, 2026)).toEqual({
      incomeYtd: 5950,
      expensesYtd: 1650,
    });
  });
});
