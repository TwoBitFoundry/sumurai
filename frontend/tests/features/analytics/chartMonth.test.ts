import { describe, expect, it } from 'bun:test';
import {
  chartSeriesStartDate,
  formatChartMonthLabel,
  generateMonthRange,
} from '@/features/analytics/utils/chartMonth';
import { computeDateRange } from '@/utils/dateRanges';

describe('generateMonthRange', () => {
  it('includes March when the range starts on 2026-03-01', () => {
    expect(generateMonthRange('2026-03-01', '2026-05-31')).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
    ]);
  });

  it('orders months chronologically', () => {
    const months = generateMonthRange('2026-01-15', '2026-04-02');
    expect(months).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect([...months].sort()).toEqual(months);
  });
});

describe('chartSeriesStartDate', () => {
  it('extends current-month by one prior month for chart comparison', () => {
    const { start, end } = computeDateRange('current-month');
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    const months = generateMonthRange(chartSeriesStartDate(start!), end!);
    expect(months.length).toBeGreaterThanOrEqual(2);
    expect(months[months.length - 1]).toMatch(/^\d{4}-\d{2}$/);
  });

  it('extends past-2-months by one prior month', () => {
    const { start, end } = computeDateRange('past-2-months');
    const months = generateMonthRange(chartSeriesStartDate(start!), end!);
    expect(months).toHaveLength(3);
  });
});

describe('formatChartMonthLabel', () => {
  it('labels YYYY-MM keys without UTC month shift', () => {
    expect(formatChartMonthLabel('2026-03')).toBe("Mar '26");
  });
});
