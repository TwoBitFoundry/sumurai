import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';

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

describe('AuthenticatedApp', () => {
  beforeEach(() => {
    appLayoutMock.mockClear();
  });

  it('renders the date range control in the bottom bar for the dashboard tab', () => {
    render(<AuthenticatedApp onLogout={jest.fn()} isOnline />);

    expect(screen.getByTestId('bottom-bar')).toHaveTextContent('1M');
    expect(screen.getByText('current-month')).toBeInTheDocument();
  });

  it('handleTabChange updates currentTab on AppLayout in both directions', () => {
    render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="dashboard" />);

    const { onTabChange } = appLayoutMock.mock.calls[0][0];

    act(() => {
      onTabChange('transactions');
    });
    expect(appLayoutMock.mock.lastCall[0].currentTab).toBe('transactions');

    act(() => {
      onTabChange('dashboard');
    });
    expect(appLayoutMock.mock.lastCall[0].currentTab).toBe('dashboard');
  });
});
