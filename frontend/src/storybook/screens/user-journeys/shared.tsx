import type { BackendTransaction } from '@/domain/TransactionTransformer';
import { sampleDonutByCategory, sampleTopMerchants } from '@/storybook/fixtures/analytics';
import { sampleBudgetProgressEntries } from '@/storybook/fixtures/budgets';
import { storyFullProviderCatalogInfo } from '@/storybook/fixtures/providerPicker';
import { sampleTransactions, transactionsTablePage } from '@/storybook/fixtures/transactions';
import type {
  Account,
  AnalyticsCategoryResponse,
  AnalyticsMonthlyTotalsResponse,
  AnalyticsTopMerchantsResponse,
  FinancialProvider,
  Transaction,
} from '@/types/api';
import { jsonResponse, route, type StoryApiRoute } from './storyApi';

const storyNow = new Date();

function storyDate(day: number): string {
  return new Date(storyNow.getFullYear(), storyNow.getMonth(), day, 12, 0, 0).toISOString();
}

function currentMonthKey(offsetMonths = 0): string {
  const date = new Date(storyNow.getFullYear(), storyNow.getMonth() + offsetMonths, 1);
  return date.toISOString().slice(0, 7);
}

function toBackendTransaction(transaction: Transaction, day: number): BackendTransaction {
  return {
    id: transaction.id,
    date: storyDate(day),
    merchant_name: transaction.merchant || transaction.name,
    amount: transaction.amount,
    category_primary: transaction.category.primary,
    category_detailed: transaction.category.detailed,
    category_confidence: transaction.category.confidence_level,
    account_name: transaction.account_name || 'Story Checking',
    account_type: transaction.account_type || 'depository',
    account_mask: transaction.account_mask,
    running_balance: transaction.running_balance,
    location: transaction.location,
  };
}

export const storyProviderAccounts: Account[] = [
  {
    id: 'story-account-1',
    name: 'Everyday Checking',
    provider: 'plaid',
    account_type: 'depository',
    balance_ledger: 18420.18,
    balance_available: 18120.18,
    mask: '4821',
    institution_name: 'Story Federal Credit Union',
    connection_id: 'story-plaid-conn-1',
    transaction_count: 42,
  },
  {
    id: 'story-account-2',
    name: 'High Yield Savings',
    provider: 'plaid',
    account_type: 'savings',
    balance_ledger: 12840.55,
    balance_available: 12840.55,
    mask: '1199',
    institution_name: 'Story Federal Credit Union',
    connection_id: 'story-plaid-conn-1',
    transaction_count: 6,
  },
  {
    id: 'story-account-3',
    name: 'Rewards Visa Signature',
    provider: 'plaid',
    account_type: 'credit',
    balance_ledger: -842.4,
    balance_available: -842.4,
    mask: '7712',
    institution_name: 'Metro Digital Bank',
    connection_id: 'story-plaid-conn-2',
    transaction_count: 128,
  },
];

export const storyPlaidStatus = {
  provider: 'plaid' as FinancialProvider,
  connections: [
    {
      connection_id: 'story-plaid-conn-1',
      institution_name: 'Story Federal Credit Union',
      last_sync_at: storyDate(5),
      transaction_count: 48,
      account_count: 2,
      is_connected: true,
      sync_in_progress: false,
    },
    {
      connection_id: 'story-plaid-conn-2',
      institution_name: 'Metro Digital Bank',
      last_sync_at: storyDate(3),
      transaction_count: 128,
      account_count: 1,
      is_connected: true,
      sync_in_progress: false,
    },
  ],
};

export const storyPlaidSyncTransactions = {
  transactions: sampleTransactions,
  metadata: {
    transaction_count: sampleTransactions.length,
    account_count: storyProviderAccounts.length,
    sync_timestamp: storyDate(6),
    start_date: storyDate(1),
    end_date: storyDate(10),
    connection_updated: true,
  },
};

export const storyPlaidDisconnect = {
  success: true,
  message: 'Disconnected successfully',
  data_cleared: {
    transactions: 0,
    accounts: 0,
    cache_keys: [],
  },
};

export const storySinglePlaidAccounts: Account[] = [storyProviderAccounts[0]!];

export const storySinglePlaidStatus = {
  provider: 'plaid' as FinancialProvider,
  connections: [storyPlaidStatus.connections[0]!],
};

export const storyPlaidConnectedCatalogInfo = {
  ...storyFullProviderCatalogInfo,
  user_provider: 'plaid' as const,
};

export const storyPlaidEmptyProviderInfo = {
  ...storyFullProviderCatalogInfo,
  user_provider: 'plaid' as const,
};

