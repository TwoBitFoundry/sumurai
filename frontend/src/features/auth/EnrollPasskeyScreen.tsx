import { LogOut } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { ToastStack } from '@/components/toastStack/ToastStack';
import { PasskeyService } from '@/services/passkeyService';
import { Alert, Badge, Button, cn, FormLabel, GlassCard, Input, Modal } from '@/ui/primitives';
import { control, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { useAuthToastStack } from './hooks/useAuthToastStack';
import { mapPasskeyAuthError } from './utils/mapPasskeyAuthError';

export interface EnrollPasskeyScreenProps {
  isOpen: boolean;
  onEnrollmentComplete?: () => void;
  onLogout?: () => void;
}

export function EnrollPasskeyScreen({
  isOpen,
  onEnrollmentComplete,
  onLogout,
}: EnrollPasskeyScreenProps) {
  const [passkeyName, setPasskeyName] = useState('');
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { transients, pushToast, dismissTransient } = useAuthToastStack();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBannerError(null);
    setIsLoading(true);

    try {
      await PasskeyService.enrollPasskey(passkeyName.trim() || undefined);
      onEnrollmentComplete?.();
    } catch (enrollmentError) {
      const presentation = mapPasskeyAuthError(enrollmentError, 'enroll');
      setBannerError(presentation.bannerMessage);
      if (presentation.toastMessage) {
        pushToast(presentation.toastMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        size="md"
        presentation="centered"
        preventCloseOnBackdrop
        labelledBy="enroll-passkey-title"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <GlassCard variant="auth" padding="lg" className={cn('w-full', uiTextRecipes.primary)}>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className={cn('space-y-3', 'text-center')}>
              <Badge size="md">Security Update</Badge>
              <h2
                id="enroll-passkey-title"
                className={cn(uiTypographyRecipes.pageTitle, uiTextRecipes.primary)}
              >
                Set up your passkey
              </h2>
              <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                Sumurai now uses passkeys instead of passwords. Enroll one to continue using your
                account.
              </p>
            </div>

            {bannerError ? (
              <Alert variant="error" title="Enrollment error">
                {bannerError}
              </Alert>
            ) : null}

            <div className="space-y-2">
              <FormLabel htmlFor="passkey-name">Passkey name</FormLabel>
              <Input
                id="passkey-name"
                value={passkeyName}
                onChange={(event) => setPasskeyName(event.target.value)}
                placeholder="MacBook Pro"
                autoComplete="off"
                disabled={isLoading}
              />
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:items-center">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full sm:w-auto sm:min-w-[220px]"
                disabled={isLoading}
              >
                {isLoading ? 'Waiting for your device…' : 'Enroll passkey'}
              </Button>

              {onLogout ? (
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  className="w-full sm:w-auto"
                  disabled={isLoading}
                  onClick={onLogout}
                >
                  <LogOut className={control.glyph.md} aria-hidden />
                  Sign out
                </Button>
              ) : null}
            </div>
          </form>
        </GlassCard>
      </Modal>
      <ToastStack
        transients={transients}
        pinnedToast={null}
        onDismissTransient={dismissTransient}
        onDismissPinned={() => {}}
      />
    </>
  );
}
