import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsPage from '@/pages/SettingsPage'
import { SettingsService } from '@/services/SettingsService'

vi.mock('@/services/SettingsService', () => ({
  SettingsService: {
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
  }
}))

describe('SettingsPage - Password Change (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Given/When/Then - Layout and initial render', () => {
    it('Given SettingsPage renders; When page loads; Then shows title and description', () => {
      render(<SettingsPage />)

      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByText('Manage your account preferences')).toBeInTheDocument()
    })

    it('Given SettingsPage renders; When page loads; Then shows password change section', () => {
      const { container } = render(<SettingsPage />)

      expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument()

      const form = container.querySelector('form')
      expect(form).toBeInTheDocument()

      const inputs = form!.querySelectorAll('input[type="password"]')
      expect(inputs.length).toBe(3)
    })

    it('Given SettingsPage renders; When page loads; Then displays form inputs with correct attributes', () => {
      render(<SettingsPage />)

      const passwordInputs = screen.getAllByDisplayValue('')
      const passwordFields = passwordInputs.filter(el => (el as HTMLInputElement).type === 'password')

      expect(passwordFields.length).toBeGreaterThanOrEqual(3)
      passwordFields.slice(0, 3).forEach(field => {
        expect((field as HTMLInputElement).type).toBe('password')
      })
    })

    it('Given SettingsPage renders; When page loads; Then shows password requirements hint', () => {
      render(<SettingsPage />)

      expect(screen.getByText(/Must be at least 8 characters/i)).toBeInTheDocument()
    })

    it('Given SettingsPage renders; When page loads; Then submit button is initially disabled', () => {
      render(<SettingsPage />)

      const submitButton = screen.getByRole('button', { name: /Change Password/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Given/When/Then - Form validation', () => {
    it('Given empty form; When user tries to submit; Then submit button remains disabled', () => {
      render(<SettingsPage />)

      const submitButton = screen.getByRole('button', { name: /Change Password/i })
      expect(submitButton).toBeDisabled()
    })

    it('Given new password < 8 characters; When user submits form; Then shows validation error', async () => {
      const user = userEvent.setup()
      const { container } = render(<SettingsPage />)

      const form = container.querySelector('form')
      if (!form) throw new Error('Form not found')

      const inputs = form.querySelectorAll('input[type="password"]')
      const currentPasswordInput = inputs[0]
      const newPasswordInput = inputs[1]
      const confirmPasswordInput = inputs[2]
      const submitButton = screen.getByRole('button', { name: /Change Password/i })

      await user.type(currentPasswordInput as HTMLInputElement, 'oldpass123')
      await user.type(newPasswordInput as HTMLInputElement, 'short')
      await user.type(confirmPasswordInput as HTMLInputElement, 'short')
      await user.click(submitButton)

      expect(screen.getByText(/Password must be at least 8 characters/)).toBeInTheDocument()
      expect(vi.mocked(SettingsService.changePassword)).not.toHaveBeenCalled()
    })

    it('Given mismatched passwords; When user submits form; Then shows mismatch error', async () => {
      const user = userEvent.setup()
      const { container } = render(<SettingsPage />)

      const form = container.querySelector('form')
      if (!form) throw new Error('Form not found')

      const inputs = form.querySelectorAll('input[type="password"]')
      const currentPasswordInput = inputs[0]
      const newPasswordInput = inputs[1]
      const confirmPasswordInput = inputs[2]
      const submitButton = screen.getByRole('button', { name: /Change Password/i })

      await user.type(currentPasswordInput as HTMLInputElement, 'oldpass123')
      await user.type(newPasswordInput as HTMLInputElement, 'newpass12345')
      await user.type(confirmPasswordInput as HTMLInputElement, 'newpass99999')
      await user.click(submitButton)

      expect(screen.getByText(/Passwords do not match/)).toBeInTheDocument()
      expect(vi.mocked(SettingsService.changePassword)).not.toHaveBeenCalled()
    })

    it('Given valid form inputs; When all fields filled; Then submit button is enabled', async () => {
      const user = userEvent.setup()
      const { container } = render(<SettingsPage />)

      const form = container.querySelector('form')
      if (!form) throw new Error('Form not found')

      const inputs = form.querySelectorAll('input[type="password"]')
      const currentPasswordInput = inputs[0]
      const newPasswordInput = inputs[1]
      const confirmPasswordInput = inputs[2]
      const submitButton = screen.getByRole('button', { name: /Change Password/i })

      await user.type(currentPasswordInput as HTMLInputElement, 'oldpass123')
      await user.type(newPasswordInput as HTMLInputElement, 'newpass12345')
      await user.type(confirmPasswordInput as HTMLInputElement, 'newpass12345')

      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('Given/When/Then - Form submission', () => {
    it('Given valid form; When user submits; Then calls SettingsService.changePassword with correct payload', async () => {
      const user = userEvent.setup()
      vi.mocked(SettingsService.changePassword).mockResolvedValueOnce({
        message: 'Password changed successfully. Please log in again.',
        requires_reauth: true,
      } as any)

      const { container } = render(<SettingsPage />)

      const form = container.querySelector('form')
      if (!form) throw new Error('Form not found')

      const inputs = form.querySelectorAll('input[type="password"]')
      const currentPasswordInput = inputs[0]
      const newPasswordInput = inputs[1]
      const confirmPasswordInput = inputs[2]
      const submitButton = screen.getByRole('button', { name: /Change Password/i })

      await user.type(currentPasswordInput as HTMLInputElement, 'oldpass123')
      await user.type(newPasswordInput as HTMLInputElement, 'newpass12345')
      await user.type(confirmPasswordInput as HTMLInputElement, 'newpass12345')
      await user.click(submitButton)

      await waitFor(() => {
        expect(vi.mocked(SettingsService.changePassword)).toHaveBeenCalledWith('oldpass123', 'newpass12345')
      })
    })

    it('Given successful response; When password change completes; Then shows success message', async () => {
      const user = userEvent.setup()
      vi.mocked(SettingsService.changePassword).mockResolvedValueOnce({
        message: 'Password changed successfully. Please log in again.',
        requires_reauth: true,
      } as any)

      const { container } = render(<SettingsPage />)

      const form = container.querySelector('form')
      if (!form) throw new Error('Form not found')

      const inputs = form.querySelectorAll('input[type="password"]')
      const currentPasswordInput = inputs[0]
      const newPasswordInput = inputs[1]
      const confirmPasswordInput = inputs[2]
      const submitButton = screen.getByRole('button', { name: /Change Password/i })

      await user.type(currentPasswordInput as HTMLInputElement, 'oldpass123')
      await user.type(newPasswordInput as HTMLInputElement, 'newpass12345')
      await user.type(confirmPasswordInput as HTMLInputElement, 'newpass12345')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Password changed successfully/)).toBeInTheDocument()
      })
    })

    it('Given service error; When password change fails; Then shows error message', async () => {
      const user = userEvent.setup()
      const errorMessage = 'Current password is incorrect'
      vi.mocked(SettingsService.changePassword).mockRejectedValueOnce(new Error(errorMessage))

      const { container } = render(<SettingsPage />)

      const form = container.querySelector('form')
      if (!form) throw new Error('Form not found')

      const inputs = form.querySelectorAll('input[type="password"]')
      const currentPasswordInput = inputs[0]
      const newPasswordInput = inputs[1]
      const confirmPasswordInput = inputs[2]
      const submitButton = screen.getByRole('button', { name: /Change Password/i })

      await user.type(currentPasswordInput as HTMLInputElement, 'wrongpass')
      await user.type(newPasswordInput as HTMLInputElement, 'newpass12345')
      await user.type(confirmPasswordInput as HTMLInputElement, 'newpass12345')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('Given loading state; When form is submitting; Then submit button shows loading text and is disabled', async () => {
      const user = userEvent.setup()
      vi.mocked(SettingsService.changePassword).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ message: 'ok', requires_reauth: true } as any), 500))
      )

      const { container } = render(<SettingsPage />)

      const form = container.querySelector('form')
      if (!form) throw new Error('Form not found')

      const inputs = form.querySelectorAll('input[type="password"]')
      const currentPasswordInput = inputs[0]
      const newPasswordInput = inputs[1]
      const confirmPasswordInput = inputs[2]
      const submitButton = screen.getByRole('button', { name: /Change Password/i })

      await user.type(currentPasswordInput as HTMLInputElement, 'oldpass123')
      await user.type(newPasswordInput as HTMLInputElement, 'newpass12345')
      await user.type(confirmPasswordInput as HTMLInputElement, 'newpass12345')

      await act(async () => {
        await user.click(submitButton)
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      expect(screen.getByRole('button', { name: /Changing Password/i })).toBeDisabled()
    })

    it('Given form submission; When user modifies form during submission; Then input fields are disabled', async () => {
      const user = userEvent.setup()
      vi.mocked(SettingsService.changePassword).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ message: 'ok', requires_reauth: true } as any), 300))
      )

      const { container } = render(<SettingsPage />)

      const form = container.querySelector('form')
      if (!form) throw new Error('Form not found')

      const inputs = form.querySelectorAll('input[type="password"]')
      const currentPasswordInput = inputs[0]
      const newPasswordInput = inputs[1]
      const confirmPasswordInput = inputs[2]
      const submitButton = screen.getByRole('button', { name: /Change Password/i })

      await user.type(currentPasswordInput as HTMLInputElement, 'oldpass123')
      await user.type(newPasswordInput as HTMLInputElement, 'newpass12345')
      await user.type(confirmPasswordInput as HTMLInputElement, 'newpass12345')

      await act(async () => {
        await user.click(submitButton)
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      expect(currentPasswordInput).toBeDisabled()
      expect(newPasswordInput).toBeDisabled()
      expect(confirmPasswordInput).toBeDisabled()
    })
  })

  describe('Given/When/Then - Form reset', () => {
    it('Given successful password change; When success message displays; Then form fields are cleared', async () => {
      const user = userEvent.setup()
      vi.mocked(SettingsService.changePassword).mockResolvedValueOnce({
        message: 'Password changed successfully. Please log in again.',
        requires_reauth: true,
      } as any)

      const { container } = render(<SettingsPage />)

      const form = container.querySelector('form')
      if (!form) throw new Error('Form not found')

      const inputs = form.querySelectorAll('input[type="password"]')
      const currentPasswordInput = inputs[0] as HTMLInputElement
      const newPasswordInput = inputs[1] as HTMLInputElement
      const confirmPasswordInput = inputs[2] as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /Change Password/i })

      await user.type(currentPasswordInput, 'oldpass123')
      await user.type(newPasswordInput, 'newpass12345')
      await user.type(confirmPasswordInput, 'newpass12345')
      await user.click(submitButton)

      await waitFor(() => {
        expect(currentPasswordInput.value).toBe('')
        expect(newPasswordInput.value).toBe('')
        expect(confirmPasswordInput.value).toBe('')
      })
    })

    it('Given error message shown; When user retypes form; Then error message clears', async () => {
      const user = userEvent.setup()
      vi.mocked(SettingsService.changePassword).mockRejectedValueOnce(new Error('Invalid password'))

      const { container } = render(<SettingsPage />)

      const form = container.querySelector('form')
      if (!form) throw new Error('Form not found')

      const inputs = form.querySelectorAll('input[type="password"]')
      const currentPasswordInput = inputs[0]
      const newPasswordInput = inputs[1]
      const confirmPasswordInput = inputs[2]
      const submitButton = screen.getByRole('button', { name: /Change Password/i })

      await user.type(currentPasswordInput as HTMLInputElement, 'wrong')
      await user.type(newPasswordInput as HTMLInputElement, 'newpass12345')
      await user.type(confirmPasswordInput as HTMLInputElement, 'newpass12345')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Invalid password/)).toBeInTheDocument()
      })

      await user.clear(currentPasswordInput as HTMLInputElement)
      await user.type(currentPasswordInput as HTMLInputElement, 'correct')

      expect(screen.queryByText(/Invalid password/)).not.toBeInTheDocument()
    })
  })

  describe('Given/When/Then - Logout trigger', () => {
    it('Given successful password change; When onLogout callback provided; Then onLogout is called', async () => {
      const user = userEvent.setup({ delay: null })
      const mockOnLogout = vi.fn()

      vi.mocked(SettingsService.changePassword).mockResolvedValueOnce({
        message: 'Password changed successfully. Please log in again.',
        requires_reauth: true,
      } as any)

      const { container } = render(<SettingsPage onLogout={mockOnLogout} />)

      const form = container.querySelector('form')
      if (!form) throw new Error('Form not found')

      const inputs = form.querySelectorAll('input[type="password"]')
      const currentPasswordInput = inputs[0]
      const newPasswordInput = inputs[1]
      const confirmPasswordInput = inputs[2]
      const submitButton = screen.getByRole('button', { name: /Change Password/i })

      await user.type(currentPasswordInput as HTMLInputElement, 'oldpass123')
      await user.type(newPasswordInput as HTMLInputElement, 'newpass12345')
      await user.type(confirmPasswordInput as HTMLInputElement, 'newpass12345')
      await user.click(submitButton)

      await waitFor(() => {
        expect(vi.mocked(SettingsService.changePassword)).toHaveBeenCalled()
      }, { timeout: 3000 })

      await waitFor(() => {
        expect(mockOnLogout).toHaveBeenCalled()
      }, { timeout: 3000 })
    }, 10000)

    it('Given no onLogout callback; When password change succeeds; Then no error occurs', async () => {
      const user = userEvent.setup({ delay: null })

      vi.mocked(SettingsService.changePassword).mockResolvedValueOnce({
        message: 'Password changed successfully. Please log in again.',
        requires_reauth: true,
      } as any)

      const { container } = render(<SettingsPage />)

      const form = container.querySelector('form')
      if (!form) throw new Error('Form not found')

      const inputs = form.querySelectorAll('input[type="password"]')
      const currentPasswordInput = inputs[0]
      const newPasswordInput = inputs[1]
      const confirmPasswordInput = inputs[2]
      const submitButton = screen.getByRole('button', { name: /Change Password/i })

      await user.type(currentPasswordInput as HTMLInputElement, 'oldpass123')
      await user.type(newPasswordInput as HTMLInputElement, 'newpass12345')
      await user.type(confirmPasswordInput as HTMLInputElement, 'newpass12345')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Password changed successfully/)).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(true).toBe(true)
    }, 10000)
  })

  describe('Accessibility and styling', () => {
    it('Given SettingsPage renders; When page loads; Then form is properly labeled', () => {
      render(<SettingsPage />)

      const form = screen.getByLabelText(/Current Password/i).closest('form')
      expect(form).toBeInTheDocument()
    })

    it('Given SettingsPage renders; When page loads; Then page layout uses max-w-2xl constraint', () => {
      const { container } = render(<SettingsPage />)

      const pageContainer = container.firstChild
      expect(pageContainer).toHaveClass('max-w-2xl')
    })
  })
})
