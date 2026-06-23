export const NAVIGATE_TO_TRANSACTIONS_EVENT = 'sumurai:navigate-to-transactions';

export interface NavigateToTransactionsDetail {
  search?: string;
  category?: string | null;
  accountIds?: string[];
}

export const dispatchNavigateToTransactions = (detail: NavigateToTransactionsDetail) => {
  window.dispatchEvent(new CustomEvent(NAVIGATE_TO_TRANSACTIONS_EVENT, { detail }));
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
