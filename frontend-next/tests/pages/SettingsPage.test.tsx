import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsPage from '@/views/SettingsPage'
import { SettingsService } from '@/services/SettingsService'
import { AuthService } from '@/services/authService'

jest.mock('@/services/SettingsService', () => ({
  SettingsService: {
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
  },
}))

jest.mock('@/services/authService', () => ({
  AuthService: {
    clearToken: vi.fn(),
  },
}))

describe('SettingsPage - Account Deletion', () => {
  const mockOnLogout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Modal behavior', () => {
    it('opens modal when delete account button clicked', async () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const modalTitle = screen.getByRole('heading', { name: /delete account\?/i })
      expect(modalTitle).toBeInTheDocument()
    })

    it('closes modal when cancel button clicked', async () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      await waitFor(() => {
        const modalTitle = screen.queryByRole('heading', { name: /delete account\?/i })
        expect(modalTitle).toBeNull()
      })
    })

    it('closes modal when backdrop clicked', async () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const backdrop = screen.getByTestId('modal-backdrop')
      await userEvent.click(backdrop)

      await waitFor(() => {
        const modalTitle = screen.queryByRole('heading', { name: /delete account\?/i })
        expect(modalTitle).toBeNull()
      })
    })
  })

  describe('Confirmation text validation', () => {
    it('disables confirm button when confirmation text is empty', async () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: /delete forever/i })
      expect(confirmButton).toBeDisabled()
    })

    it('disables confirm button when confirmation text does not match "DELETE"', async () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const confirmInput = screen.getByPlaceholderText(/DELETE/i)
      await userEvent.type(confirmInput, 'DELET')

      const confirmButton = screen.getByRole('button', { name: /delete forever/i })
      expect(confirmButton).toBeDisabled()
    })

    it('enables confirm button when confirmation text matches "DELETE"', async () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const confirmInput = screen.getByPlaceholderText(/DELETE/i)
      await userEvent.type(confirmInput, 'DELETE')

      const confirmButton = screen.getByRole('button', { name: /delete forever/i })
      expect(confirmButton).not.toBeDisabled()
    })

    it('shows invalid input variant when text does not match "DELETE"', async () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const confirmInput = screen.getByPlaceholderText(/DELETE/i) as HTMLInputElement
      await userEvent.type(confirmInput, 'DELET')

      expect(confirmInput.getAttribute('data-variant')).toBe('invalid')
    })

    it('shows default input variant when text matches "DELETE"', async () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const confirmInput = screen.getByPlaceholderText(/DELETE/i) as HTMLInputElement
      await userEvent.type(confirmInput, 'DELETE')

      expect(confirmInput.getAttribute('data-variant')).toBe('default')
    })
  })

  describe('Account deletion flow', () => {
    it('calls SettingsService.deleteAccount when confirmed', async () => {
      vi.mocked(SettingsService.deleteAccount).mockResolvedValue({
        message: 'Account deleted',
        deleted_items: {
          connections: 1,
          transactions: 10,
          accounts: 2,
          budgets: 3,
        },
      })

      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const confirmInput = screen.getByPlaceholderText(/DELETE/i)
      await userEvent.type(confirmInput, 'DELETE')

      const confirmButton = screen.getByRole('button', { name: /delete forever/i })
      await userEvent.click(confirmButton)

      await waitFor(() => {
        expect(SettingsService.deleteAccount).toHaveBeenCalled()
      })
    })

    it('clears auth token after successful deletion', async () => {
      vi.mocked(SettingsService.deleteAccount).mockResolvedValue({
        message: 'Account deleted',
        deleted_items: {
          connections: 1,
          transactions: 10,
          accounts: 2,
          budgets: 3,
        },
      })

      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const confirmInput = screen.getByPlaceholderText(/DELETE/i)
      await userEvent.type(confirmInput, 'DELETE')

      const confirmButton = screen.getByRole('button', { name: /delete forever/i })
      await userEvent.click(confirmButton)

      await waitFor(() => {
        expect(AuthService.clearToken).toHaveBeenCalled()
      })
    })

    it('calls onLogout after successful deletion', async () => {
      vi.mocked(SettingsService.deleteAccount).mockResolvedValue({
        message: 'Account deleted',
        deleted_items: {
          connections: 1,
          transactions: 10,
          accounts: 2,
          budgets: 3,
        },
      })

      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const confirmInput = screen.getByPlaceholderText(/DELETE/i)
      await userEvent.type(confirmInput, 'DELETE')

      const confirmButton = screen.getByRole('button', { name: /delete forever/i })
      await userEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockOnLogout).toHaveBeenCalled()
      })
    })

    it('shows error message on deletion failure', async () => {
      vi.mocked(SettingsService.deleteAccount).mockRejectedValue(new Error('Network error'))

      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const confirmInput = screen.getByPlaceholderText(/DELETE/i)
      await userEvent.type(confirmInput, 'DELETE')

      const confirmButton = screen.getByRole('button', { name: /delete forever/i })
      await userEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('keeps modal open on deletion error', async () => {
      vi.mocked(SettingsService.deleteAccount).mockRejectedValue(new Error('Network error'))

      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const confirmInput = screen.getByPlaceholderText(/DELETE/i)
      await userEvent.type(confirmInput, 'DELETE')

      const confirmButton = screen.getByRole('button', { name: /delete forever/i })
      await userEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /delete account\?/i })).toBeInTheDocument()
      })
    })

    it('disables buttons and shows loading state during deletion', async () => {
      let resolveDeletion: () => void
      vi.mocked(SettingsService.deleteAccount).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDeletion = () =>
              resolve({
                message: 'Account deleted',
                deleted_items: {
                  connections: 1,
                  transactions: 10,
                  accounts: 2,
                  budgets: 3,
                },
              })
          })
      )

      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      const confirmInput = screen.getByPlaceholderText(/DELETE/i)
      await userEvent.type(confirmInput, 'DELETE')

      const confirmButton = screen.getByRole('button', { name: /delete forever/i })
      await userEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /deleting\.\.\./i })).toBeInTheDocument()
      })

      expect(confirmInput).toBeDisabled()
    })
  })

  describe('Modal content', () => {
    it('displays warning about permanent deletion', async () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      expect(screen.getByText(/this will permanently delete:/i)).toBeInTheDocument()
    })

    it('lists what will be deleted', async () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      await userEvent.click(deleteButton)

      expect(screen.getByText(/all bank connections/i)).toBeInTheDocument()
      expect(screen.getByText(/all transactions and accounts/i)).toBeInTheDocument()
      expect(screen.getByText(/all budgets and settings/i)).toBeInTheDocument()
      expect(screen.getByText(/your user account and login credentials/i)).toBeInTheDocument()
    })
  })

  describe('Danger Zone section', () => {
    it('displays danger zone section', () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      expect(screen.getByRole('heading', { name: /danger zone/i })).toBeInTheDocument()
    })

    it('displays warning text in danger zone', () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      expect(screen.getByText(/once you delete your account, there is no going back/i)).toBeInTheDocument()
    })

    it('displays delete account button in danger zone', () => {
      render(<SettingsPage onLogout={mockOnLogout} />)

      const deleteButton = screen.getByRole('button', { name: /delete account/i })
      expect(deleteButton).toBeInTheDocument()
    })
  })
})
