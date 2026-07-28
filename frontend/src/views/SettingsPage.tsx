import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { ThemeModeSelector } from '@/components/ThemeModeSelector';
import { useTheme } from '@/context/ThemeContext';
import { PasskeySecuritySection } from '@/features/settings/PasskeySecuritySection';
import { PlanSection } from '@/features/settings/PlanSection';
import { HeroSubtitleInfo } from '@/layouts/HeroSubtitleInfo';
import { pageLayoutRecipes } from '@/layouts/PageLayout';
import { AuthService } from '@/services/authService';
import { SettingsService } from '@/services/SettingsService';
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

export const settingsConfirmationCodeTypography = 'font-mono font-bold';

interface SettingsPageProps {
  onLogout?: () => void;
}

export default function SettingsPage({ onLogout }: SettingsPageProps) {
  const { preference, setPreference } = useTheme();
  const queryClient = useQueryClient();
  const userEmail = queryClient.getQueryData<string>(['user', 'email']);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    <div className={cn(...pageLayoutRecipes.settingsShell)}>
      <div className={cn('flex', 'flex-col', 'gap-6')}>
        <GlassCard variant="default" padding="lg">
          <div className={cn(...pageLayoutRecipes.titleInlineHost)}>
            <h1 className={cn(pageLayoutRecipes.titleInlineHeading)}>Inspect the armory</h1>{' '}
            <HeroSubtitleInfo
              pageTitle="Inspect the armory"
              subtitle="Manage your Sumurai account preferences, plan, and security."
            />
          </div>
        </GlassCard>

        <GlassCard variant="default" padding="lg">
          <div className={cn('space-y-5')}>
            {userEmail && (
              <section className={cn('space-y-3')}>
                <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
                  Designation
                </h2>
                <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>{userEmail}</p>
              </section>
            )}

            <section className={cn('space-y-3')}>
              <div className={cn(settingsSecurityLayout.sectionIntro)}>
                <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
                  Brandish your colors
                </h2>
                <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
                  Choose the app theme.
                </p>
              </div>
              <ThemeModeSelector value={preference} onChange={setPreference} />
            </section>
          </div>
        </GlassCard>

        <PlanSection />

        <PasskeySecuritySection />

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
              onClick={() => setShowDeleteModal(true)}
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
        onClose={closeDeleteModal}
        labelledBy="delete-account-modal-title"
        size="md"
        preventCloseOnBackdrop={isDeleting}
      >
        <GlassCard variant="auth" padding="lg">
          <ModalDrawerHeader
            onClose={closeDeleteModal}
            closeLabel="Close delete account dialog"
            closeDisabled={isDeleting}
          >
            <h2
              id="delete-account-modal-title"
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

          {deleteError && (
            <Alert variant="error" title="Deletion failed" className={cn('mb-4')}>
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

          <div className={cn('flex', 'justify-center')}>
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={handleDeleteAccount}
              disabled={confirmText !== 'DELETE' || isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete forever'}
            </Button>
          </div>
        </GlassCard>
      </Modal>
    </div>
  );
}
