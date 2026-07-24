import { describe, expect, it } from 'bun:test';
import { normalizeTrialCountryCode, validateTrialAddress } from '@/features/billing/pricingPolicy';

describe('pricingPolicy', () => {
  it('normalizes country input to two uppercase ASCII letters', () => {
    expect(normalizeTrialCountryCode('u-s3a')).toBe('US');
    expect(normalizeTrialCountryCode('éca')).toBe('CA');
    expect(normalizeTrialCountryCode('gbr')).toBe('GB');
  });

  it('requires a complete country code and nonblank postal code', () => {
    expect(validateTrialAddress('U', '78701')).toEqual({
      countryCode: 'Enter a two-letter country code.',
    });
    expect(validateTrialAddress('US', '  ')).toEqual({
      postalCode: 'Enter a postal code.',
    });
    expect(validateTrialAddress('US', ' 78701 ')).toEqual({});
  });
});
