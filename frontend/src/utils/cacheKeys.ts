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
