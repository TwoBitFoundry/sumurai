import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';
import { useAnalyticsDateBounds } from '@/features/analytics/hooks/useAnalyticsDateBounds';
import { useAccountFilter } from '@/hooks/useAccountFilter';
import { NAVIGATE_TO_ACCOUNTS_EVENT, NAVIGATE_TO_SETTINGS_EVENT } from '@/utils/events';

const motionSectionProps: Record<
  string,
  {
    custom?: number;
    initial?: { opacity: number; x: number };
    animate?: { opacity: number; x: number };
    exit?: { opacity: number; x: number };
  }
> = {};

jest.mock('framer-motion', () => {
  const R = require('react');
  return {
    motion: {
      div: ({ children, 'data-testid': testId, style, ...props }: any) =>
        R.createElement('div', { 'data-testid': testId, style, ...props }, children),
      section: ({
        children,
        'data-testid': testId,
        custom,
        initial,
        animate,
        exit,
        ...props
      }: any) => {
        if (testId) {
          motionSectionProps[testId] = { custom, initial, animate, exit };
        }
        return R.createElement('div', { 'data-testid': testId, ...props }, children);
      },
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

const appLayoutMock = jest.fn();

jest.mock('@/layouts/AppLayout', () => ({
  AppLayout: (props: { children: ReactNode; bottomBarContent?: ReactNode; currentTab: string }) => {
    appLayoutMock(props);
    return (
      <div>
        <div data-testid="bottom-bar">{props.bottomBarContent ?? null}</div>
        {props.children}
      </div>
    );
  },
}));

jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/HeaderAccountFilter', () => ({
  HeaderAccountFilter: () => <div data-testid="header-account-filter" />,
}));

jest.mock('@/hooks/useAccountFilter', () => ({
  useAccountFilter: jest.fn(),
}));

jest.mock('@/features/analytics/hooks/useAnalyticsDateBounds', () => ({
  useAnalyticsDateBounds: jest.fn(),
}));

jest.mock('@/views/AccountsPage', () => ({
  __esModule: true,
  default: () => <div>Accounts</div>,
}));

jest.mock('@/views/BudgetsPage', () => ({
  __esModule: true,
  default: () => <div>Budgets</div>,
}));

jest.mock('@/views/DashboardPage', () => ({
  __esModule: true,
  default: ({
    dateRange,
    customDateRange,
  }: {
    dateRange: string;
    customDateRange: { start: string; end: string } | null;
  }) => (
    <div>
      <div>{dateRange}</div>
      <div data-testid="dashboard-custom-date-range">
        {customDateRange ? `${customDateRange.start}|${customDateRange.end}` : 'none'}
      </div>
    </div>
  ),
}));

jest.mock('@/views/SettingsPage', () => ({
  __esModule: true,
  default: () => <div>Settings</div>,
}));

jest.mock('@/views/TransactionsPage', () => ({
  __esModule: true,
  default: () => <div>Transactions</div>,
}));

jest.mock('@/features/transactions/hooks/useTransactionFilterState', () => ({
  useTransactionFilterState: () => ({
    search: '',
    setSearch: jest.fn(),
    selectedCategory: null,
    setSelectedCategory: jest.fn(),
    currentPage: 1,
    setCurrentPage: jest.fn(),
  }),
}));

jest.mock('@/features/transactions/hooks/useCategories', () => ({
  useCategories: () => ({
    filterCategories: ['FOOD_AND_DRINK', 'BILLS'],
    custom: [],
    system: [],
    all: [],
    accentIndexByName: new Map(),
    isLoading: false,
    error: null,
  }),
}));

describe('AuthenticatedApp', () => {
  beforeEach(() => {
    jest.mocked(useAccountFilter).mockReturnValue({
      selectedAccountIds: [],
      allAccountIds: [],
      setSelectedAccountIds: jest.fn(),
    } as any);
    jest.mocked(useAnalyticsDateBounds).mockReturnValue({
      bounds: null,
      loading: false,
      refreshing: false,
      error: null,
      cacheKey: 'none',
    } as any);
    window.sessionStorage.clear();
    appLayoutMock.mockClear();
    for (const key of Object.keys(motionSectionProps)) delete motionSectionProps[key];
  });

  it('renders the date range control in the bottom bar for the dashboard tab', () => {
    render(<AuthenticatedApp onLogout={jest.fn()} isOnline demoModeActive={false} />);

    expect(screen.getByTestId('bottom-bar')).toHaveTextContent('Last mo');
    expect(screen.getByText('last-month')).toBeInTheDocument();
  });

  it('renders the budget month control in the bottom bar for the budgets tab', () => {
    render(
      <AuthenticatedApp onLogout={jest.fn()} isOnline demoModeActive={false} initialTab="budgets" />
    );

    expect(screen.getByTestId('budget-month-pill-slider')).toBeInTheDocument();
    expect(screen.getByText('Budgets')).toBeInTheDocument();
  });

  it('renders transaction search and category filters in the bottom bar for the transactions tab', () => {
    render(
      <AuthenticatedApp
        onLogout={jest.fn()}
        isOnline
        demoModeActive={false}
        initialTab="transactions"
      />
    );

    expect(screen.getByTestId('transactions-search-bar')).toBeInTheDocument();
    expect(screen.getByTestId('transactions-filters')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-contextual-bar-top')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });

  it('handleTabChange updates currentTab on AppLayout in both directions', () => {
    render(
      <AuthenticatedApp
        onLogout={jest.fn()}
        isOnline
        demoModeActive={false}
        initialTab="dashboard"
      />
    );

    const { onTabChange } = appLayoutMock.mock.calls[0][0];

    act(() => {
      onTabChange('transactions');
    });
    expect(appLayoutMock.mock.lastCall[0].currentTab).toBe('transactions');

    act(() => {
      appLayoutMock.mock.lastCall[0].onTabChange('dashboard');
    });
    expect(appLayoutMock.mock.lastCall[0].currentTab).toBe('dashboard');
  });

  it('switches to Settings when the navigation event is dispatched', () => {
    render(
      <AuthenticatedApp
        onLogout={jest.fn()}
        isOnline
        demoModeActive={false}
        initialTab="dashboard"
      />
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(NAVIGATE_TO_SETTINGS_EVENT));
    });

    expect(appLayoutMock.mock.lastCall[0].currentTab).toBe('settings');
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('switches to Accounts when the navigation event is dispatched', () => {
    render(
      <AuthenticatedApp
        onLogout={jest.fn()}
        isOnline
        demoModeActive={false}
        initialTab="settings"
      />
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(NAVIGATE_TO_ACCOUNTS_EVENT));
    });

    expect(appLayoutMock.mock.lastCall[0].currentTab).toBe('accounts');
    expect(screen.getByText('Accounts')).toBeInTheDocument();
  });

  it('animates the page body in the direction of tab travel', () => {
    render(
      <AuthenticatedApp
        onLogout={jest.fn()}
        isOnline
        demoModeActive={false}
        initialTab="dashboard"
      />
    );

    expect(motionSectionProps['tab-transition-panel']).toMatchObject({
      custom: 0,
      initial: { opacity: 0, x: 0 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 0 },
    });

    const { onTabChange } = appLayoutMock.mock.calls[0][0];

    act(() => {
      onTabChange('transactions');
    });

    expect(motionSectionProps['tab-transition-panel']).toMatchObject({
      custom: 1,
      initial: { opacity: 0, x: 24 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -24 },
    });

    act(() => {
      appLayoutMock.mock.lastCall[0].onTabChange('dashboard');
    });

    expect(motionSectionProps['tab-transition-panel']).toMatchObject({
      custom: -1,
      initial: { opacity: 0, x: -24 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 24 },
    });
  });

  it('falls back to the default preset when session stores custom without bounds', () => {
    window.sessionStorage.setItem('sumurai.ui.dashboardDateRange', 'custom');

    render(
      <AuthenticatedApp
        onLogout={jest.fn()}
        isOnline
        demoModeActive={false}
        initialTab="dashboard"
      />
    );

    expect(screen.getByText('last-month')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-custom-date-range')).toHaveTextContent('none');
    expect(window.sessionStorage.getItem('sumurai.ui.dashboardDateRange')).toBe('last-month');
    expect(window.sessionStorage.getItem('sumurai.ui.dashboardCustomDateRange')).toBeNull();
  });

  it('clamps a stored custom range into the fetched bounds', async () => {
    window.sessionStorage.setItem('sumurai.ui.dashboardDateRange', 'custom');
    window.sessionStorage.setItem(
      'sumurai.ui.dashboardCustomDateRange',
      JSON.stringify({ start: '2026-01-01', end: '2026-06-15' })
    );
    jest.mocked(useAnalyticsDateBounds).mockReturnValue({
      bounds: { start: '2026-02-01', end: '2026-05-31' },
      loading: false,
      refreshing: false,
      error: null,
      cacheKey: 'all',
    } as any);

    render(
      <AuthenticatedApp
        onLogout={jest.fn()}
        isOnline
        demoModeActive={false}
        initialTab="dashboard"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-custom-date-range')).toHaveTextContent(
        '2026-02-01|2026-05-31'
      );
    });

    expect(window.sessionStorage.getItem('sumurai.ui.dashboardCustomDateRange')).toBe(
      JSON.stringify({ start: '2026-02-01', end: '2026-05-31' })
    );
  });
});
