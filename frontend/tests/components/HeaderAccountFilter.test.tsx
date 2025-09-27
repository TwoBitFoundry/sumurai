import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HeaderAccountFilter } from '@/components/HeaderAccountFilter'
import { AccountFilterProvider } from '@/hooks/useAccountFilter'
import { installFetchRoutes } from '@tests/utils/fetchRoutes'

describe('HeaderAccountFilter', () => {
  let fetchMock: ReturnType<typeof installFetchRoutes>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    fetchMock = installFetchRoutes({
      'GET /api/plaid/accounts': [
        {
          id: 'acc_1',
          name: 'Chase Checking',
          account_type: 'depository',
          balance_current: 1250.50,
          mask: '0000'
        },
        {
          id: 'acc_2',
          name: 'Chase Savings',
          account_type: 'depository',
          balance_current: 5000.00,
          mask: '1111'
        },
        {
          id: 'acc_3',
          name: 'Wells Fargo Credit Card',
          account_type: 'credit',
          balance_current: -350.75,
          mask: '2222'
        }
      ]
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    localStorage.clear()
  })

  const renderComponent = () => {
    return render(
      <AccountFilterProvider>
        <HeaderAccountFilter />
      </AccountFilterProvider>
    )
  }

  describe('Given the component is rendered', () => {
    describe('When no custom selection is made', () => {
      it('Then it should render "All accounts" by default', async () => {
        renderComponent()

        expect(screen.getByText('All accounts')).toBeInTheDocument()
      })
    })

    describe('When the trigger button is clicked', () => {
      it('Then the popover should open', async () => {
        const user = userEvent.setup()
        renderComponent()

        const trigger = screen.getByRole('button', { name: /all accounts/i })
        expect(trigger).toBeInTheDocument()

        await user.click(trigger)

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument()
        })
      })

      it('Then the popover should close when clicked again', async () => {
        const user = userEvent.setup()
        renderComponent()

        const trigger = screen.getByRole('button', { name: /all accounts/i })

        await user.click(trigger)
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument()
        })

        await user.click(trigger)
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
      })
    })

    describe('When accounts are loaded', () => {
      it('Then it should display grouped checklists by bank', async () => {
        const user = userEvent.setup()
        renderComponent()

        const trigger = screen.getByRole('button', { name: /all accounts/i })
        await user.click(trigger)

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument()
        })

        await waitFor(() => {
          expect(screen.getByText('Bank')).toBeInTheDocument()
        })

        expect(screen.getByText('Chase Checking')).toBeInTheDocument()
        expect(screen.getByText('Chase Savings')).toBeInTheDocument()
        expect(screen.getByText('Wells Fargo Credit Card')).toBeInTheDocument()
      })

      it('Then "All accounts" toggle should clear custom selections', async () => {
        const user = userEvent.setup()
        renderComponent()

        const trigger = screen.getByRole('button', { name: /all accounts/i })
        await user.click(trigger)

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument()
        })

        await waitFor(() => {
          expect(screen.getByText('Bank')).toBeInTheDocument()
        })

        const chaseCheckingCheckbox = screen.getByLabelText('Chase Checking')
        await user.click(chaseCheckingCheckbox)

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /1 accounts/i })).toBeInTheDocument()
        })

        const allAccountsToggle = screen.getByLabelText('All accounts')
        await user.click(allAccountsToggle)

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /all accounts/i })).toBeInTheDocument()
        })
      })

      it('Then individual account toggle should work correctly', async () => {
        const user = userEvent.setup()
        renderComponent()

        const trigger = screen.getByRole('button', { name: /all accounts/i })
        await user.click(trigger)

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument()
        })

        await waitFor(() => {
          expect(screen.getByText('Bank')).toBeInTheDocument()
        })

        const chaseCheckingCheckbox = screen.getByLabelText('Chase Checking')
        expect(chaseCheckingCheckbox).not.toBeChecked()

        await user.click(chaseCheckingCheckbox)
        expect(chaseCheckingCheckbox).toBeChecked()

        await user.click(chaseCheckingCheckbox)
        expect(chaseCheckingCheckbox).not.toBeChecked()
      })
    })

    describe('When keyboard navigation is used', () => {
      it('Then it should support Tab, Enter, and Escape keys', async () => {
        const user = userEvent.setup()
        renderComponent()

        const trigger = screen.getByRole('button', { name: /all accounts/i })

        trigger.focus()
        expect(trigger).toHaveFocus()

        await user.keyboard('{Enter}')
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument()
        })

        await user.keyboard('{Escape}')
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
        expect(trigger).toHaveFocus()
      })

      it('Then it should have proper ARIA attributes', async () => {
        const user = userEvent.setup()
        renderComponent()

        const trigger = screen.getByRole('button', { name: /all accounts/i })
        expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
        expect(trigger).toHaveAttribute('aria-expanded', 'false')

        await user.click(trigger)
        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'true')
        })

        const dialog = screen.getByRole('dialog')
        expect(dialog).toHaveAttribute('aria-label', 'Account filter')
      })

      it('Then focus should return to trigger when popover closes', async () => {
        const user = userEvent.setup()
        renderComponent()

        const trigger = screen.getByRole('button', { name: /all accounts/i })

        await user.click(trigger)
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument()
        })

        await user.keyboard('{Escape}')
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        expect(trigger).toHaveFocus()
      })
    })
  })
})