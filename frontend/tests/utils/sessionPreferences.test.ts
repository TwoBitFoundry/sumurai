import {
  getSessionBankExpanded,
  getSessionBudgetsSectionExpanded,
  getSessionCollapsibleExpanded,
  getSessionDashboardCustomDateRange,
  getSessionDashboardDateRange,
  getSessionThemePreference,
  getSessionTransactionsCategory,
  getSessionTransactionsSearch,
  setSessionBankExpanded,
  setSessionBudgetsSectionExpanded,
  setSessionCollapsibleExpanded,
  setSessionDashboardCustomDateRange,
  setSessionDashboardDateRange,
  setSessionThemePreference,
  setSessionTransactionsCategory,
  setSessionTransactionsSearch,
} from '@/utils/sessionPreferences';

describe('sessionPreferences', () => {
  let sessionStorageData: Record<string, string> = {};

  beforeEach(() => {
    sessionStorageData = {};
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (key: string) => sessionStorageData[key] ?? null,
        setItem: (key: string, value: string) => {
          sessionStorageData[key] = value;
        },
        removeItem: (key: string) => {
          delete sessionStorageData[key];
        },
        clear: () => {
          sessionStorageData = {};
        },
      },
      writable: true,
    });
  });

  it('stores and restores theme preference in session storage', () => {
    setSessionThemePreference('dark');
    expect(getSessionThemePreference()).toBe('dark');
  });

  it('stores and restores dashboard date range', () => {
    setSessionDashboardDateRange('ytd');
    expect(getSessionDashboardDateRange()).toBe('ytd');
  });

  it('stores and restores dashboard custom date range', () => {
    setSessionDashboardCustomDateRange({ start: '2026-01-01', end: '2026-03-15' });
    expect(getSessionDashboardCustomDateRange()).toEqual({
      start: '2026-01-01',
      end: '2026-03-15',
    });
  });

  it('stores and restores transactions search and category filters', () => {
    setSessionTransactionsSearch('coffee');
    setSessionTransactionsCategory('Food');

    expect(getSessionTransactionsSearch()).toBe('coffee');
    expect(getSessionTransactionsCategory()).toBe('Food');
  });

  it('defaults institution cards to collapsed and remembers expansion', () => {
    expect(getSessionBankExpanded('bank-1')).toBe(false);

    setSessionBankExpanded('bank-1', true);
    expect(getSessionBankExpanded('bank-1')).toBe(true);

    setSessionBankExpanded('bank-1', false);
    expect(getSessionBankExpanded('bank-1')).toBe(false);
  });

  it('defaults budgets sections to collapsed and remembers expansion', () => {
    expect(getSessionBudgetsSectionExpanded('subscriptions')).toBe(false);

    setSessionBudgetsSectionExpanded('subscriptions', true);
    expect(getSessionBudgetsSectionExpanded('subscriptions')).toBe(true);

    setSessionBudgetsSectionExpanded('subscriptions', false);
    expect(getSessionBudgetsSectionExpanded('subscriptions')).toBe(false);
  });

  it('defaults collapsible sections to collapsed and remembers expansion', () => {
    expect(getSessionCollapsibleExpanded('balances-insights')).toBe(false);

    setSessionCollapsibleExpanded('balances-insights', true);
    expect(getSessionCollapsibleExpanded('balances-insights')).toBe(true);

    setSessionCollapsibleExpanded('balances-insights', false);
    expect(getSessionCollapsibleExpanded('balances-insights')).toBe(false);
  });

  it('reads legacy budgets section keys from the collapsible map', () => {
    sessionStorageData['sumurai.ui.budgetsSectionExpanded'] = JSON.stringify({
      subscriptions: true,
    });

    expect(getSessionCollapsibleExpanded('subscriptions')).toBe(true);
    expect(getSessionCollapsibleExpanded('fixed-expenses')).toBe(true);
  });
});
