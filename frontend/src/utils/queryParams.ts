/**
 * Parses and builds URL query parameters.
 */

export function buildAccountQueryParams(accountIds?: string[]): URLSearchParams {
  const params = new URLSearchParams();

  if (accountIds?.length) {
    accountIds.forEach((id) => {
      params.append('account_ids[]', id);
    });
  }

  return params;
}

export function appendAccountQueryParams(
  params: URLSearchParams,
  accountIds?: string[],
  excludeAccountIds?: string[]
): void {
  if (accountIds?.length) {
    accountIds.forEach((id) => {
      params.append('account_ids[]', id);
    });
  }

  if (excludeAccountIds?.length) {
    excludeAccountIds.forEach((id) => {
      params.append('exclude_account_ids[]', id);
    });
  }
}
