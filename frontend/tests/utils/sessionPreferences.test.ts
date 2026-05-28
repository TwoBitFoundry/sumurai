import {
  getSessionBankExpanded,
  getSessionDashboardDateRange,
  getSessionThemePreference,
  getSessionTransactionsCategory,
  getSessionTransactionsPage,
  getSessionTransactionsSearch,
  setSessionBankExpanded,
  setSessionDashboardDateRange,
  setSessionThemePreference,
  setSessionTransactionsCategory,
  setSessionTransactionsPage,
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
    setSessionDashboardDateRange('past-3-months');
    expect(getSessionDashboardDateRange()).toBe('past-3-months');
  });

  it('stores and restores transactions filters and page', () => {
    setSessionTransactionsSearch('coffee');
    setSessionTransactionsCategory('Food');
    setSessionTransactionsPage(3);

    expect(getSessionTransactionsSearch()).toBe('coffee');
    expect(getSessionTransactionsCategory()).toBe('Food');
    expect(getSessionTransactionsPage()).toBe(3);
  });

  it('defaults institution cards to collapsed and remembers expansion', () => {
    expect(getSessionBankExpanded('bank-1')).toBe(false);

    setSessionBankExpanded('bank-1', true);
    expect(getSessionBankExpanded('bank-1')).toBe(true);

    setSessionBankExpanded('bank-1', false);
    expect(getSessionBankExpanded('bank-1')).toBe(false);
  });
});
