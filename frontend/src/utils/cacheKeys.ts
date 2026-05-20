/**
 * Factories for React Query cache keys.
 */

export function accountIdsCacheKey(
  allAccountIds: string[],
  selectedAccountIds: string[],
  isAllSelected: boolean
): string {
  if (allAccountIds.length === 0) {
    return 'none';
  }

  if (isAllSelected) {
    return 'all';
  }

  if (selectedAccountIds.length === 0) {
    return 'none';
  }

  return [...selectedAccountIds].sort().join(',');
}

export function accountRosterCacheKey(allAccountIds: string[]): string {
  if (allAccountIds.length === 0) {
    return 'roster:none';
  }

  return `roster:${[...allAccountIds].sort().join(',')}`;
}
