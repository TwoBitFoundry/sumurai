import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AuthenticatedApp } from '@/components/AuthenticatedApp'

type DashboardProps = { dark: boolean }

let DashboardPageMock: ReturnType<typeof vi.fn>
let TransactionsPageMock: ReturnType<typeof vi.fn>
let BudgetsPageMock: ReturnType<typeof vi.fn>
let ConnectPageMock: ReturnType<typeof vi.fn>

vi.mock('@/pages/DashboardPage', () => ({
  __esModule: true,
  default: (props: DashboardProps) => DashboardPageMock(props),
}))

vi.mock('@/pages/TransactionsPage', () => ({
  __esModule: true,
  default: () => TransactionsPageMock(),
}))
vi.mock('@/pages/BudgetsPage', () => ({
  __esModule: true,
  default: () => BudgetsPageMock(),
}))

vi.mock('@/pages/ConnectPage', () => ({
  __esModule: true,
  default: (props: { onError?: (value: string | null) => void }) => ConnectPageMock(props),
}))

describe('AuthenticatedApp shell', () => {
  const onLogout = vi.fn()
  const setDark = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    DashboardPageMock = vi.fn(({ dark }: DashboardProps) => (
      <div data-testid="dashboard-page">dashboard-{dark ? 'dark' : 'light'}</div>
    ))
    TransactionsPageMock = vi.fn(() => <div data-testid="transactions-page">transactions</div>)
    BudgetsPageMock = vi.fn(() => <div data-testid="budgets-page">budgets</div>)
    ConnectPageMock = vi.fn(({ onError }: { onError?: (value: string | null) => void }) => (
      <div data-testid="connect-page">
        <button onClick={() => onError?.('connect-error')} data-testid="trigger-connect-error">
          trigger error
        </button>
        <button onClick={() => onError?.(null)} data-testid="clear-connect-error">
          clear error
        </button>
      </div>
    ))
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const renderApp = (dark = false) =>
    render(<AuthenticatedApp onLogout={onLogout} dark={dark} setDark={setDark} />)

  it('renders dashboard by default', () => {
    renderApp()

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    expect(screen.queryByTestId('transactions-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('connect-page')).not.toBeInTheDocument()
  })

  it('navigates between tabs and toggles budgets visibility without extra props', async () => {
    const user = userEvent.setup()
    renderApp()

    const budgetsSection = screen.getByTestId('budgets-page').parentElement?.parentElement
    expect(BudgetsPageMock.mock.calls.at(-1)).toEqual([])
    expect(budgetsSection).toHaveClass('hidden')
    expect(budgetsSection).toHaveAttribute('aria-hidden', 'true')

    await user.click(screen.getByRole('button', { name: /transactions/i }))
    expect(screen.getByTestId('transactions-page')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /budgets/i }))
    const activeBudgetsSection = screen.getByTestId('budgets-page').parentElement?.parentElement
    expect(activeBudgetsSection).not.toHaveClass('hidden')
    expect(activeBudgetsSection).not.toHaveAttribute('aria-hidden')

    await user.click(screen.getByRole('button', { name: /connect/i }))
    expect(screen.getByTestId('connect-page')).toBeInTheDocument()
    const hiddenBudgetsSection = screen.getByTestId('budgets-page').parentElement?.parentElement
    expect(hiddenBudgetsSection).toHaveClass('hidden')
    expect(hiddenBudgetsSection).toHaveAttribute('aria-hidden', 'true')
  })

  it('surfaces errors from the connect page and clears them', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /connect/i }))
    await user.click(screen.getByTestId('trigger-connect-error'))
    expect(screen.getByText('connect-error')).toBeInTheDocument()

    await user.click(screen.getByTestId('clear-connect-error'))
    expect(screen.queryByText('connect-error')).not.toBeInTheDocument()
  })

  it('toggles theme and supports logout', async () => {
    const user = userEvent.setup()
    renderApp(false)

    await user.click(screen.getByLabelText(/toggle theme/i))
    expect(setDark).toHaveBeenCalledWith(true)

    await user.click(screen.getByRole('button', { name: /logout/i }))
    expect(onLogout).toHaveBeenCalled()
  })

  it('passes dark mode flag to dashboard', () => {
    renderApp(true)
    expect(DashboardPageMock).toHaveBeenCalledWith(expect.objectContaining({ dark: true }))
    expect(DashboardPageMock).toHaveBeenCalledTimes(1)
  })
})
