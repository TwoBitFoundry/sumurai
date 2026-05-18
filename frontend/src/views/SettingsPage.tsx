import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { PasswordChecker } from '@/components/PasswordChecker';
import { ThemeModeSelector } from '@/components/ThemeModeSelector';
import { useTheme } from '@/context/ThemeContext';
import { usePasswordValidation } from '@/hooks/usePasswordValidation';
import { AuthService } from '@/services/authService';
import { SettingsService } from '@/services/SettingsService';
import { Alert, Badge, Button, FormLabel, GlassCard, Input, Modal } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

export const settingsConfirmationCodeTypography = 'font-mono font-bold';

interface SettingsPageProps {
  onLogout?: () => void;
  onBack?: () => void;
}

export default function SettingsPage({ onLogout, onBack }: SettingsPageProps) {
  const { preference, setPreference } = useTheme();
  const postPasswordChangeLogoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (postPasswordChangeLogoutTimerRef.current !== null) {
        clearTimeout(postPasswordChangeLogoutTimerRef.current);
      }
    };
  }, []);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const newPasswordValidation = usePasswordValidation(newPassword);
  const isPasswordMatch = newPassword === confirmPassword;

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }

    if (!newPasswordValidation.isValid) {
      setPasswordError('Password does not meet requirements');
      return;
    }

    if (!isPasswordMatch) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await SettingsService.changePassword(currentPassword, newPassword);
      setPasswordSuccess(response.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      if (postPasswordChangeLogoutTimerRef.current !== null) {
        clearTimeout(postPasswordChangeLogoutTimerRef.current);
      }
      postPasswordChangeLogoutTimerRef.current = setTimeout(() => {
        postPasswordChangeLogoutTimerRef.current = null;
        AuthService.clearToken();
        if (onLogout) onLogout();
      }, 2000);
    } catch (error) {
      if (error instanceof Error) {
        setPasswordError(error.message);
      } else {
        setPasswordError('Failed to change password');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setConfirmText('');
    setDeleteError(null);
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await SettingsService.deleteAccount();
      AuthService.clearToken();
      if (onLogout) onLogout();
    } catch (error) {
      if (error instanceof Error) {
        setDeleteError(error.message);
      } else {
        setDeleteError('Failed to delete account');
      }
      setIsDeleting(false);
    }
  };

  const getConfirmInputVariant = () => {
    return confirmText && confirmText !== 'DELETE' ? 'invalid' : 'default';
  };

  return (
    <div className={cn('mx-auto', 'w-full', 'md:px-8', 'lg:px-8')}>
      <div className={cn('flex', 'flex-col', 'gap-6')}>
        <GlassCard variant="default" padding="lg">
          <div className={cn('space-y-5')}>
            {onBack ? (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={onBack}
                  className={cn('inline-flex', 'lg:hidden', 'w-fit')}
                >
                  <ChevronLeft className={cn('h-4', 'w-4')} />
                  <span>Back to Dashboard</span>
                </Button>
              </div>
            ) : null}

            <div className={cn('space-y-3')}>
              <Badge size="md">ACCOUNT SETTINGS</Badge>
            </div>

            <section className={cn('space-y-3')}>
              <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
                Appearance
              </h2>
              <ThemeModeSelector value={preference} onChange={setPreference} />
            </section>

            <section className={cn('space-y-3')}>
              <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
                Change Password
              </h2>
              <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
                Update your password to keep your account secure.
              </p>
            </section>

            <form onSubmit={handleChangePassword} className={cn('space-y-4')}>
              {passwordSuccess && (
                <Alert variant="success" title="Success">
                  {passwordSuccess}
                </Alert>
              )}

              {passwordError && (
                <Alert variant="error" title="Error">
                  {passwordError}
                </Alert>
              )}

              <div className={cn('space-y-1.5')}>
                <FormLabel htmlFor="current-password">Current Password</FormLabel>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={isChangingPassword}
                  variant="default"
                />
              </div>

              <div className={cn('grid', 'gap-4', 'md:grid-cols-2')}>
                <div className={cn('space-y-1.5')}>
                  <FormLabel htmlFor="new-password">New Password</FormLabel>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    autoComplete="new-password"
                    variant={newPassword && !newPasswordValidation.isValid ? 'invalid' : 'default'}
                    placeholder="Create a new password"
                    disabled={isChangingPassword}
                  />
                </div>

                <div className={cn('space-y-1.5')}>
                  <FormLabel htmlFor="confirm-password">Confirm New Password</FormLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    autoComplete="new-password"
                    variant={confirmPassword && !isPasswordMatch ? 'invalid' : 'default'}
                    placeholder="Re-enter new password"
                    disabled={isChangingPassword}
                  />
                  {confirmPassword && !isPasswordMatch && (
                    <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.danger)}>
                      Passwords do not match.
                    </p>
                  )}
                </div>
              </div>

              <PasswordChecker validation={newPasswordValidation} />

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={
                  isChangingPassword ||
                  !currentPassword ||
                  !newPasswordValidation.isValid ||
                  !isPasswordMatch
                }
                className={cn('w-full')}
              >
                {isChangingPassword ? 'Changing Password...' : 'Change Password'}
              </Button>
            </form>
          </div>
        </GlassCard>

        <GlassCard variant="default" padding="lg" className={cn('space-y-4')}>
          <Alert
            variant="error"
            title="Danger Zone"
            icon={<AlertTriangle className={cn('h-5', 'w-5')} />}
          >
            Once you delete your account, there is no going back. This action cannot be undone.
          </Alert>

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
        labelledBy="delete-account-modal-title"
        size="md"
        preventCloseOnBackdrop={isDeleting}
      >
        <GlassCard variant="auth" padding="lg">
          <h2
            id="delete-account-modal-title"
            className={cn(uiTypographyRecipes.cardTitle, 'mb-4', uiTextRecipes.primary)}
          >
            Delete Account?
          </h2>

          <Alert
            variant="error"
            title="This will permanently delete:"
            icon={<AlertTriangle className={cn('h-5', 'w-5')} />}
            className={cn('mb-6')}
          >
            <ul className={cn('space-y-1', uiTypographyRecipes.caption)}>
              <li>• All bank connections (Plaid/Teller)</li>
              <li>• All transactions and accounts</li>
              <li>• All budgets and settings</li>
              <li>• Your user account and login credentials</li>
            </ul>
          </Alert>

          {deleteError && (
            <Alert variant="error" title="Delete failed" className={cn('mb-4')}>
              {deleteError}
            </Alert>
          )}

          <div className={cn('mb-6', 'flex', 'flex-col', 'gap-3')}>
            <FormLabel htmlFor="confirm-delete">
              Type <span className={cn(settingsConfirmationCodeTypography)}>DELETE</span> to confirm
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
  );
}
