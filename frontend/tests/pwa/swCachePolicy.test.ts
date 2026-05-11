import { shouldUseNetworkOnlyForRequest } from '@/pwa/swCachePolicy';

describe('swCachePolicy', () => {
  it('targets same-origin API paths', () => {
    expect(shouldUseNetworkOnlyForRequest('/api/v1/foo', true)).toBe(true);
    expect(shouldUseNetworkOnlyForRequest('/api/', true)).toBe(true);
  });

  it('ignores non-api paths', () => {
    expect(shouldUseNetworkOnlyForRequest('/', true)).toBe(false);
    expect(shouldUseNetworkOnlyForRequest('/dashboard/', true)).toBe(false);
  });

  it('ignores cross-origin paths', () => {
    expect(shouldUseNetworkOnlyForRequest('/api/x', false)).toBe(false);
  });
});
