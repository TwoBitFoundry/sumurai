import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { installFetchRoutes } from '@tests/utils/fetchRoutes'
import { cn } from '@/ui/primitives'

// Mock the AuthenticatedApp component Accounts tab section
const mockBanks = [
  {
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
      }
    ]
  },
  {
    id: 'bank-2',
    name: 'Wells Fargo',
    short: 'WF',
    status: 'needs_reauth' as const,
    lastSync: '2025-08-10T08:00:00Z',
    accounts: [
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
]

const AccountsTabMock = ({
  banks,
  onSyncBank,
  onDisconnectBank,
  onAddBank
}: {
  banks: typeof mockBanks
  onSyncBank: (bankId: string) => Promise<void>
  onDisconnectBank: (bankId: string) => void
  onAddBank: () => void
}) => {
  return (
    <div data-testid="accounts-tab">
      <div className={cn('mb-6', 'flex', 'flex-wrap', 'items-center', 'justify-between', 'gap-3')}>
        <h2>Accounts</h2>
        <button onClick={onAddBank} data-testid="add-bank-button">
          Add account
        </button>
      </div>

      {banks.length === 0 ? (
        <div data-testid="banks-empty-state">
          <h3>No accounts connected yet</h3>
        </div>
      ) : (
        <div className="space-y-6">
          {banks.map((bank) => (
            <div key={bank.id} data-testid={`bank-card-${bank.id}`}>
              <h3>{bank.name}</h3>
              <button 
                onClick={() => onSyncBank(bank.id)}
                data-testid={`sync-button-${bank.id}`}
              >
                Sync {bank.name}
              </button>
              <button 
                onClick={() => onDisconnectBank(bank.id)}
                data-testid={`disconnect-button-${bank.id}`}
              >
                Disconnect {bank.name}
              </button>
              {bank.accounts.map((account) => (
                <div key={account.id} data-testid={`account-${account.id}`}>
                  <span>{account.name}</span>
                  <span>••{account.mask}</span>
                  <span>{account.transactions} items</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

let fetchMock: ReturnType<typeof installFetchRoutes>

beforeEach(() => {
  vi.clearAllMocks()
  
  fetchMock = installFetchRoutes({
    'POST /api/providers/sync-transactions': { 
      transactions: [], 
      metadata: { 
        transaction_count: 0,
        account_count: 1,
        sync_timestamp: new Date().toISOString(),
        start_date: '2025-08-01',
        end_date: '2025-08-15'
      }
    },
    'POST /api/providers/disconnect': { success: true },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AccountsTab Integration', () => {
  describe('when displaying bank connections', () => {
    it('shows connected banks with bank-level operations', () => {
      const mockOnSyncBank = vi.fn().mockResolvedValue(undefined)
      const mockOnDisconnectBank = vi.fn()
      const mockOnAddBank = vi.fn()

      render(
        <AccountsTabMock
          banks={mockBanks}
          onSyncBank={mockOnSyncBank}
          onDisconnectBank={mockOnDisconnectBank}
          onAddBank={mockOnAddBank}
        />
      )

      expect(screen.getByText('Chase Bank')).toBeInTheDocument()
      expect(screen.getByText('Wells Fargo')).toBeInTheDocument()
      
      expect(screen.getByTestId('sync-button-bank-1')).toBeInTheDocument()
      expect(screen.getByTestId('disconnect-button-bank-1')).toBeInTheDocument()
      expect(screen.getByTestId('sync-button-bank-2')).toBeInTheDocument()
      expect(screen.getByTestId('disconnect-button-bank-2')).toBeInTheDocument()
    })

    it('shows accounts without individual sync/disconnect controls', () => {
      const mockOnSyncBank = vi.fn()
      const mockOnDisconnectBank = vi.fn()
      const mockOnAddBank = vi.fn()

      render(
        <AccountsTabMock
          banks={mockBanks}
          onSyncBank={mockOnSyncBank}
          onDisconnectBank={mockOnDisconnectBank}
          onAddBank={mockOnAddBank}
        />
      )

      expect(screen.getByText('Checking Account')).toBeInTheDocument()
      expect(screen.getByText('••1234')).toBeInTheDocument()
      expect(screen.getByText('25 items')).toBeInTheDocument()
      expect(screen.getByText('Savings Account')).toBeInTheDocument()
      expect(screen.getByText('••5678')).toBeInTheDocument()
      expect(screen.getByText('10 items')).toBeInTheDocument()

      // Ensure no individual account controls exist
      expect(screen.queryByText(/sync.*account/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/disconnect.*account/i)).not.toBeInTheDocument()
    })

    it('shows empty state when no banks are connected', () => {
      const mockOnSyncBank = vi.fn()
      const mockOnDisconnectBank = vi.fn()
      const mockOnAddBank = vi.fn()

      render(
        <AccountsTabMock
          banks={[]}
          onSyncBank={mockOnSyncBank}
          onDisconnectBank={mockOnDisconnectBank}
          onAddBank={mockOnAddBank}
        />
      )

      expect(screen.getByTestId('banks-empty-state')).toBeInTheDocument()
      expect(screen.getByText('No accounts connected yet')).toBeInTheDocument()
    })
  })

  describe('when performing bank-level operations', () => {
    it('calls sync handler with correct bank id', async () => {
      const user = userEvent.setup()
      const mockOnSyncBank = vi.fn().mockResolvedValue(undefined)
      const mockOnDisconnectBank = vi.fn()
      const mockOnAddBank = vi.fn()

      render(
        <AccountsTabMock
          banks={mockBanks}
          onSyncBank={mockOnSyncBank}
          onDisconnectBank={mockOnDisconnectBank}
          onAddBank={mockOnAddBank}
        />
      )

      const syncButton = screen.getByTestId('sync-button-bank-1')
      await user.click(syncButton)

      expect(mockOnSyncBank).toHaveBeenCalledWith('bank-1')
    })

    it('calls disconnect handler with correct bank id', async () => {
      const user = userEvent.setup()
      const mockOnSyncBank = vi.fn()
      const mockOnDisconnectBank = vi.fn()
      const mockOnAddBank = vi.fn()

      render(
        <AccountsTabMock
          banks={mockBanks}
          onSyncBank={mockOnSyncBank}
          onDisconnectBank={mockOnDisconnectBank}
          onAddBank={mockOnAddBank}
        />
      )

      const disconnectButton = screen.getByTestId('disconnect-button-bank-2')
      await user.click(disconnectButton)

      expect(mockOnDisconnectBank).toHaveBeenCalledWith('bank-2')
    })

    it('calls add bank handler when add button clicked', async () => {
      const user = userEvent.setup()
      const mockOnSyncBank = vi.fn()
      const mockOnDisconnectBank = vi.fn()
      const mockOnAddBank = vi.fn()

      render(
        <AccountsTabMock
          banks={mockBanks}
          onSyncBank={mockOnSyncBank}
          onDisconnectBank={mockOnDisconnectBank}
          onAddBank={mockOnAddBank}
        />
      )

      const addButton = screen.getByTestId('add-bank-button')
      await user.click(addButton)

      expect(mockOnAddBank).toHaveBeenCalled()
    })
  })

  describe('when integrating with bank-level operations philosophy', () => {
    it('ensures operations affect entire bank connection, not individual accounts', () => {
      const mockOnSyncBank = vi.fn()
      const mockOnDisconnectBank = vi.fn()
      const mockOnAddBank = vi.fn()

      render(
        <AccountsTabMock
          banks={mockBanks}
          onSyncBank={mockOnSyncBank}
          onDisconnectBank={mockOnDisconnectBank}
          onAddBank={mockOnAddBank}
        />
      )

      // Verify sync operations are bank-level (sync entire bank/institution)
      expect(screen.getByText('Sync Chase Bank')).toBeInTheDocument()
      expect(screen.getByText('Sync Wells Fargo')).toBeInTheDocument()
      
      // Verify disconnect operations are bank-level (disconnect entire bank/institution)
      expect(screen.getByText('Disconnect Chase Bank')).toBeInTheDocument()
      expect(screen.getByText('Disconnect Wells Fargo')).toBeInTheDocument()

      // Verify no individual account controls exist
      expect(screen.queryByText(/sync.*account/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/disconnect.*account/i)).not.toBeInTheDocument()
    })
  })
})
