import { AlertTriangle } from 'lucide-react';
import { ThemeModeSelector } from '@/components/ThemeModeSelector';
import { PasskeySecuritySection } from '@/features/settings/PasskeySecuritySection';
import { pageLayoutRecipes } from '@/layouts/PageLayout';
import {
  Alert,
  Button,
  FormLabel,
  GlassCard,
  Input,
  Modal,
  ModalDrawerHeader,
} from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import {
  settingsSecurityLayout,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
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
            <div className={cn('space-y-2')}>
              <h1 className={pageLayoutRecipes.title}>Inspect the armory</h1>
              <p className={pageLayoutRecipes.subtitle}>
                Manage your security, profile, and account preferences.
              </p>
            </div>

            <section className={cn('space-y-3')}>
              <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
                Designated as
              </h2>
              <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
                commander@sumurai.app
              </p>
            </section>

            <section className={cn('space-y-3')}>
              <div className={cn(settingsSecurityLayout.sectionIntro)}>
                <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
                  Brandish your colors
                </h2>
                <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
                  Choose the app theme.
                </p>
              </div>
              <ThemeModeSelector value="dark" onChange={() => {}} />
            </section>

            <PasskeySecuritySection />
          </div>
        </GlassCard>

        <GlassCard variant="default" padding="lg" className={cn('space-y-4')}>
          <div className={cn(settingsSecurityLayout.sectionHeader)}>
            <div className={cn(settingsSecurityLayout.sectionIntro)}>
              <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
                Retire from service
              </h2>
              <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
                Delete your Sumurai account including all financial data, app data, and links to
                financial accounts.
              </p>
            </div>
            <Button
              type="button"
              variant="danger"
              size="md"
              className={cn(settingsSecurityLayout.addTrigger)}
            >
              Delete Account
            </Button>
          </div>
          <Alert
            variant="error"
            title="Account Deletion Zone"
            icon={<AlertTriangle className={cn('h-5', 'w-5')} />}
          >
            Once you delete your account, there is no going back. This action cannot be undone.
          </Alert>
        </GlassCard>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {}}
        labelledBy={`delete-account-modal-title-${key}`}
        size="md"
      >
        <GlassCard variant="auth" padding="lg">
          <ModalDrawerHeader onClose={() => {}} closeLabel="Close delete account dialog">
            <h2
              id={`delete-account-modal-title-${key}`}
              className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}
            >
              Delete Account?
            </h2>
          </ModalDrawerHeader>

          <Alert
            variant="error"
            title="All to be severed:"
            icon={<AlertTriangle className={cn('h-5', 'w-5')} />}
            className={cn('mb-6', 'mt-4')}
          >
            <ul className={cn('space-y-1', uiTypographyRecipes.caption)}>
              <li>• All bank connections</li>
              <li>• All transactions and bank information</li>
              <li>• All budgets and settings</li>
              <li>• Your user account and login credentials</li>
            </ul>
          </Alert>

          {deleteError ? (
            <Alert variant="error" title="Deletion failed" className={cn('mb-4')}>
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

          <div className={cn('flex', 'justify-center')}>
            <Button type="button" variant="danger" size="md" disabled={confirmText !== 'DELETE'}>
              Delete forever
            </Button>
          </div>
        </GlassCard>
      </Modal>
    </div>
  );
}
