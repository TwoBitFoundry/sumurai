import { AnalyticsService, computeRatio, formatRatio } from '@/services/AnalyticsService';
import { ApiClient, ApiError } from '@/services/ApiClient';
import type { BalancesOverview } from '@/types/analytics';

jest.mock('@/services/ApiClient');

describe('computeRatio (balances helper)', () => {
  it('returns positives / abs(negatives), rounded to 2dp', () => {
    expect(computeRatio(600, -200)).toBe(3);
    expect(computeRatio(60251.55, -18650.1)).toBeCloseTo(3.23, 2);
  });

  it('returns null when negatives is 0 (infinity)', () => {
    expect(computeRatio(123, 0)).toBeNull();
  });

  it('uses max(1, abs(negatives)) as denominator', () => {
    expect(computeRatio(10, -1)).toBe(10);
    expect(computeRatio(10, -0.1)).toBe(10); // Math.abs(-0.1) -> 0.1; max(1, 0.1) -> 1
  });
});

describe('AnalyticsService.getBalancesOverview (Phase 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls backend (latest-only) and returns typed result', async () => {
    const mock: BalancesOverview = {
      asOf: 'latest',
      overall: {
        cash: 18250.55,
        credit: -3250.1,
        loan: -15400,
        investments: 42000,
        positivesTotal: 60250.55,
        negativesTotal: -18650.1,
        net: 41600.45,
        ratio: 3.23,
      },
      banks: [
        {
          bankId: 'ins_123',
          bankName: 'Chase',
          cash: 12500,
          credit: -2500.1,
          loan: 0,
          investments: 0,
          positivesTotal: 12500,
          negativesTotal: -2500.1,
          net: 10000.9,
          ratio: 5,
        },
      ],
      mixedCurrency: false,
    };
    jest.mocked(ApiClient.get).mockResolvedValue(mock);

    const result = await AnalyticsService.getBalancesOverview();

    expect(ApiClient.get).toHaveBeenCalledWith(`/analytics/balances/overview`);
    expect(result).toEqual(mock);
  });

  it('formatRatio returns ∞ when ratio is null', () => {
    expect(formatRatio(null)).toBe('∞');
    expect(formatRatio(3.234)).toBe('3.23');
  });

  it('bubbles a meaningful error message on failure', async () => {
    const err = new ApiError(500, 'Server exploded');
    jest.mocked(ApiClient.get).mockRejectedValue(err);
    await expect(AnalyticsService.getBalancesOverview()).rejects.toBeTruthy();
  });
});
