import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AuthenticatedApp } from '@/components/AuthenticatedApp'
import { AccountFilterProvider } from '@/hooks/useAccountFilter'
import { ThemeTestProvider } from '@tests/utils/ThemeTestProvider'
import { installFetchRoutes } from '@tests/utils/fetchRoutes'
import { createProviderConnection, createProviderStatus } from '@tests/utils/fixtures'

let DashboardPageMock: ReturnType<typeof vi.fn>
let TransactionsPageMock: ReturnType<typeof vi.fn>
let BudgetsPageMock: ReturnType<typeof vi.fn>
let AccountsPageMock: ReturnType<typeof vi.fn>

jest.mock('@/pages/DashboardPage', () => ({
  __esModule: true,
  default: () => DashboardPageMock(),
}))

jest.mock('@/pages/TransactionsPage', () => ({
  __esModule: true,
  default: () => TransactionsPageMock(),
}))
jest.mock('@/pages/BudgetsPage', () => ({
  __esModule: true,
  default: () => BudgetsPageMock(),
}))

jest.mock('@/pages/AccountsPage', () => ({
  __esModule: true,
  default: (props: { onError?: (value: string | null) => void }) => AccountsPageMock(props),
}))

describe('AuthenticatedApp shell', () => {
  const onLogout = vi.fn()
  let fetchMock: ReturnType<typeof installFetchRoutes>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    fetchMock = installFetchRoutes({
      'GET /api/plaid/accounts': [
        {
          id: 'account1',
          name: 'Test Checking',
          account_type: 'depository',
          balance_ledger: 1200,
          balance_available: 1180,
          balance_current: 1200,
          mask: '1111',
          plaid_connection_id: 'conn_1',
          institution_name: 'Test Bank',
          provider: 'plaid'
        },
        {
          id: 'account2',
          name: 'Test Savings',
          account_type: 'depository',
          balance_ledger: 5400,
          balance_available: 5400,
          balance_current: 5400,
          mask: '2222',
          plaid_connection_id: 'conn_1',
          institution_name: 'Test Bank',
          provider: 'plaid'
        }
      ],
      'GET /api/providers/status': createProviderStatus({
        connections: [
          createProviderConnection({
            is_connected: true,
            institution_name: 'Test Bank',
            connection_id: 'conn_1',
          }),
        ],
      }),
    })

    DashboardPageMock = vi.fn(() => (
      <div data-testid="dashboard-page">dashboard</div>
    ))
    TransactionsPageMock = vi.fn(() => <div data-testid="transactions-page">transactions</div>)
    BudgetsPageMock = vi.fn(() => <div data-testid="budgets-page">budgets</div>)
    AccountsPageMock = vi.fn(({ onError }: { onError?: (value: string | null) => void }) => (
      <div data-testid="accounts-page">
        <button onClick={() => onError?.('accounts-error')} data-testid="trigger-accounts-error">
          trigger error
        </button>
        <button onClick={() => onError?.(null)} data-testid="clear-accounts-error">
          clear error
        </button>
      </div>
    ))
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    localStorage.clear()
  })

  const renderApp = () =>
    render(
      <ThemeTestProvider>
        <AccountFilterProvider>
          <AuthenticatedApp onLogout={onLogout} />
        </AccountFilterProvider>
      </ThemeTestProvider>
    )

  it('renders dashboard by default', () => {
    renderApp()

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    expect(screen.queryByTestId('transactions-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('accounts-page')).not.toBeInTheDocument()
  })

  it('navigates between tabs and toggles budgets visibility without extra props', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(BudgetsPageMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('budgets-page')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^transactions$/i }))
    expect(await screen.findByTestId('transactions-page')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^budgets$/i }))
    await waitFor(() => {
      expect(BudgetsPageMock).toHaveBeenCalled()
    })
    expect(await screen.findByTestId('budgets-page')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^accounts$/i }))
    expect(await screen.findByTestId('accounts-page')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByTestId('budgets-page')).not.toBeInTheDocument()
    })
  })

  it('surfaces errors from the accounts page and clears them', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /^accounts$/i }))
    expect(await screen.findByTestId('accounts-page')).toBeInTheDocument()

    await user.click(await screen.findByTestId('trigger-accounts-error'))
    expect(screen.getByText('accounts-error')).toBeInTheDocument()

    await user.click(await screen.findByTestId('clear-accounts-error'))
    expect(screen.queryByText('accounts-error')).not.toBeInTheDocument()
  })

  it('supports theme toggle and logout', async () => {
    const user = userEvent.setup()
    renderApp()

    const themeButton = screen.getByLabelText(/toggle theme/i)
    expect(themeButton).toBeInTheDocument()
    await user.click(themeButton)

    await user.click(screen.getByRole('button', { name: /logout/i }))
    expect(onLogout).toHaveBeenCalled()
  })

  it('includes HeaderAccountFilter in the header', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /all accounts/i })).toBeInTheDocument()
    })
  })

  it('maintains responsive layout with HeaderAccountFilter', async () => {
    renderApp()
    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()

    await waitFor(() => {
      const accountFilter = screen.getByRole('button', { name: /all accounts/i })
      expect(accountFilter).toBeInTheDocument()
    })

    const nav = screen.getByRole('navigation', { name: /primary/i })
    expect(nav).toBeInTheDocument()
  })
})
