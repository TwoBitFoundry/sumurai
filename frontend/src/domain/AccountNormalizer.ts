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

export class AccountNormalizer {
  static normalize(backendAccounts: any[]): NormalizedAccount[] {
    return backendAccounts.map((account: any) => {
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
