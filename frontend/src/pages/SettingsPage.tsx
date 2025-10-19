import { useState, FormEvent } from 'react'
import { GlassCard, Button, Input, FormLabel, Modal } from '@/ui/primitives'
import { cn } from '@/ui/primitives/utils'
import { SettingsService } from '@/services/SettingsService'
import { AuthService } from '@/services/authService'

interface SettingsPageProps {
  onLogout?: () => void
}

export default function SettingsPage({ onLogout }: SettingsPageProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setIsChangingPassword(true)

    try {
      const response = await SettingsService.changePassword(currentPassword, newPassword)
      setPasswordSuccess(response.message)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        AuthService.clearToken()
        if (onLogout) onLogout()
      }, 2000)
    } catch (error) {
      if (error instanceof Error) {
        setPasswordError(error.message)
      } else {
        setPasswordError('Failed to change password')
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setConfirmText('')
    setDeleteError(null)
  }

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await SettingsService.deleteAccount()
      AuthService.clearToken()
      if (onLogout) onLogout()
    } catch (error) {
      if (error instanceof Error) {
        setDeleteError(error.message)
      } else {
        setDeleteError('Failed to delete account')
      }
      setIsDeleting(false)
    }
  }

  const getConfirmInputVariant = () => {
    return confirmText && confirmText !== 'DELETE' ? 'invalid' : 'default'
  }

  return (
    <div className={cn('max-w-2xl', 'mx-auto')}>
      <div className={cn('mb-6')}>
        <h1 className={cn('text-2xl', 'font-semibold', 'text-slate-900', 'dark:text-slate-100')}>
          Settings
        </h1>
        <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-400', 'mt-1')}>
          Manage your account preferences
        </p>
      </div>

      <div className={cn('flex', 'flex-col', 'gap-6')}>
        <GlassCard variant="default" padding="lg">
          <h2 className={cn('text-lg', 'font-semibold', 'mb-4', 'text-slate-900', 'dark:text-slate-100')}>
            Change Password
          </h2>

          {passwordSuccess && (
            <div className={cn('mb-4', 'p-3', 'rounded-lg', 'bg-green-50', 'dark:bg-green-900/20')}>
              <p className={cn('text-sm', 'text-green-600', 'dark:text-green-400')}>
                {passwordSuccess}
              </p>
            </div>
          )}

          {passwordError && (
            <div className={cn('mb-4', 'p-3', 'rounded-lg', 'bg-red-50', 'dark:bg-red-900/20')}>
              <p className={cn('text-sm', 'text-red-600', 'dark:text-red-400')}>
                {passwordError}
              </p>
            </div>
          )}

          <form onSubmit={handleChangePassword} className={cn('space-y-4')}>
            <div>
              <FormLabel htmlFor="current-password">Current Password</FormLabel>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  if (passwordError) setPasswordError(null)
                }}
                required
                disabled={isChangingPassword}
                variant="default"
              />
            </div>

            <div>
              <FormLabel htmlFor="new-password">New Password</FormLabel>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  if (passwordError) setPasswordError(null)
                }}
                required
                disabled={isChangingPassword}
                variant="default"
              />
              <p className={cn('mt-1', 'text-xs', 'text-slate-500', 'dark:text-slate-400')}>
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <FormLabel htmlFor="confirm-password">Confirm New Password</FormLabel>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (passwordError) setPasswordError(null)
                }}
                required
                disabled={isChangingPassword}
                variant="default"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className={cn('w-full')}
            >
              {isChangingPassword ? 'Changing Password...' : 'Change Password'}
            </Button>
          </form>
        </GlassCard>

        <GlassCard
          variant="default"
          padding="lg"
          className={cn('border-red-200', 'dark:border-red-800')}
        >
          <h2 className={cn('text-lg', 'font-semibold', 'mb-2', 'text-red-600', 'dark:text-red-400')}>
            Danger Zone
          </h2>
          <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-400', 'mb-4')}>
            Once you delete your account, there is no going back. This action cannot be undone.
          </p>

          <Button
            type="button"
            variant="danger"
            onClick={() => setShowDeleteModal(true)}
            className={cn('w-full')}
          >
            Delete Account
          </Button>
        </GlassCard>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        size="md"
        preventCloseOnBackdrop={isDeleting}
      >
        <GlassCard variant="auth" padding="lg">
          <h2 className={cn('text-xl', 'font-semibold', 'mb-4', 'text-slate-900', 'dark:text-slate-100')}>
            Delete Account?
          </h2>

          <div className={cn('mb-6', 'p-4', 'rounded-lg', 'bg-red-50', 'dark:bg-red-900/20')}>
            <p className={cn('text-sm', 'font-medium', 'text-red-600', 'dark:text-red-400', 'mb-2')}>
              This will permanently delete:
            </p>
            <ul className={cn('space-y-1', 'text-xs', 'text-red-600', 'dark:text-red-400')}>
              <li>• All bank connections (Plaid/Teller)</li>
              <li>• All transactions and accounts</li>
              <li>• All budgets and settings</li>
              <li>• Your user account and login credentials</li>
            </ul>
          </div>

          {deleteError && (
            <div className={cn('mb-4', 'p-3', 'rounded-lg', 'bg-red-50', 'dark:bg-red-900/20')}>
              <p className={cn('text-sm', 'text-red-600', 'dark:text-red-400')}>{deleteError}</p>
            </div>
          )}

          <div className={cn('mb-6')}>
            <FormLabel htmlFor="confirm-delete">
              Type <span className={cn('font-mono', 'font-bold')}>DELETE</span> to confirm
            </FormLabel>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={isDeleting}
              variant={getConfirmInputVariant()}
              data-variant={getConfirmInputVariant()}
            />
          </div>

          <div className={cn('flex', 'gap-3')}>
            <Button
              type="button"
              variant="ghost"
              onClick={closeDeleteModal}
              disabled={isDeleting}
              className={cn('flex-1')}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteAccount}
              disabled={confirmText !== 'DELETE' || isDeleting}
              className={cn('flex-1')}
            >
              {isDeleting ? 'Deleting...' : 'Delete Forever'}
            </Button>
          </div>
        </GlassCard>
      </Modal>
    </div>
  )
}
