export const NAVIGATE_TO_TRANSACTIONS_EVENT = 'sumurai:navigate-to-transactions';
export const NAVIGATE_TO_ACCOUNTS_EVENT = 'sumurai:navigate-to-accounts';
export const NAVIGATE_TO_SETTINGS_EVENT = 'sumurai:navigate-to-settings';
export const OPEN_PRICING_EVENT = 'sumurai:open-pricing';
export const PAID_ACCESS_REQUIRED_EVENT = 'sumurai:paid-access-required';

export interface NavigateToTransactionsDetail {
  search?: string;
  category?: string | null;
  accountIds?: string[];
}

export const dispatchNavigateToTransactions = (detail: NavigateToTransactionsDetail) => {
  window.dispatchEvent(new CustomEvent(NAVIGATE_TO_TRANSACTIONS_EVENT, { detail }));
};

export const dispatchNavigateToSettings = () => {
  window.dispatchEvent(new CustomEvent(NAVIGATE_TO_SETTINGS_EVENT));
};

export const dispatchNavigateToAccounts = () => {
  window.dispatchEvent(new CustomEvent(NAVIGATE_TO_ACCOUNTS_EVENT));
};

export const dispatchOpenPricing = () => {
  window.dispatchEvent(new CustomEvent(OPEN_PRICING_EVENT));
};

export const dispatchPaidAccessRequired = () => {
  window.dispatchEvent(new CustomEvent(PAID_ACCESS_REQUIRED_EVENT));
};

export const FINANCIAL_STATE_CHANGED_EVENT = 'sumurai:financial-state-changed';

export type FinancialStateRefreshTab =
  | 'dashboard'
  | 'transactions'
  | 'budgets'
  | 'accounts'
  | 'settings';

export interface FinancialStateChangedDetail {
  mode: 'accounts' | 'app';
  tab?: FinancialStateRefreshTab;
  refreshSession?: boolean;
}

export const dispatchFinancialAccountsRefresh = () => {
  window.dispatchEvent(
    new CustomEvent<FinancialStateChangedDetail>(FINANCIAL_STATE_CHANGED_EVENT, {
      detail: { mode: 'accounts' },
    })
  );
};

export const dispatchFinancialAppRefresh = (detail: Omit<FinancialStateChangedDetail, 'mode'>) => {
  window.dispatchEvent(
    new CustomEvent<FinancialStateChangedDetail>(FINANCIAL_STATE_CHANGED_EVENT, {
      detail: { mode: 'app', ...detail },
    })
  );
};

export const dispatchAccountsChanged = dispatchFinancialAccountsRefresh;

export const dispatchProviderConnected = () => {
  dispatchFinancialAppRefresh({ tab: 'accounts', refreshSession: true });
};
