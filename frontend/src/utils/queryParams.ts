export function buildAccountQueryParams(accountIds?: string[]): URLSearchParams {
  const params = new URLSearchParams()

  if (accountIds?.length) {
    accountIds.forEach(id => {
      params.append('account_ids[]', id)
    })
  }

  return params
}

export function appendAccountQueryParams(params: URLSearchParams, accountIds?: string[]): void {
  if (accountIds?.length) {
    accountIds.forEach(id => {
      params.append('account_ids[]', id)
    })
  }
}