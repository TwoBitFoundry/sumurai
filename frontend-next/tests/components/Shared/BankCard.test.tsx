import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BankCard } from '@/components/BankCard'

const mockBank = {
  id: 'bank-1',
  name: 'Chase Bank',
  short: 'CB',
  status: 'connected' as const,
  lastSync: '2025-08-15T10:00:00Z',
  accounts: [
    {
      id: 'acc-1',
      name: 'Checking Account',
      mask: '1234',
      type: 'checking' as const,
      balance: 1500.50,
      transactions: 25
    },
    {
      id: 'acc-2',
      name: 'Savings Account', 
      mask: '5678',
      type: 'savings' as const,
      balance: 5000,
      transactions: 10
    }
  ]
}

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

describe('BankCard', () => {
  describe('when rendering bank connection', () => {
    it('displays bank name and connection status', () => {
      const mockOnSync = jest.fn()
      const mockOnDisconnect = jest.fn()

      render(<BankCard bank={mockBank} onSync={mockOnSync} onDisconnect={mockOnDisconnect} />)

      expect(screen.getByText('Chase Bank')).toBeInTheDocument()
      expect(screen.getByText('CB')).toBeInTheDocument()
      expect(screen.getByText(/Last sync.*ago/)).toBeInTheDocument()
    })

    it('shows accounts when expanded by default', () => {
      const mockOnSync = jest.fn()
      const mockOnDisconnect = jest.fn()

      render(<BankCard bank={mockBank} onSync={mockOnSync} onDisconnect={mockOnDisconnect} />)

      expect(screen.getByText('Checking Account')).toBeInTheDocument()
      expect(screen.getByText('••1234')).toBeInTheDocument()
      expect(screen.getByText('Savings Account')).toBeInTheDocument()
      expect(screen.getByText('••5678')).toBeInTheDocument()
    })

    it('can toggle account visibility', async () => {
      const user = userEvent.setup()
      const mockOnSync = jest.fn()
      const mockOnDisconnect = jest.fn()

      render(<BankCard bank={mockBank} onSync={mockOnSync} onDisconnect={mockOnDisconnect} />)

      const hideButton = screen.getByRole('button', { name: /hide/i })
      await user.click(hideButton)

      await waitFor(() => {
        expect(screen.queryByText('Checking Account')).not.toBeInTheDocument()
      })

      const showButton = screen.getByRole('button', { name: /show/i })
      await user.click(showButton)

      await waitFor(() => {
        expect(screen.getByText('Checking Account')).toBeInTheDocument()
      })
    })
  })

  describe('when syncing bank connection', () => {
    it('calls onSync with bank id when sync button clicked', async () => {
      const user = userEvent.setup()
      const mockOnSync = jest.fn().mockResolvedValue(undefined)
      const mockOnDisconnect = jest.fn()

      render(<BankCard bank={mockBank} onSync={mockOnSync} onDisconnect={mockOnDisconnect} />)

      const syncButton = screen.getByRole('button', { name: /sync now/i })
      await user.click(syncButton)

      expect(mockOnSync).toHaveBeenCalledWith('bank-1')
    })

    it('shows loading state during sync operation', async () => {
      const user = userEvent.setup()
      let resolvePrims: () => void = () => {}
      const mockOnSync = jest.fn(() => new Promise<void>(resolve => { resolvePrims = resolve }))
      const mockOnDisconnect = jest.fn()

      render(<BankCard bank={mockBank} onSync={mockOnSync} onDisconnect={mockOnDisconnect} />)

      const syncButton = screen.getByRole('button', { name: /sync now/i })
      await user.click(syncButton)

      expect(syncButton).toBeDisabled()
      expect(syncButton).toHaveClass('disabled:opacity-60', 'disabled:cursor-not-allowed')

      resolvePrims()
      await waitFor(() => {
        expect(syncButton).not.toBeDisabled()
      })
    })
  })

  describe('when disconnecting bank connection', () => {
    it('shows disconnect confirmation modal when disconnect menu item clicked', async () => {
      const user = userEvent.setup()
      const mockOnSync = jest.fn()
      const mockOnDisconnect = jest.fn()

      render(<BankCard bank={mockBank} onSync={mockOnSync} onDisconnect={mockOnDisconnect} />)

      const moreButton = screen.getByRole('button', { name: /more/i })
      await user.click(moreButton)

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i })
      await user.click(disconnectButton)

      await waitFor(() => {
        expect(screen.getByText('Disconnect Chase Bank?')).toBeInTheDocument()
      })
      expect(mockOnDisconnect).not.toHaveBeenCalled()
    })

    it('closes disconnect modal when cancel is clicked', async () => {
      const user = userEvent.setup()
      const mockOnSync = jest.fn()
      const mockOnDisconnect = jest.fn()

      render(<BankCard bank={mockBank} onSync={mockOnSync} onDisconnect={mockOnDisconnect} />)

      // Open modal
      const moreButton = screen.getByRole('button', { name: /more/i })
      await user.click(moreButton)

      const disconnectMenuButton = screen.getByRole('button', { name: /disconnect/i })
      await user.click(disconnectMenuButton)

      // Cancel in modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText('Disconnect Chase Bank?')).not.toBeInTheDocument()
      })
      expect(mockOnDisconnect).not.toHaveBeenCalled()
    })

    it('calls onDisconnect when confirmed in modal', async () => {
      const user = userEvent.setup()
      const mockOnSync = jest.fn()
      const mockOnDisconnect = jest.fn().mockResolvedValue(undefined)

      render(<BankCard bank={mockBank} onSync={mockOnSync} onDisconnect={mockOnDisconnect} />)

      // Open modal
      const moreButton = screen.getByRole('button', { name: /more/i })
      await user.click(moreButton)

      const disconnectMenuButton = screen.getByRole('button', { name: /disconnect/i })
      await user.click(disconnectMenuButton)

      // Wait for modal to render, then click its Disconnect button specifically
      await screen.findByText('Disconnect Chase Bank?')
      const buttons = await screen.findAllByRole('button', { name: /^disconnect$/i })
      const confirmButton = buttons[buttons.length - 1]
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockOnDisconnect).toHaveBeenCalledWith('bank-1')
      })
    })

    it('shows loading state during disconnect operation', async () => {
      const user = userEvent.setup()
      let resolveDisconnect: () => void = () => {}
      const mockOnSync = jest.fn()
      const mockOnDisconnect = jest.fn(() => new Promise<void>(resolve => { resolveDisconnect = resolve }))

      render(<BankCard bank={mockBank} onSync={mockOnSync} onDisconnect={mockOnDisconnect} />)

      // Open modal
      const moreButton = screen.getByRole('button', { name: /more/i })
      await user.click(moreButton)

      const disconnectMenuButton = screen.getByRole('button', { name: /disconnect/i })
      await user.click(disconnectMenuButton)

      // Wait for modal to render, then confirm
      await screen.findByText('Disconnect Chase Bank?')
      const buttons = await screen.findAllByRole('button', { name: /^disconnect$/i })
      const confirmButton = buttons[buttons.length - 1] // pick the modal's Disconnect button
      await user.click(confirmButton)

      // Wait for loading state to appear to avoid race conditions in CI
      await screen.findByRole('button', { name: /disconnecting/i })
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()

      resolveDisconnect()
      await waitFor(() => {
        expect(screen.queryByText('Disconnect Chase Bank?')).not.toBeInTheDocument()
      })
    })

    it('closes menu and shows modal when disconnect item clicked', async () => {
      const user = userEvent.setup()
      const mockOnSync = jest.fn()
      const mockOnDisconnect = jest.fn()

      render(<BankCard bank={mockBank} onSync={mockOnSync} onDisconnect={mockOnDisconnect} />)

      const moreButton = screen.getByRole('button', { name: /more/i })
      await user.click(moreButton)

      const disconnectMenuButton = screen.getByRole('button', { name: /disconnect/i })
      await user.click(disconnectMenuButton)

      // Menu should close and modal should show
      await waitFor(() => {
        expect(screen.getByText('Disconnect Chase Bank?')).toBeInTheDocument()
      })
    })
  })

  describe('when bank has different status', () => {
    it('shows needs_reauth status correctly', () => {
      const bankWithReauth = {
        ...mockBank,
        status: 'needs_reauth' as const
      }
      const mockOnSync = jest.fn()
      const mockOnDisconnect = jest.fn()

      render(<BankCard bank={bankWithReauth} onSync={mockOnSync} onDisconnect={mockOnDisconnect} />)

      expect(screen.getByText('Chase Bank')).toBeInTheDocument()
    })

    it('handles missing lastSync gracefully', () => {
      const bankWithoutSync = {
        ...mockBank,
        lastSync: undefined
      }
      const mockOnSync = jest.fn()
      const mockOnDisconnect = jest.fn()

      render(<BankCard bank={bankWithoutSync} onSync={mockOnSync} onDisconnect={mockOnDisconnect} />)

      expect(screen.getByText(/Last sync Never/)).toBeInTheDocument()
    })
  })
})
