import { AlertTriangle } from 'lucide-react';
import { ThemeModeSelector } from '@/components/ThemeModeSelector';
import { pageLayoutRecipes } from '@/layouts/PageLayout';
import { Alert, Badge, Button, FormLabel, GlassCard, Input, Modal } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { cn } from '@/ui/primitives/utils';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { settingsConfirmationCodeTypography } from '@/views/SettingsPage';

export type SettingsScreenScenario =
  | 'default'
  | 'deleteModal'
  | 'deleteModalError'
  | 'deleteConfirmTyping'
  | 'deleteConfirmReady';

export function SettingsScreenSlice(props: {
  scenario: SettingsScreenScenario;
  storyKey?: string;
}) {
  const key = props.storyKey ?? props.scenario;

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
    <div className={cn(...pageLayoutRecipes.settingsShell)} data-testid="settings-screen-slice">
      <div className={cn('flex', 'flex-col', 'gap-6')}>
        <GlassCard variant="default" padding="lg">
          <div className={cn('space-y-5')}>
            <div className={cn('space-y-3')}>
              <Badge size="md">ACCOUNT SETTINGS</Badge>
            </div>

            <section className={cn('space-y-3')}>
              <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
                Appearance
              </h2>
              <ThemeModeSelector value="dark" onChange={() => {}} />
            </section>
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

          <Button type="button" variant="danger" size="md">
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
            <Button
              type="button"
              variant="ghost"
              className={cn(appTitleBarRecipes.settingsIdle, 'flex-1', 'normal-case')}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
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
