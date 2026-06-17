/**
 * Application events used to signal cross-feature data changes.
 */

export const ACCOUNTS_CHANGED_EVENT = 'accounts-changed';

export const dispatchAccountsChanged = () => {
  window.dispatchEvent(new Event(ACCOUNTS_CHANGED_EVENT));
};

export const NAVIGATE_TO_TRANSACTIONS_EVENT = 'sumurai:navigate-to-transactions';

export interface NavigateToTransactionsDetail {
  search?: string;
  category?: string | null;
  accountIds?: string[];
}

export const dispatchNavigateToTransactions = (detail: NavigateToTransactionsDetail) => {
  window.dispatchEvent(new CustomEvent(NAVIGATE_TO_TRANSACTIONS_EVENT, { detail }));
};
