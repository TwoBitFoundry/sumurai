import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthenticatedApp } from '@/components/AuthenticatedApp'
import { AccountFilterProvider } from '@/hooks/useAccountFilter'
import { installFetchRoutes } from '@tests/utils/fetchRoutes'
import { createProviderStatus } from '@tests/utils/fixtures'

describe('User-Friendly Error Messages and Empty States (Boundary Mocks)', () => {
  const user = userEvent.setup()
  const originalConsoleError = console.error
  const mockOnLogout = vi.fn()
  const mockSetDark = vi.fn()
  let fetchMock: ReturnType<typeof installFetchRoutes>
  const disconnectedStatus = createProviderStatus()

  beforeEach(() => {
    vi.clearAllMocks()
    console.error = vi.fn()
    // Default boundary routes
    fetchMock = installFetchRoutes({
      'GET /api/providers/status': disconnectedStatus,
      'GET /api/plaid/accounts': [],
      'GET /api/transactions*': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/daily-spending-range*': [],
      'GET /api/analytics/monthly-totals*': [
        { month: '2025-07', amount: 0 },
        { month: '2025-08', amount: 0 },
      ],
      'GET /api/analytics/top-merchants*': [],
      'GET /api/analytics/net-worth-over-time*': [],
      'GET /api/analytics/balances/overview': { total_assets: 0, total_liabilities: 0, net_worth: 0 },
      'GET /api/budgets': [],
    })
  })

  afterEach(() => {
    console.error = originalConsoleError
    cleanup()
  })

  describe('Network Error Messages', () => {
    it('renders dashboard when analytics API is unreachable (500)', async () => {
      fetchMock = installFetchRoutes({
        'GET /api/providers/status': disconnectedStatus,
        'GET /api/plaid/accounts': [],
        'GET /api/transactions*': [],
        'GET /api/analytics/spending*': new Response('Server error', { status: 500 }),
        'GET /api/analytics/categories*': [],
        'GET /api/analytics/daily-spending-range*': [],
        'GET /api/analytics/monthly-totals*': [
          { month: '2025-07', amount: 0 },
          { month: '2025-08', amount: 0 },
        ],
        'GET /api/analytics/top-merchants*': [],
        'GET /api/analytics/net-worth-over-time*': [],
        'GET /api/analytics/balances/overview': { total_assets: 0, total_liabilities: 0, net_worth: 0 },
        'GET /api/budgets': [],
      })

      render(
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={mockOnLogout} dark={false} setDark={mockSetDark} />
        </AccountFilterProvider>
      )
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^dashboard$/i })).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('continues rendering on timeout-like errors', async () => {
      fetchMock = installFetchRoutes({
        'GET /api/providers/status': disconnectedStatus,
        'GET /api/plaid/accounts': [],
        'GET /api/transactions*': [],
        'GET /api/analytics/spending*': () => { throw new Error('Request timeout') },
        'GET /api/analytics/categories*': [],
        'GET /api/analytics/daily-spending-range*': [],
        'GET /api/analytics/monthly-totals*': [],
        'GET /api/analytics/top-merchants*': [],
        'GET /api/analytics/net-worth-over-time*': [],
        'GET /api/analytics/balances/overview': { total_assets: 0, total_liabilities: 0, net_worth: 0 },
        'GET /api/budgets': [],
      })

      render(
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={mockOnLogout} dark={false} setDark={mockSetDark} />
        </AccountFilterProvider>
      )
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^dashboard$/i })).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Empty State Messages', () => {
    it('shows friendly message when no transactions exist', async () => {
      fetchMock = installFetchRoutes({
        'GET /api/providers/status': disconnectedStatus,
        'GET /api/plaid/accounts': [],
        'GET /api/transactions': [],
        'GET /api/analytics/spending*': 0,
        'GET /api/analytics/categories*': [],
        'GET /api/analytics/daily-spending-range*': [],
        'GET /api/analytics/monthly-totals*': [],
        'GET /api/analytics/top-merchants*': [],
        'GET /api/analytics/net-worth-over-time*': [],
        'GET /api/analytics/balances/overview': { total_assets: 0, total_liabilities: 0, net_worth: 0 },
        'GET /api/budgets': [],
      })

      render(
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={mockOnLogout} dark={false} setDark={mockSetDark} />
        </AccountFilterProvider>
      )
      await waitFor(() => {
        expect(screen.getByText(/No transactions found/i)).toBeInTheDocument()
        expect(screen.getByText(/No transaction data available/i)).toBeInTheDocument()
      })
    })

    it('shows message when budgets are not set up', async () => {
      fetchMock = installFetchRoutes({
        'GET /api/providers/status': disconnectedStatus,
        'GET /api/plaid/accounts': [],
        'GET /api/transactions': [],
        'GET /api/analytics/spending*': 0,
        'GET /api/analytics/categories*': [],
        'GET /api/analytics/daily-spending-range*': [],
        'GET /api/analytics/monthly-totals*': [],
        'GET /api/analytics/top-merchants*': [],
        'GET /api/analytics/net-worth-over-time*': [],
        'GET /api/analytics/balances/overview': { total_assets: 0, total_liabilities: 0, net_worth: 0 },
        'GET /api/budgets': [],
      })

      render(
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={mockOnLogout} dark={false} setDark={mockSetDark} />
        </AccountFilterProvider>
      )
      await user.click(screen.getByText('Budgets'))
      await waitFor(() => {
        expect(screen.getByText(/No budgets found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Graceful Degradation', () => {
    it('continues showing partial data when some services fail', async () => {
      fetchMock = installFetchRoutes({
        'GET /api/providers/status': disconnectedStatus,
        'GET /api/plaid/accounts': [],
        // Return backend transaction shape; service maps merchant_name -> name
        'GET /api/transactions*': [
          { id: '1', date: '2023-01-01', merchant_name: 'Test', amount: 100, category_primary: 'other' },
        ],
        'GET /api/analytics/spending*': new Response('Server error', { status: 500 }),
        'GET /api/analytics/categories*': [],
        'GET /api/analytics/daily-spending-range*': [],
        'GET /api/analytics/monthly-totals*': [],
        'GET /api/analytics/top-merchants*': [],
        'GET /api/analytics/net-worth-over-time*': [],
        'GET /api/analytics/balances/overview': { total_assets: 0, total_liabilities: 0, net_worth: 0 },
        'GET /api/budgets': [],
      })

      render(
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={mockOnLogout} dark={false} setDark={mockSetDark} />
        </AccountFilterProvider>
      )
      await user.click(screen.getByText('Transactions'))
      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument()
      })
    })
  })

  describe('User Actions and Recovery', () => {
    it('allows retry on network errors for transactions', async () => {
      let attempts = 0
      fetchMock = installFetchRoutes({
        'GET /api/providers/status': disconnectedStatus,
        'GET /api/plaid/accounts': [],
        'GET /api/transactions*': () => {
          attempts += 1
          if (attempts === 1) throw new Error('Network error')
          // Return backend transaction shape
          return new Response(JSON.stringify([
            { id: '1', date: '2023-01-01', merchant_name: 'Retry Success', amount: 50, category_primary: 'other' }
          ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
        },
        'GET /api/analytics/spending*': 0,
        'GET /api/analytics/categories*': [],
        'GET /api/analytics/daily-spending-range*': [],
        'GET /api/analytics/monthly-totals*': [],
        'GET /api/analytics/top-merchants*': [],
        'GET /api/analytics/net-worth-over-time*': [],
        'GET /api/analytics/balances/overview': { total_assets: 0, total_liabilities: 0, net_worth: 0 },
        'GET /api/budgets': [],
      })

      render(
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={mockOnLogout} dark={false} setDark={mockSetDark} />
        </AccountFilterProvider>
      )
      await user.click(screen.getByText('Transactions'))
      await waitFor(() => {
        expect(screen.getByText(/Retry Success/)).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('continues rendering when budgets fail to load', async () => {
      fetchMock = installFetchRoutes({
        'GET /api/providers/status': disconnectedStatus,
        'GET /api/plaid/accounts': [],
        'GET /api/transactions': [],
        'GET /api/analytics/spending*': 0,
        'GET /api/analytics/categories*': [],
        'GET /api/analytics/daily-spending-range*': [],
        'GET /api/analytics/monthly-totals*': [],
        'GET /api/analytics/top-merchants*': [],
        'GET /api/analytics/net-worth-over-time*': [],
        'GET /api/analytics/balances/overview': { total_assets: 0, total_liabilities: 0, net_worth: 0 },
        'GET /api/budgets': new Response('Not found', { status: 404 }),
      })

      render(
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={mockOnLogout} dark={false} setDark={mockSetDark} />
        </AccountFilterProvider>
      )
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^dashboard$/i })).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })
})