export const storyTellerEmptyProviderInfo = {
  ...storyFullProviderCatalogInfo,
  user_provider: 'teller' as const,
};

const storyPlaidLinkTokenHandler = route('POST', '/plaid/link-token', () =>
  jsonResponse({ link_token: 'story-link-token' })
);

export function buildStoryPlaidPickerEmptyHandlers(): StoryApiRoute[] {
  return [
    route('GET', '/providers/info', () => jsonResponse(storyPlaidEmptyProviderInfo)),
    route('GET', '/providers/status', () =>
      jsonResponse({
        provider: 'plaid',
        connections: [],
      })
    ),
    route('GET', '/providers/accounts', () => jsonResponse([])),
    storyPlaidLinkTokenHandler,
    ...storyAutoCategorizeHandlers,
  ];
}

export function buildStoryTellerPickerEmptyHandlers(): StoryApiRoute[] {
  return [
    route('GET', '/providers/info', () => jsonResponse(storyTellerEmptyProviderInfo)),
    route('GET', '/providers/status', () =>
      jsonResponse({
        provider: 'teller',
        connections: [],
      })
    ),
    route('GET', '/providers/accounts', () => jsonResponse([])),
    ...storyAutoCategorizeHandlers,
  ];
}

export function buildStoryLastInstitutionDisconnectHandlers(): StoryApiRoute[] {
  let disconnected = false;

  return [
    route('GET', '/providers/info', () =>
      jsonResponse(disconnected ? storyFullProviderCatalogInfo : storyPlaidConnectedCatalogInfo)
    ),
    route('GET', '/providers/accounts', () =>
      jsonResponse(disconnected ? [] : storySinglePlaidAccounts)
    ),
    route('GET', '/providers/status', () =>
      jsonResponse(disconnected ? { provider: 'plaid', connections: [] } : storySinglePlaidStatus)
    ),
    route('GET', '/providers/simplefin/ignored-institutions', () =>
      jsonResponse({ institutions: [] })
    ),
    route('POST', '/providers/disconnect', () => {
      disconnected = true;
      return jsonResponse(storyPlaidDisconnect);
    }),
    route('POST', '/providers/select', () => jsonResponse({ user_provider: 'simplefin' })),
    storyPlaidLinkTokenHandler,
    ...storyAutoCategorizeHandlers,
  ];
}

export const storyProviderInfo = {
  available_providers: ['plaid', 'teller'] as FinancialProvider[],
  user_provider: null,
  teller_application_id: 'story-teller-app',
  teller_environment: 'sandbox',
};

export const storyProviderSelect = {
  user_provider: 'plaid' as FinancialProvider,
};

export const storyAutoCategorizeHandlers: StoryApiRoute[] = [
  route('GET', '/transactions/auto-categorize', () => jsonResponse(null)),
  route('POST', '/transactions/auto-categorize', () =>
    jsonResponse({
      job_id: '11111111-2222-3333-4444-555555555555',
      status: 'running',
      total: 12,
      processed: 0,
      updated: 0,
      skipped: 0,
      started_at: '2026-05-01T12:00:00.000Z',
      finished_at: null,
      error_message: null,
    })
  ),
  route('DELETE', '/transactions/auto-categorize', () =>
    jsonResponse({
      job_id: '11111111-2222-3333-4444-555555555555',
      status: 'cancelling',
      total: 12,
      processed: 4,
      updated: 2,
      skipped: 2,
      started_at: '2026-05-01T12:00:00.000Z',
      finished_at: null,
      error_message: null,
    })
  ),
];

export const storyPickerEmptyHandlers: StoryApiRoute[] = [
  route('GET', '/providers/info', () => jsonResponse(storyFullProviderCatalogInfo)),
  route('GET', '/providers/status', () =>
    jsonResponse({
      provider: null,
      connections: [],
    })
  ),
  route('GET', '/providers/accounts', () => jsonResponse([])),
  route('GET', '/providers/simplefin/ignored-institutions', () =>
    jsonResponse({ institutions: [] })
  ),
  storyPlaidLinkTokenHandler,
  ...storyAutoCategorizeHandlers,
];

export const storyOnboardingPickerHandlers: StoryApiRoute[] = [
  ...storyPickerEmptyHandlers,
  route('PUT', '/auth/onboarding/complete', () =>
    jsonResponse({ message: 'Onboarding completed', onboarding_completed: true })
  ),
  route('POST', '/providers/select', () => jsonResponse({ user_provider: 'simplefin' })),
];

export const storyBudgetRecords = sampleBudgetProgressEntries.map(
  ({ spent, percentage, ...budget }) => budget
);

