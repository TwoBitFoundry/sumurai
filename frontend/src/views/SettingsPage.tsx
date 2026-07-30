import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { ThemeModeSelector } from '@/components/ThemeModeSelector';
import { useTheme } from '@/context/ThemeContext';
import { DeleteAccountModal } from '@/features/settings/DeleteAccountModal';
import { PasskeySecuritySection } from '@/features/settings/PasskeySecuritySection';
import { PlanSection } from '@/features/settings/PlanSection';
import { HeroSubtitleInfo } from '@/layouts/HeroSubtitleInfo';
import { pageLayoutRecipes } from '@/layouts/PageLayout';
import { AuthService } from '@/services/authService';
import { SettingsService } from '@/services/SettingsService';
import { Alert, Button, GlassCard } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import {
  settingsSecurityLayout,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

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

      <DeleteAccountModal
        isOpen={showDeleteModal}
        isDeleting={isDeleting}
        error={deleteError}
        confirmText={confirmText}
        onConfirmTextChange={setConfirmText}
        onConfirm={() => void handleDeleteAccount()}
        onClose={closeDeleteModal}
      />
    </div>
  );
}
