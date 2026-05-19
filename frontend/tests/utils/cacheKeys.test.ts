import { accountIdsCacheKey, accountRosterCacheKey } from '@/utils/cacheKeys';

describe('accountIdsCacheKey', () => {
  it('returns none when there are no accounts', () => {
    expect(accountIdsCacheKey([], [], false)).toBe('none');
  });

  it('returns all when every account is selected', () => {
    expect(accountIdsCacheKey(['a', 'b'], ['a', 'b'], true)).toBe('all');
  });

  it('returns none when selection is empty but accounts exist', () => {
    expect(accountIdsCacheKey(['a'], [], false)).toBe('none');
  });

  it('returns a stable sorted key for partial selections', () => {
    expect(accountIdsCacheKey(['a', 'b', 'c'], ['c', 'a'], false)).toBe('a,c');
  });
});

describe('accountRosterCacheKey', () => {
  it('returns roster none when there are no accounts', () => {
    expect(accountRosterCacheKey([])).toBe('roster:none');
  });

  it('returns a stable sorted roster key', () => {
    expect(accountRosterCacheKey(['c', 'a', 'b'])).toBe('roster:a,b,c');
  });

  it('changes when the linked account roster grows', () => {
    expect(accountRosterCacheKey(['a', 'b'])).not.toBe(accountRosterCacheKey(['a', 'b', 'c']));
  });
});
