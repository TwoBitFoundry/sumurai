export type FinancialProvider = 'plaid' | 'teller' | 'simplefin' | 'diy';
export type ExportFormat = 'csv' | 'ofx';

export interface TransactionLocation {
  address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
}

export interface CustomCategory {
  id: string;
  display_name: string;
  lookup_key: string;
}

export interface CategoryListResponse {
  system: string[];
  custom: CustomCategory[];
}

export interface TransactionCategory {
  primary: string;
  detailed?: string;
  confidence_level?: string;
  is_custom?: boolean;
  is_overridden?: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  name: string;
  merchant?: string;
  originalMerchantName?: string;
  normalizationSource?: string;
  amount: number;
  category: TransactionCategory;
  provider?: FinancialProvider;
  provider_account_id?: string | null;
  account_id?: string;
  account_name?: string;
  account_type?: string;
  account_mask?: string;
  running_balance?: number;
  location?: TransactionLocation;
}

export interface CursorTransactionsResponse {
  transactions: Transaction[];
  next_cursor: string | null;
  prev_cursor: string | null;
  has_more: boolean;
}

export interface LargestTransaction {
  amount: number;
  merchant: string;
}

export interface TransactionsInsightsResponse {
  total_count: number;
  total_spent: number;
  average_amount: number;
  largest: LargestTransaction | null;
  top_categories: string[];
}

export interface IncomeExpenseTotalsResponse {
  income: number;
  expenses: number;
}

export interface AnalyticsDateBoundsResponse {
  start_date: string | null;
  end_date: string | null;
}

export interface BudgetCategorySpendingResponse {
  name: string;
  value: number;
}

export interface BudgetSummaryResponse {
  income: number;
  category_spending: BudgetCategorySpendingResponse[];
}

export type InsightFormat = 'currency' | 'count' | 'days' | 'percent' | 'ratio';

export type InsightState = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'triple';

export interface InsightMetric {
  value: number | null;
  format: InsightFormat;
  secondary: number | null;
  comparison: number | null;
  share: number | null;
  label: string | null;
}

export interface ContextualInsightsResponse {
  state: InsightState;
  card1: InsightMetric;
  card2: InsightMetric;
  card3: InsightMetric | null;
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
}

export interface BudgetsOverviewResponse {
  budgets: Budget[];
  fixed_expenses: FixedExpenseSummary[];
}

// Historically budgets included a `month`. Budgets are now
// persistent containers not tied to months. Keep `month` only
// for backward compatibility with older backend responses.
export interface LegacyBudgetWithMonth extends Budget {
  month?: string;
}

export interface Account {
  id: string;
  name: string;
  provider: FinancialProvider;
  account_type: string;
  account_subtype?: string | null;
  balance_ledger: number | null;
  balance_available?: number | null;
  balance_current?: number | string | null;
  mask: string | null;
  status?: string | null;
  institution_name?: string | null;
  connection_id?: string | null;
  provider_connection_id?: string | null;
  plaid_connection_id?: string | null;
  provider_account_id?: string | null;
  transaction_count?: number | null;
}

export interface PlaidLinkTokenResponse {
  link_token: string;
}

export interface PlaidExchangeTokenRequest {
  public_token: string;
}

export interface PlaidExchangeTokenResponse {
  access_token: string;
  item_id?: string;
  institution_id?: string | null;
  institution_name?: string;
  connection_id?: string;
}

export interface PlaidSyncResponse {
  transactions: Transaction[];
  metadata: {
    transaction_count: number;
    account_count: number;
    sync_timestamp: string;
    start_date: string;
    end_date: string;
    connection_updated: boolean;
  };
  simplefin_institution_results?: SimpleFinInstitutionSyncResult[];
  bridge_warnings?: string[];
}

export interface SyncTransactionsRequest {
  connection_id?: string;
  client_date: string;
  client_timezone: string;
}

export interface ProviderConnectionStatus {
  is_connected: boolean;
  last_sync_at: string | null;
  institution_name: string | null;
  connection_id: string | null;
  item_id?: string | null;
  provider: string;
  transaction_count: number;
  account_count: number;
  sync_in_progress: boolean;
}

export interface ProviderConnectResponse {
  connection_id: string;
  institution_name: string;
  simplefin_institutions_requiring_auth?: SimpleFinInstitutionAuthRequired[];
}

export interface CreateDiyInstitutionRequest {
  name: string;
}

export interface CreateDiyInstitutionResponse {
  connection_id: string;
}

export interface CreateDiyAccountRequest {
  name: string;
  account_type: string;
  mask?: string | null;
  balance: string;
}

export interface CreateDiyAccountResponse {
  id: string;
  name: string;
  account_type: string;
}