export const storyTransactions = [...sampleTransactions, ...transactionsTablePage].map(
  (transaction, index) => toBackendTransaction(transaction, index + 1)
);

export const storyTransactionCategories = Array.from(
  new Set(storyTransactions.map((transaction) => transaction.category_primary ?? 'other'))
);

export const storyCategoryList = {
  system: storyTransactionCategories,
  custom: [
    {
      id: 'story-custom-coffee',
      display_name: 'Coffee',
      lookup_key: 'coffee',
    },
  ],
};

export function getPagedStoryTransactions(request: {
  page?: number;
  pageSize?: number;
  search?: string | null;
  categoryPrimary?: string | null;
}): { transactions: typeof storyTransactions; total: number; page: number; page_size: number } {
  const normalizedPage =
    Number.isFinite(request.page ?? NaN) && (request.page ?? 0) > 0
      ? Math.floor(request.page ?? 1)
      : 1;
  const normalizedPageSize =
    Number.isFinite(request.pageSize ?? NaN) && (request.pageSize ?? 0) > 0
      ? Math.floor(request.pageSize ?? 8)
      : 8;
  const search = request.search?.trim().toLowerCase();
  const categoryPrimary = request.categoryPrimary?.trim().toLowerCase();

  const filtered = storyTransactions.filter((transaction) => {
    const haystack = `${transaction.merchant_name ?? ''} ${transaction.account_name}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesCategory =
      !categoryPrimary || transaction.category_primary?.toLowerCase() === categoryPrimary;

    return matchesSearch && matchesCategory;
  });

  const start = (normalizedPage - 1) * normalizedPageSize;
  const end = start + normalizedPageSize;

  return {
    transactions: filtered.slice(start, end),
    total: filtered.length,
    page: normalizedPage,
    page_size: normalizedPageSize,
  };
}

export const storyAnalyticsCategories: AnalyticsCategoryResponse[] = sampleDonutByCategory.map(
  (item, index) => {
    const keys = ['food_and_drink', 'transportation', 'income', 'shopping'] as const;
    const category = keys[index] ?? `category_${index + 1}`;
    const amount = item.value;
    const total = sampleDonutByCategory.reduce((sum, entry) => sum + entry.value, 0) || 1;
    return {
      category,
      amount,
      count: Math.max(1, Math.round(amount / 20)),
      percentage: Math.round((amount / total) * 1000) / 10,
    };
  }
);

export const storyAnalyticsTopMerchants: AnalyticsTopMerchantsResponse[] = sampleTopMerchants;

export const storyAnalyticsMonthlyTotals: AnalyticsMonthlyTotalsResponse[] = Array.from(
  { length: 6 },
  (_, index) => {
    const month = currentMonthKey(index - 5);
    return {
      month,
      amount: 900 + index * 120,
    };
  }
);

export const storyNetWorthSeries = Array.from({ length: 5 }, (_, index) => {
  const month = new Date(storyNow.getFullYear(), storyNow.getMonth() - 4 + index, 1);
  return {
    date: month.toISOString().slice(0, 10),
    value: 11800 + index * 850,
  };
});

export const storyNetWorthResponse = {
  currency: 'USD',
  series: storyNetWorthSeries,
};

export const storyDashboardAnalyticsSpending = storyAnalyticsCategories.reduce(
  (sum, category) => sum + category.amount,
  0
);

export const storyBalancesOverview = {
  asOf: 'latest',
  overall: {
    cash: 31260.73,
    credit: -842.4,
    loan: 0,
    investments: 0,
    positivesTotal: 31260.73,
    negativesTotal: -842.4,
    net: 30418.33,
    ratio: null,
  },
  banks: [
    {
      bankId: 'story-plaid-conn-1',
      bankName: 'Story Federal Credit Union',
      cash: 31260.73,
      credit: 0,
      loan: 0,
      investments: 0,
      positivesTotal: 31260.73,
      negativesTotal: 0,
      net: 31260.73,
      ratio: null,
    },
    {
      bankId: 'story-plaid-conn-2',
      bankName: 'Metro Digital Bank',
      cash: 0,
      credit: -842.4,
      loan: 0,
      investments: 0,
      positivesTotal: 0,
      negativesTotal: -842.4,
      net: -842.4,
      ratio: null,
    },
  ],
  mixedCurrency: false,
};

export const storyDashboardFixtures = {
  accounts: storyProviderAccounts,
  balancesOverview: storyBalancesOverview,
  spendingTotal: storyDashboardAnalyticsSpending,
  categories: storyAnalyticsCategories,
  topMerchants: storyAnalyticsTopMerchants,
  monthlyTotals: storyAnalyticsMonthlyTotals,
  netWorth: storyNetWorthResponse,
};
