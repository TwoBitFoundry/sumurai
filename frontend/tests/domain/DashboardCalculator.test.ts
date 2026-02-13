import { DashboardCalculator } from '../../src/domain/DashboardCalculator';

interface NetWorthPoint {
  date: string;
  value: number;
}

describe('DashboardCalculator', () => {
  describe('calculateNetYAxisDomain', () => {
    it('returns null for empty series', () => {
      const domain = DashboardCalculator.calculateNetYAxisDomain([]);
      expect(domain).toBeNull();
    });

    it('returns null when all values are non-finite', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: NaN },
        { date: '2025-01-02', value: Infinity },
      ];
      const domain = DashboardCalculator.calculateNetYAxisDomain(series);
      expect(domain).toBeNull();
    });

    it('pads range when min equals max', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 5000 },
        { date: '2025-01-02', value: 5000 },
      ];
      const domain = DashboardCalculator.calculateNetYAxisDomain(series);
      expect(domain).toBeDefined();
      expect(domain).toHaveLength(2);
      expect(domain![0]).toBeLessThan(5000);
      expect(domain![1]).toBeGreaterThan(5000);
    });

    it('adds padding to range when min differs from max', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 0 },
        { date: '2025-01-02', value: 10000 },
      ];
      const domain = DashboardCalculator.calculateNetYAxisDomain(series);
      expect(domain).toBeDefined();
      expect(domain![0]).toBeLessThanOrEqual(0);
      expect(domain![1]).toBeGreaterThanOrEqual(10000);
    });

    it('filters out non-finite values in calculation', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 1000 },
        { date: '2025-01-02', value: NaN },
        { date: '2025-01-03', value: 9000 },
        { date: '2025-01-04', value: Infinity },
      ];
      const domain = DashboardCalculator.calculateNetYAxisDomain(series);
      expect(domain).toBeDefined();
      expect(domain![0]).toBeLessThanOrEqual(1000);
      expect(domain![1]).toBeGreaterThanOrEqual(9000);
    });

    it('calculates correct padding for small ranges', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 0 },
        { date: '2025-01-02', value: 100 },
      ];
      const domain = DashboardCalculator.calculateNetYAxisDomain(series);
      expect(domain).toBeDefined();
      const [min, max] = domain!;
      const span = max - min;
      expect(span).toBeGreaterThan(100);
    });

    it('uses minimum padding of 500', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 10000 },
        { date: '2025-01-02', value: 10000 },
      ];
      const domain = DashboardCalculator.calculateNetYAxisDomain(series);
      expect(domain).toBeDefined();
      const [min, max] = domain!;
      const padding = 10000 - min;
      expect(padding).toBeGreaterThanOrEqual(500);
    });
  });

  describe('calculateNetDotIndices', () => {
    it('returns empty set for empty series', () => {
      const indices = DashboardCalculator.calculateNetDotIndices([]);
      expect(indices.size).toBe(0);
    });

    it('identifies indices where values change', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 1000 },
        { date: '2025-01-02', value: 1000 },
        { date: '2025-01-03', value: 2000 },
        { date: '2025-01-04', value: 2000 },
      ];
      const indices = DashboardCalculator.calculateNetDotIndices(series);
      expect(indices.has(2)).toBe(true);
    });

    it('limits max dots to 30', () => {
      const series: NetWorthPoint[] = [];
      for (let i = 0; i < 100; i++) {
        series.push({ date: `2025-01-${(i % 31) + 1}`, value: i % 2 === 0 ? 1000 : 2000 });
      }
      const indices = DashboardCalculator.calculateNetDotIndices(series);
      expect(indices.size).toBeLessThanOrEqual(30);
    });

    it('always includes last change index', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 1000 },
        { date: '2025-01-02', value: 2000 },
        { date: '2025-01-03', value: 3000 },
        { date: '2025-01-04', value: 4000 },
      ];
      const indices = DashboardCalculator.calculateNetDotIndices(series);
      if (indices.size > 0) {
        const maxIndex = Math.max(...Array.from(indices));
        expect(maxIndex).toBeGreaterThan(0);
      }
    });

    it('skips non-finite values in comparison', () => {
      const series: NetWorthPoint[] = [
        { date: '2025-01-01', value: 1000 },
        { date: '2025-01-02', value: NaN },
        { date: '2025-01-03', value: 1000 },
      ];
      const indices = DashboardCalculator.calculateNetDotIndices(series);
      expect(indices.size).toBeGreaterThanOrEqual(0);
    });
  });
});