export interface SimpleFinInstitutionAuthRequired {
  institution_name: string;
  org_conn_id?: string | null;
  message: string;
}

export type SimpleFinInstitutionSyncStatus =
  | 'synced'
  | 'auth_required'
  | 'skipped_hidden'
  | 'no_accounts';

export interface SimpleFinInstitutionSyncResult {
  institution_name: string;
  org_conn_id?: string | null;
  connection_id?: string | null;
  status: SimpleFinInstitutionSyncStatus;
  transaction_count?: number | null;
  message?: string | null;
}

export interface SimpleFinBridgeSyncResponse {
  rateLimited: boolean;
  retryAfterSeconds?: number;
  transactions: Transaction[];
  metadata?: PlaidSyncResponse['metadata'];
  simplefin_institution_results: SimpleFinInstitutionSyncResult[];
  bridge_warnings: string[];
}

export interface ProviderStatusResponse {
  provider: FinancialProvider;
  connections: ProviderConnectionStatus[];
}

export interface SimpleFinIgnoredInstitution {
  org_conn_id: string;
  institution_name: string | null;
  hidden_at: string;
}

export interface SimpleFinIgnoredInstitutionsResponse {
  institutions: SimpleFinIgnoredInstitution[];
}

export interface DataCleared {
  transactions: number;
  accounts: number;
  cache_keys: string[];
}

export interface DisconnectResponse {
  success: boolean;
  message: string;
  data_cleared: DataCleared;
}

export type PlaidDisconnectResponse = DisconnectResponse;

export interface AnalyticsSpendingResponse {
  total: number;
  currency: string;
}

export interface AnalyticsCategoryResponse {
  category: string;
  amount: number;
  count?: number;
  percentage: number;
}

export interface AnalyticsMonthlyTotalsResponse {
  month: string;
  amount: number;
}

export interface AnalyticsTopMerchantsResponse {
  name: string;
  amount: number;
  count?: number;
  percentage: number;
}

export interface AnalyticsCashFlowPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface AnalyticsCashFlowResponse {
  series: AnalyticsCashFlowPoint[];
  currency: string;
}

export type SankeyNodeKind =
  | 'Income'
  | 'Expenses'
  | 'Category'
  | 'Deficit'
  | 'Savings'
  | 'FixedExpenses'
  | 'FreeSpending';

export interface SankeyNode {
  id: string;
  label: string;
  kind: SankeyNodeKind;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number | string;
}

export interface SankeySummary {
  income: number | string;
  expenses: number | string;
  covered: number | string;
  deficit: number | string;
  surplus: number | string;
  coverage_ratio: number | string | null;
}

export interface SankeyResponse {
  nodes: SankeyNode[];
  links: SankeyLink[];
  currency: string;
  summary: SankeySummary;
}

export type AutoCategorizationJobStatus =
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface AutoCategorizationJobState {
  job_id: string;
  status: AutoCategorizationJobStatus;
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
}

export function isAutoCategorizationJobActive(status: AutoCategorizationJobStatus): boolean {
  return status === 'running' || status === 'cancelling';
}

export interface ApiError {
  error: string;
  message: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export interface AuthResponse {
  user_id: string;
  email?: string;
  expires_at: string;
  onboarding_completed: boolean;
  demo_mode_active: boolean;
  requires_passkey_enrollment?: boolean;
}

export interface PasswordLoginRequest {
  email: string;
  password: string;
}

export interface PasswordLoginRequest {
  email: string;
  password: string;
}

export interface RefreshResponse {
  user_id: string;
  email?: string;
  expires_at: string;
  onboarding_completed: boolean;
  demo_mode_active: boolean;
}

export interface LogoutResponse {
  message: string;
  cleared_session: string;
}

export interface OnboardingResponse {
  message: string;
  onboarding_completed: boolean;
  demo_mode_active: boolean;
}

export interface PasskeyItem {
  id: string;
  name: string;
  created_at: string;
  last_used_at?: string | null;
}

export interface PasskeyRegisterBeginResponse {
  session_id: string;
  challenge: Record<string, unknown>;
}

export interface PasskeyLoginBeginResponse {
  session_id: string;
  challenge: Record<string, unknown>;
  account_exists: boolean;
  passkey_available: boolean;
  password_available: boolean;
}

export interface RegisterBeginResponse {
  user_id: string;
  session_id: string;
  challenge: Record<string, unknown>;
}

export interface RegisterRequest {
  email: string;
  name: string;
}

export interface FixedExpenseSummary {
  merchant: string;
  normalized_merchant: string;
  monthly_cost: string;
  cadence: string;
  first_charged: string;
  last_charged: string;
  occurrence_count: number;
  account_ids: string[];
  category?: string;
}

export type SubscriptionSummary = FixedExpenseSummary;
