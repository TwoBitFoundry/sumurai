import { LogOut } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { ToastStack } from '@/components/toastStack/ToastStack';
import { PasskeyService } from '@/services/passkeyService';
import type { AuthResponse } from '@/types/api';
import { cn, GlassCard, Modal } from '@/ui/primitives';
import { control, text as uiTextRecipes } from '@/ui/recipes';
import {
  type CreationChallengeResponseJSON,
  createPasskeyCredential,
} from '@/utils/webauthnEncoding';
import { useAuthToastStack } from './hooks/useAuthToastStack';
import { PasskeyEnrollmentModalForm } from './PasskeyEnrollmentModalForm';
import { mapPasskeyAuthError } from './utils/mapPasskeyAuthError';

export type PendingPasskeyRecoveryEnrollment = {
  email: string;
  sessionId: string;
  challenge: CreationChallengeResponseJSON;
};

export interface EnrollPasskeyScreenProps {
  isOpen: boolean;
  pendingRecovery?: PendingPasskeyRecoveryEnrollment | null;
  onEnrollmentComplete?: (authResponse?: AuthResponse) => void;
  onLogout?: () => void;
}

export function EnrollPasskeyScreen({
  isOpen,
  pendingRecovery,
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
      const name = passkeyName.trim() || undefined;
      if (pendingRecovery) {
        const credential = await createPasskeyCredential(pendingRecovery.challenge);
        const result = await PasskeyService.finishRegistration(
          pendingRecovery.sessionId,
          credential,
          name
        );
        if (!('user_id' in result)) {
          throw new Error('Passkey recovery did not return an authenticated session');
        }
        onEnrollmentComplete?.(result);
      } else {
        await PasskeyService.enrollPasskey(name);
        onEnrollmentComplete?.();
      }
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
          <PasskeyEnrollmentModalForm
            titleId="enroll-passkey-title"
            title="Forge your passkey"
            description="Sumurai is secured by passkeys now. Forge one to continue."
            nameInputId="passkey-name"
            passkeyName={passkeyName}
            onPasskeyNameChange={setPasskeyName}
            bannerError={bannerError}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            badgeLabel="A matter of security"
            secondaryAction={
              onLogout
                ? {
                    label: 'Sign out',
                    onClick: onLogout,
                    variant: 'danger',
                    icon: <LogOut className={control.glyph.md} aria-hidden />,
                  }
                : null
            }
          />
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
