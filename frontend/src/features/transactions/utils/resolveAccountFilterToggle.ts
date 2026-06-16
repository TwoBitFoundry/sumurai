export function resolveAccountFilterToggle(
  accountId: string,
  selectedAccountIds: string[],
  allAccountIds: string[]
): string[] {
  const isOnlyThisAccountSelected =
    selectedAccountIds.length === 1 && selectedAccountIds[0] === accountId;

  if (isOnlyThisAccountSelected) {
    return [...allAccountIds];
  }

  return [accountId];
}
