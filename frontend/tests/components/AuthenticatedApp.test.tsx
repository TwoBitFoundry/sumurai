import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';

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
  default: ({ dateRange }: { dateRange: string }) => <div>{dateRange}</div>,
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
  }),
}));

jest.mock('@/features/transactions/hooks/useTransactionCategories', () => ({
  useTransactionCategories: () => ({
    categories: ['food_and_drink'],
    loading: false,
  }),
}));

describe('AuthenticatedApp', () => {
  beforeEach(() => {
    appLayoutMock.mockClear();
    for (const key of Object.keys(motionSectionProps)) delete motionSectionProps[key];
  });

  it('renders the date range control in the bottom bar for the dashboard tab', () => {
    render(<AuthenticatedApp onLogout={jest.fn()} isOnline />);

    expect(screen.getByTestId('bottom-bar')).toHaveTextContent('1M');
    expect(screen.getByText('current-month')).toBeInTheDocument();
  });

  it('renders the budget month control in the bottom bar for the budgets tab', () => {
    render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="budgets" />);

    expect(screen.getByTestId('budget-month-pill-slider')).toBeInTheDocument();
    expect(screen.getByText('Budgets')).toBeInTheDocument();
  });

  it('renders transaction category filters in the bottom bar for the transactions tab', () => {
    render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="transactions" />);

    expect(screen.getByTestId('transactions-search-bar')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });

  it('handleTabChange updates currentTab on AppLayout in both directions', () => {
    render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="dashboard" />);

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

  it('animates the page body in the direction of tab travel', () => {
    render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="dashboard" />);

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
});
