import type React from 'react';
import { useMemo, useState } from 'react';
import { ToastStack } from '@/components/toastStack/ToastStack';
import { PasskeyService } from '@/services/passkeyService';
import type { AuthResponse } from '@/types/api';
import { Alert, Badge, Button, cn, FormLabel, Input } from '@/ui/primitives';
import { authLayout, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import {
  type CreationChallengeResponseJSON,
  createPasskeyCredential,
} from '@/utils/webauthnEncoding';
import { AuthFormLayout } from './AuthFormLayout';
import { useAuthToastStack } from './hooks/useAuthToastStack';
import type { AuthUiPhase } from './LoginScreen';
import { mapPasskeyAuthError } from './utils/mapPasskeyAuthError';

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  onRegisterSuccess?: (authResponse: AuthResponse) => void;
  uiPhase?: AuthUiPhase;
  bannerError?: string | null;
}

export function RegisterScreen({
  onNavigateToLogin,
  onRegisterSuccess,
  uiPhase: uiPhaseOverride,
  bannerError: bannerErrorOverride,
}: RegisterScreenProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [uiPhase, setUiPhase] = useState<AuthUiPhase>('idle');
  const { transients, pushToast, dismissTransient } = useAuthToastStack();
  const isEmailValid = useMemo(() => validateEmail(email), [email]);
  const isNameValid = useMemo(() => name.trim().length > 0, [name]);

  const resolvedPhase = uiPhaseOverride ?? uiPhase;
  const resolvedBannerError = bannerErrorOverride ?? bannerError;
  const isBusy = resolvedPhase !== 'idle';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBannerError(null);

    if (!isEmailValid) {
      setBannerError('Enter a valid email.');
      return;
    }

    if (!isNameValid) {
      setBannerError('Enter your name.');
      return;
    }

    if (uiPhaseOverride !== undefined) {
      return;
    }

    setUiPhase('submitting');

    try {
      const begin = await PasskeyService.beginSignUp(email, name.trim());
      setUiPhase('awaitingCeremony');
      const credential = await createPasskeyCredential(
        begin.challenge as CreationChallengeResponseJSON
      );
      setUiPhase('submitting');
      const result = await PasskeyService.finishRegistration(
        begin.session_id,
        credential,
        name.trim()
      );
      if (!('user_id' in result)) {
        throw new Error('Passkey signup did not return an authenticated session');
      }
      onRegisterSuccess?.(result);
    } catch (registerError) {
      const presentation = mapPasskeyAuthError(registerError, 'register');
      setBannerError(presentation.bannerMessage);
      if (presentation.toastMessage) {
        pushToast(presentation.toastMessage);
      }
      console.error('Registration failed:', registerError);
    } finally {
      setUiPhase('idle');
    }
  };

  const submitLabel =
    resolvedPhase === 'awaitingCeremony'
      ? 'Confirm the passkey summons on your device.'
      : resolvedPhase === 'submitting'
        ? 'Enrolling...'
        : 'Join';

  return (
    <>
      <AuthFormLayout>
        <div className="space-y-5">
          <div className={cn('space-y-3', 'text-center')}>
            <Badge size="md">Begin the path</Badge>
            <h2 className={cn(uiTypographyRecipes.pageTitle, uiTextRecipes.primary)}>
              Sign up for Sumurai
            </h2>
            <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
              Enter your details, then seal a passkey to finish creating your account.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {resolvedBannerError ? (
              <Alert variant="error" title="Registration error">
                {resolvedBannerError}
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              <FormLabel htmlFor="register-email">Email</FormLabel>
              <Input
                type="email"
                id="register-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                variant={email && !isEmailValid ? 'invalid' : 'default'}
                placeholder="you@example.com"
                disabled={isBusy}
              />
              {email && !isEmailValid ? (
                <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.danger)}>
                  Enter a valid email.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <FormLabel htmlFor="register-name">Passkey Name</FormLabel>
              <Input
                id="register-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                variant={name && !isNameValid ? 'invalid' : 'default'}
                placeholder="Provider Name"
                disabled={isBusy}
              />
            </div>

            <Button
              type="submit"
              disabled={isBusy || !isEmailValid || !isNameValid}
              variant="primary"
              size="lg"
              className="w-full"
            >
              {submitLabel}
            </Button>
          </form>

          <div className={cn(authLayout.footerLink)}>
            <p className="mb-3">Already joined?</p>
            <Button
              type="button"
              onClick={onNavigateToLogin}
              variant="ghost"
              size="sm"
              disabled={isBusy}
            >
              Sign in
            </Button>
          </div>
        </div>
      </AuthFormLayout>
      <ToastStack
        transients={transients}
        pinnedToast={null}
        onDismissTransient={dismissTransient}
        onDismissPinned={() => {}}
      />
    </>
  );
}
