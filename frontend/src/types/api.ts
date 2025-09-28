export interface Transaction {
  id: string
  date: string
  name: string
  merchant?: string
  amount: number
  category: {
    id: string
    name: string
  }
  account_name: string
  account_type: string
  account_mask?: string
}

export interface Budget {
  id: string
  category: string
  amount: number
}

// Historically budgets included a `month`. Budgets are now
// persistent containers not tied to months. Keep `month` only
// for backward compatibility with older backend responses.
export interface LegacyBudgetWithMonth extends Budget {
  month?: string
}

export interface Account {
  id: string
  name: string
  account_type: string
  balance_current: number | null
  mask: string | null
  plaid_connection_id?: string | null
  institution_name?: string | null
}

export interface PlaidLinkTokenResponse {
  link_token: string
}

export interface PlaidExchangeTokenRequest {
  public_token: string
}

export interface PlaidExchangeTokenResponse {
  access_token: string
}

export interface PlaidSyncResponse {
  transactions: Transaction[]
  metadata: {
    transaction_count: number
    account_count: number
    sync_timestamp: string
    start_date: string
    end_date: string
    connection_updated: boolean
  }
}

export interface PlaidStatusResponse {
  connected?: boolean
  is_connected?: boolean
  last_sync?: string
  last_sync_at?: string
  accounts_count?: number
  account_count?: number
  institution_name?: string | null
  connection_id?: string | null
  transaction_count?: number
  sync_in_progress?: boolean
}

export interface DataCleared {
  transactions: number
  accounts: number
  cache_keys: string[]
}

export interface PlaidDisconnectResponse {
  success: boolean
  message: string
  data_cleared: DataCleared
}

export interface AnalyticsSpendingResponse {
  total: number
  currency: string
}

export interface AnalyticsCategoryResponse {
  category: string
  amount: number
  count: number
  percentage: number
}


export interface AnalyticsMonthlyTotalsResponse {
  month: string
  amount: number
}

export interface AnalyticsTopMerchantsResponse {
  name: string
  amount: number
  count: number
  percentage: number
}


export interface ApiError {
  error: string
  message: string
}

export interface ApiResponse<T> {
  data?: T
  error?: ApiError
}
