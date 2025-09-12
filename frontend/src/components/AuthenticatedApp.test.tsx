import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthenticatedApp } from './AuthenticatedApp';
import { installFetchRoutes } from '../test/fetchRoutes';

// Mock only UI components and hooks for stability, not services
vi.mock('../hooks/usePlaidConnection');

// No service-level mocks for ApiClient — use boundary-level fetch routing

// Mock all recharts components to prevent rendering issues
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: () => <div data-testid="pie-chart" />,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => <div data-testid="line" />,
  AreaChart: () => <div data-testid="area-chart" />,
  Area: () => <div data-testid="area" />,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />
}));

// Mock hooks with static data
const mockPlaidConnection = {
  isConnected: false,
  institutionName: null,
  transactionCount: 0,
  accountCount: 0,
  lastSyncAt: null,
  syncInProgress: false,
  loading: false,
  error: null,
  connectionId: null,
  markConnected: vi.fn(),
  disconnect: vi.fn().mockResolvedValue(undefined),
  setSyncInProgress: vi.fn(),
  updateSyncInfo: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined)
};

vi.mock('../hooks/usePlaidConnection', () => ({
  usePlaidConnection: () => mockPlaidConnection
}));

describe('AuthenticatedApp - Systematic Testing', () => {
  const mockOnLogout = vi.fn();
  let fetchMock: ReturnType<typeof installFetchRoutes>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Use real timers; keeping time unfrozen avoids waitFor interplay issues
    
    // Default boundary-level routes
    fetchMock = installFetchRoutes({
      'GET /api/plaid/status': { is_connected: false, account_count: 0, last_sync_at: null, institution_name: null, connection_id: null, sync_in_progress: false, transaction_count: 0 },
      'GET /api/transactions': [
        {
          id: '1',
          date: '2025-08-15',
          name: 'Coffee Shop',
          merchantName: 'Starbucks',
          amount: 5.99,
          category: { id: 'food', name: 'Food & Dining' }
        }
      ],
      // Allow any date-range variants via wildcard
      'GET /api/analytics/spending*': 1234.56,
      'GET /api/analytics/categories*': [
        { category: 'Food & Dining', amount: 450.25, count: 15, percentage: 36.5 },
        { category: 'Transportation', amount: 280.5, count: 8, percentage: 22.7 }
      ],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 1000 },
        { month: '2025-08', amount: 1100 }
      ],
      'GET /api/analytics/top-merchants*': [],
      'GET /api/budgets': [
        { id: '1', category: 'Food', month: '2025-08', amount: 500.0, spent: 350.0, remaining: 150.0, percentage: 70.0 }
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should render dashboard without infinite loops', async () => {
    render(<AuthenticatedApp onLogout={mockOnLogout} />);
    
    await waitFor(() => {
      expect(screen.getByText('Spending')).toBeInTheDocument();
    });
    
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('should call backend APIs on initial load', async () => {
    render(<AuthenticatedApp onLogout={mockOnLogout} />);
    
    await waitFor(() => {
      const called = (fetchMock as any).mock.calls.map((c: any[]) => String(c[0]));
      expect(called.find((u: string) => u === '/api/transactions')).toBeTruthy();
    });
    
    // Verify some analytics endpoints were called
    const called = (fetchMock as any).mock.calls.map((c: any[]) => String(c[0]));
    expect(called.some((u: string) => u.startsWith('/api/analytics/'))).toBe(true);
  });

  it('should navigate between tabs', async () => {
    render(<AuthenticatedApp onLogout={mockOnLogout} />);
    
    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Spending')).toBeInTheDocument();
    });
    
    // Navigate to transactions tab
    const transactionsButton = screen.getByRole('button', { name: /transactions/i });
    transactionsButton.click();
    
    // Should show transactions interface
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search transactions')).toBeInTheDocument();
    });
    
    // Navigate to budgets tab  
    const budgetsButton = screen.getByRole('button', { name: /budgets/i });
    budgetsButton.click();
    
    // Should show budgets interface
    await waitFor(() => {
      expect(screen.getByText(/budgets/i)).toBeInTheDocument();
    });
  });

  it('filters transactions client-side without backend search', async () => {
    // Seed initial transactions from the standard mock in beforeEach
    render(<AuthenticatedApp onLogout={mockOnLogout} />);

    // Navigate to transactions tab
    fireEvent.click(screen.getByRole('button', { name: /transactions/i }));

    // Find search input
    const searchInput = await waitFor(() => 
      screen.getByPlaceholderText('Search transactions')
    );

    // Clear mock call history to isolate search behavior
    ;(fetchMock as any).mockClear();

    // Perform search
    fireEvent.change(searchInput, { target: { value: 'coffee' } });

    // Verify no backend call made for search
    await waitFor(() => {
      const calls = (fetchMock as any).mock.calls.map((c: any[]) => String(c[0]));
      expect(calls.some((u: string) => u.includes('search='))).toBe(false);
    });
  });

  

  it('should handle error states gracefully', async () => {
    // Mock fetch to throw for analytics, leave others minimal
    fetchMock = installFetchRoutes({
      'GET /api/plaid/status': { is_connected: false },
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': new Response('Server error', { status: 500 }),
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 }
      ],
      'GET /api/analytics/top-merchants*': [],
      'GET /api/budgets': [],
    });

    render(<AuthenticatedApp onLogout={mockOnLogout} />);
    
    // Component should still render despite API errors
    await waitFor(() => {
      expect(screen.getByText('Spending')).toBeInTheDocument();
    });
    
    // Should have attempted to call analytics
    const called = (fetchMock as any).mock.calls.map((c: any[]) => String(c[0]));
    expect(called.some((u: string) => u.startsWith('/api/analytics/'))).toBe(true);
  });


  it('colors positive amounts red and negative amounts green in Transactions', async () => {
    // Arrange: return one positive and one negative transaction
    fetchMock = installFetchRoutes({
      'GET /api/plaid/status': { is_connected: false },
      'GET /api/transactions': [
        {
          id: 't1',
          date: '2025-08-20',
          name: 'Salary',
          amount: 100.0,
          category: { id: 'income', name: 'Income' },
        },
        {
          id: 't2',
          date: '2025-08-21',
          name: 'Groceries',
          amount: -25.0,
          category: { id: 'food', name: 'Food & Dining' },
        },
      ],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 }
      ],
      'GET /api/analytics/top-merchants*': [],
      'GET /api/budgets': [],
    });

    render(<AuthenticatedApp onLogout={mockOnLogout} />);

    // Act: go to Transactions tab
    fireEvent.click(screen.getByRole('button', { name: /transactions/i }));

    // Assert: amounts are present and colored as specified
    const positive = await waitFor(() => screen.getByText(/\$100\.00/));
    expect(positive).toHaveClass('text-red-600');

    // Negative may render with a leading minus sign, e.g. -$25.00
    const negative = screen.getByText(/-?\$25\.00/);
    expect(negative).toHaveClass('text-green-600');
  });
});
