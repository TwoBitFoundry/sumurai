import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';

const pageSwipePanHandlers: Record<
  string,
  (e: unknown, info: { offset: { x: number; y: number } }) => void
> = {};

jest.mock('framer-motion', () => {
  const R = require('react');
  return {
    motion: {
      div: ({ onPanEnd, children, 'data-testid': testId, style, ...props }: any) => {
        if (onPanEnd && testId) pageSwipePanHandlers[testId] = onPanEnd;
        return R.createElement('div', { 'data-testid': testId, style, ...props }, children);
      },
      section: ({ children, ...props }: any) => R.createElement('div', props, children),
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

function swipePage(offsetX: number) {
  act(() => {
    pageSwipePanHandlers['page-swipe-container']({}, { offset: { x: offsetX, y: 0 } });
  });
}

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

  describe('full-page swipe navigation', () => {
    it('swipe left advances to the next tab', () => {
      render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="dashboard" />);
      swipePage(-100);
      expect(appLayoutMock.mock.lastCall[0].currentTab).toBe('transactions');
    });

    it('swipe right goes to the previous tab', () => {
      render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="transactions" />);
      swipePage(100);
      expect(appLayoutMock.mock.lastCall[0].currentTab).toBe('dashboard');
    });

    it('swipe left on the last tab does nothing', () => {
      render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="accounts" />);
      const before = appLayoutMock.mock.lastCall[0].currentTab;
      swipePage(-100);
      expect(appLayoutMock.mock.lastCall[0].currentTab).toBe(before);
    });

    it('swipe right on the first tab does nothing', () => {
      render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="dashboard" />);
      const before = appLayoutMock.mock.lastCall[0].currentTab;
      swipePage(100);
      expect(appLayoutMock.mock.lastCall[0].currentTab).toBe(before);
    });

    it('swipe below 50px threshold does nothing', () => {
      render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="dashboard" />);
      const before = appLayoutMock.mock.lastCall[0].currentTab;
      swipePage(-30);
      expect(appLayoutMock.mock.lastCall[0].currentTab).toBe(before);
    });

    it('swipe is ignored on the settings tab', () => {
      render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="settings" />);
      const before = appLayoutMock.mock.lastCall[0].currentTab;
      swipePage(-100);
      expect(appLayoutMock.mock.lastCall[0].currentTab).toBe(before);
    });
  });
});
