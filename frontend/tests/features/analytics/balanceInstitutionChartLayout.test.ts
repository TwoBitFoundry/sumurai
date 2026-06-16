import { shouldStackBalanceInstitutions } from '@/features/analytics/utils/balanceInstitutionChartLayout';

describe('shouldStackBalanceInstitutions', () => {
  it('uses grouped bars for one institution', () => {
    expect(shouldStackBalanceInstitutions(1)).toBe(false);
  });

  it('uses grouped bars for two institutions', () => {
    expect(shouldStackBalanceInstitutions(2)).toBe(false);
  });

  it('uses stacked bars for three or more institutions', () => {
    expect(shouldStackBalanceInstitutions(3)).toBe(true);
    expect(shouldStackBalanceInstitutions(5)).toBe(true);
  });
});
