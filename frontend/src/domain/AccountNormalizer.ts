type NormalizedAccount = {
  id: string
  name: string
  mask: string
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'other'
  balance?: number
  transactions?: number
  connectionKey: string | null
}

const mapAccountType = (backendType?: string): 'checking' | 'savings' | 'credit' | 'loan' | 'other' => {
  const normalized = (backendType ?? '').toLowerCase()
  switch (normalized) {
    case 'depository':
    case 'checking':
      return 'checking'
    case 'savings':
      return 'savings'
    case 'credit':
    case 'credit card':
      return 'credit'
    case 'loan':
      return 'loan'
    default:
      return 'other'
  }
}

const parseNumeric = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export type BackendAccount = {
  id: string | number
  name?: string
  account_name?: string
  official_name?: string
  institution_name?: string
  mask?: string
  account_mask?: string
  last_four?: string | number
  lastFour?: string | number
  account_type?: string
  type?: string
  accountType?: string
  subtype?: string
  balance_current?: number | string | null
  balance_ledger?: number | string | null
  current_balance?: number | string | null
  transaction_count?: number | string | null
  provider_connection_id?: string | number | null
  connection_id?: string | number | null
  plaid_connection_id?: string | number | null
  providerConnectionId?: string | number | null
  connectionId?: string | number | null
}

export class AccountNormalizer {
  static normalize(backendAccounts: BackendAccount[]): NormalizedAccount[] {
    return backendAccounts.map((account) => {
      const connectionId =
        account.provider_connection_id ??
        account.connection_id ??
        account.plaid_connection_id ??
        account.providerConnectionId ??
        account.connectionId ??
        null

      const balance =
        parseNumeric(account.balance_current) ??
        parseNumeric(account.balance_ledger) ??
        parseNumeric(account.current_balance) ??
        undefined

      const transactions = parseNumeric(account.transaction_count) ?? 0

      const name =
        account.name ??
        account.account_name ??
        account.official_name ??
        account.institution_name ??
        'Account'

      const mask =
        account.mask ??
        account.account_mask ??
        account.last_four ??
        account.lastFour ??
        '0000'

      return {
        id: String(account.id),
        name,
        mask,
        type: mapAccountType(account.account_type ?? account.type ?? account.accountType ?? account.subtype),
        balance,
        transactions,
        connectionKey: connectionId ? String(connectionId) : null,
      }
    })
  }
}
