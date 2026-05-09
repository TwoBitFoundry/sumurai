import { AlertTriangle } from 'lucide-react';
import { PasswordChecker } from '@/components/PasswordChecker';
import type { PasswordValidation } from '@/hooks/usePasswordValidation';
import { Alert, Badge, Button, FormLabel, GlassCard, Input, Modal } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { settingsConfirmationCodeTypography } from '@/views/SettingsPage';

const validationEmpty: PasswordValidation = {
  minLength: false,
  hasCapital: false,
  hasNumber: false,
  hasSpecial: false,
  isValid: false,
};

const validationStrong: PasswordValidation = {
  minLength: true,
  hasCapital: true,
  hasNumber: true,
  hasSpecial: true,
  isValid: true,
};

const validationWeak: PasswordValidation = {
  minLength: false,
  hasCapital: false,
  hasNumber: false,
  hasSpecial: false,
  isValid: false,
};

export type SettingsScreenScenario =
  | 'default'
  | 'passwordMismatch'
  | 'passwordInvalid'
  | 'passwordErrorBanner'
  | 'successBanner'
  | 'deleteModal'
  | 'deleteModalError'
  | 'deleteConfirmTyping'
  | 'deleteConfirmReady';

export function SettingsScreenSlice(props: {
  scenario: SettingsScreenScenario;
  storyKey?: string;
}) {
  const key = props.storyKey ?? props.scenario;

  const passwordSuccess =
    props.scenario === 'successBanner' ? 'Password updated successfully.' : null;

  const passwordError =
    props.scenario === 'passwordErrorBanner'
      ? 'Password does not meet requirements'
      : props.scenario === 'passwordMismatch'
        ? 'Passwords do not match'
        : null;

  const currentPassword = props.scenario === 'default' ? '' : '••••••••';

  const newPassword =
    props.scenario === 'passwordInvalid'
      ? 'weak'
      : props.scenario === 'passwordMismatch'
        ? 'StrongPass1!'
        : props.scenario === 'passwordErrorBanner'
          ? 'StrongPass1!'
          : '';

  const confirmPassword =
    props.scenario === 'passwordMismatch'
      ? 'StrongPass2!'
      : props.scenario === 'passwordErrorBanner'
        ? 'StrongPass1!'
        : newPassword;

  const newPasswordValidation =
    props.scenario === 'passwordInvalid'
      ? validationWeak
      : props.scenario === 'default'
        ? validationEmpty
        : validationStrong;

  const confirmMismatchVisible =
    props.scenario === 'passwordMismatch' && confirmPassword !== newPassword;

  const confirmVariant =
    confirmPassword && confirmPassword !== newPassword && props.scenario !== 'default'
      ? 'invalid'
      : 'default';

  const showDeleteModal =
    props.scenario === 'deleteModal' ||
    props.scenario === 'deleteModalError' ||
    props.scenario === 'deleteConfirmTyping' ||
    props.scenario === 'deleteConfirmReady';

  const confirmText =
    props.scenario === 'deleteConfirmTyping'
      ? 'DEL'
      : props.scenario === 'deleteConfirmReady'
        ? 'DELETE'
        : '';

  const deleteError =
    props.scenario === 'deleteModalError' ? 'Account deletion failed. Try again.' : null;

  const confirmInputVariant = confirmText && confirmText !== 'DELETE' ? 'invalid' : 'default';

  return (
    <div className={cn('max-w-2xl', 'mx-auto')} data-testid="settings-screen-slice">
      <div className={cn('flex', 'flex-col', 'gap-6')}>
        <GlassCard variant="default" padding="lg">
          <div className={cn('space-y-5')}>
            <div className={cn('space-y-3')}>
              <Badge size="md">ACCOUNT SETTINGS</Badge>
              <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
                Change Password
              </h2>
              <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
                Update your password to keep your account secure
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              className={cn('space-y-4')}
            >
              {passwordSuccess ? (
                <Alert variant="success" title="Success">
                  {passwordSuccess}
                </Alert>
              ) : null}

              {passwordError ? (
                <Alert variant="error" title="Error">
                  {passwordError}
                </Alert>
              ) : null}

              <div className={cn('space-y-1.5')}>
                <FormLabel htmlFor={`current-password-${key}`}>Current Password</FormLabel>
                <Input
                  id={`current-password-${key}`}
                  type="password"
                  value={currentPassword}
                  readOnly
                  autoComplete="current-password"
                  placeholder="••••••••"
                  variant="default"
                />
              </div>

              <div className={cn('grid', 'gap-4', 'md:grid-cols-2')}>
                <div className={cn('space-y-1.5')}>
                  <FormLabel htmlFor={`new-password-${key}`}>New Password</FormLabel>
                  <Input
                    id={`new-password-${key}`}
                    type="password"
                    value={newPassword}
                    readOnly
                    autoComplete="new-password"
                    variant={
                      props.scenario === 'passwordInvalid' && newPassword ? 'invalid' : 'default'
                    }
                    placeholder="Create a new password"
                  />
                </div>

                <div className={cn('space-y-1.5')}>
                  <FormLabel htmlFor={`confirm-password-${key}`}>Confirm New Password</FormLabel>
                  <Input
                    id={`confirm-password-${key}`}
                    type="password"
                    value={confirmPassword}
                    readOnly
                    autoComplete="new-password"
                    variant={confirmMismatchVisible ? 'invalid' : confirmVariant}
                    placeholder="Re-enter new password"
                  />
                  {confirmMismatchVisible ? (
                    <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.danger)}>
                      Passwords do not match.
                    </p>
                  ) : null}
                </div>
              </div>

              <PasswordChecker
                validation={props.scenario === 'default' ? validationEmpty : newPasswordValidation}
              />

              <Button type="submit" variant="primary" size="lg" className={cn('w-full')}>
                Change Password
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

          <Button type="button" variant="danger" className={cn('w-full')}>
            Delete Account
          </Button>
        </GlassCard>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {}}
        labelledBy={`delete-account-modal-title-${key}`}
        size="md"
      >
        <GlassCard variant="auth" padding="lg">
          <h2
            id={`delete-account-modal-title-${key}`}
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
            <ul className={cn('space-y-1', 'text-xs')}>
              <li>• All bank connections (Plaid/Teller)</li>
              <li>• All transactions and accounts</li>
              <li>• All budgets and settings</li>
              <li>• Your user account and login credentials</li>
            </ul>
          </Alert>

          {deleteError ? (
            <Alert variant="error" title="Delete failed" className={cn('mb-4')}>
              {deleteError}
            </Alert>
          ) : null}

          <div className={cn('mb-6', 'flex', 'flex-col', 'gap-3')}>
            <FormLabel htmlFor={`confirm-delete-${key}`}>
              Type <span className={cn(settingsConfirmationCodeTypography)}>DELETE</span> to confirm
            </FormLabel>
            <Input
              id={`confirm-delete-${key}`}
              value={confirmText}
              readOnly
              placeholder="DELETE"
              variant={confirmInputVariant}
              data-variant={confirmInputVariant}
            />
          </div>

          <div className={cn('flex', 'gap-3')}>
            <Button type="button" variant="ghost" className={cn('flex-1')}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={confirmText !== 'DELETE'}
              className={cn('flex-1')}
            >
              Delete Forever
            </Button>
          </div>
        </GlassCard>
      </Modal>
    </div>
  );
}
