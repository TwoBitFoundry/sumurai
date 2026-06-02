import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthenticatedApp } from '@/components/AuthenticatedApp';

const pageSwipeHandlers: Record<
  string,
  {
    onPanStart?: (e: { target: EventTarget | null }) => void;
    onPanEnd?: (e: unknown, info: { offset: { x: number; y: number } }) => void;
  }
> = {};

jest.mock('framer-motion', () => {
  const R = require('react');
  return {
    motion: {
      div: ({ onPanStart, onPanEnd, children, 'data-testid': testId, style, ...props }: any) => {
        if (testId && (onPanStart || onPanEnd)) {
          pageSwipeHandlers[testId] = { onPanStart, onPanEnd };
        }
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

function swipePage(offsetX: number, target: EventTarget | null = null) {
  act(() => {
    pageSwipeHandlers['page-swipe-container'].onPanStart?.({ target });
    pageSwipeHandlers['page-swipe-container'].onPanEnd?.({}, { offset: { x: offsetX, y: 0 } });
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
      onTabChange('dashboard');
    });
    expect(appLayoutMock.mock.lastCall[0].currentTab).toBe('dashboard');
  });

  describe('full-page swipe navigation', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query: string) => ({
          matches: query === '(pointer: coarse)',
          media: query,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          addListener: jest.fn(),
          removeListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
    });

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

    it('swipe is ignored when panning starts inside a data-no-swipe element', () => {
      render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="dashboard" />);
      const noSwipeEl = document.createElement('div');
      noSwipeEl.dataset.noSwipe = '';
      document.body.appendChild(noSwipeEl);
      swipePage(-100, noSwipeEl);
      expect(appLayoutMock.mock.lastCall[0].currentTab).toBe('dashboard');
      document.body.removeChild(noSwipeEl);
    });

    it('swipe is ignored when panning starts inside a child of a data-no-swipe element', () => {
      render(<AuthenticatedApp onLogout={jest.fn()} isOnline initialTab="dashboard" />);
      const noSwipeEl = document.createElement('div');
      noSwipeEl.dataset.noSwipe = '';
      const child = document.createElement('span');
      noSwipeEl.appendChild(child);
      document.body.appendChild(noSwipeEl);
      swipePage(-100, child);
      expect(appLayoutMock.mock.lastCall[0].currentTab).toBe('dashboard');
      document.body.removeChild(noSwipeEl);
    });
  });
});
