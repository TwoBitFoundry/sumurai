/**
 * Application events used to signal cross-feature data changes.
 */

export const ACCOUNTS_CHANGED_EVENT = 'accounts-changed';

export const dispatchAccountsChanged = () => {
  window.dispatchEvent(new Event(ACCOUNTS_CHANGED_EVENT));
};
