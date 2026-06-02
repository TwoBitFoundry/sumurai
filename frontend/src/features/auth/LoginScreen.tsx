import type React from 'react';
import { useMemo, useState } from 'react';
import { ToastStack } from '@/components/toastStack/ToastStack';
import { AuthService } from '@/services/authService';
import { AuthenticationError } from '@/services/boundaries';
import { PasskeyService } from '@/services/passkeyService';
import type { AuthResponse } from '@/types/api';
import { Alert, Badge, Button, cn, FormLabel, Input } from '@/ui/primitives';
import { authLayout, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import {
  type CreationChallengeResponseJSON,
  getPasskeyCredential,
  type RequestChallengeResponseJSON,
} from '@/utils/webauthnEncoding';
import { AuthFormLayout } from './AuthFormLayout';
import type { PendingPasskeyRecoveryEnrollment } from './EnrollPasskeyScreen';
import { useAuthToastStack } from './hooks/useAuthToastStack';
import { mapPasskeyAuthError } from './utils/mapPasskeyAuthError';

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type AuthUiPhase = 'idle' | 'submitting' | 'awaitingCeremony';

type LoginStep = 'email' | 'passkey' | 'password';

export interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onLoginSuccess?: (authResponse: AuthResponse) => void;
  onEnrollmentRequired?: (authResponse: AuthResponse, email: string) => void;
  onRecoveryEnrollmentStarted?: (pending: PendingPasskeyRecoveryEnrollment) => void;
  lockedEmail?: string | null;
  uiPhase?: AuthUiPhase;
  bannerError?: string | null;
}

export function LoginScreen({
  onNavigateToRegister,
  onLoginSuccess,
  onEnrollmentRequired,
  onRecoveryEnrollmentStarted,
  lockedEmail,
  uiPhase: uiPhaseOverride,
  bannerError: bannerErrorOverride,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginStep, setLoginStep] = useState<LoginStep>('email');
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [uiPhase, setUiPhase] = useState<AuthUiPhase>('idle');
  const { transients, pushToast, dismissTransient } = useAuthToastStack();
  const isEmailLocked = Boolean(lockedEmail);
  const effectiveEmail = lockedEmail ?? email;
  const isEmailValid = useMemo(() => validateEmail(effectiveEmail), [effectiveEmail]);
  const canSubmitPassword = isEmailValid && password.length > 0;

  const resolvedPhase = uiPhaseOverride ?? uiPhase;
  const resolvedBannerError = bannerErrorOverride ?? bannerError;
  const isBusy = resolvedPhase !== 'idle';

  const resetToEmail = () => {
    setLoginStep('email');
    setPassword('');
    setBannerError(null);
  };

  const handleEmailContinue = async (event: React.FormEvent) => {
    event.preventDefault();
    setBannerError(null);

    if (isEmailLocked) {
      return;
    }

    if (!isEmailValid) {
      setBannerError('Please enter a valid email address.');
      return;
    }

    if (uiPhaseOverride !== undefined) {
      return;
    }

    setUiPhase('submitting');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const begin = await PasskeyService.beginLogin(normalizedEmail);
      if (!begin.account_exists) {
        setBannerError('No account found for this email. Check the spelling or create an account.');
        return;
      }
      if (!begin.passkey_available && begin.password_available) {
        setLoginStep('password');
        return;
      }

      if (!begin.passkey_available && !begin.password_available) {
        onRecoveryEnrollmentStarted?.({
          email: normalizedEmail,
          sessionId: begin.session_id,
          challenge: begin.challenge as CreationChallengeResponseJSON,
        });
        return;
      }

      setLoginStep('passkey');
      setUiPhase('awaitingCeremony');
      const credential = await getPasskeyCredential(
        begin.challenge as RequestChallengeResponseJSON
      );
      setUiPhase('submitting');
      const response = await PasskeyService.finishLogin(begin.session_id, credential);
      onLoginSuccess?.(response);
    } catch (loginError) {
      const presentation = mapPasskeyAuthError(loginError, 'login');
      setBannerError(presentation.bannerMessage);
      if (presentation.toastMessage) {
        pushToast(presentation.toastMessage);
      }
      if (process.env.NODE_ENV !== 'test') {
        console.error('Login failed:', loginError);
      }
    } finally {
      setUiPhase('idle');
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBannerError(null);

    if (isEmailLocked) {
      return;
    }

    if (!canSubmitPassword) {
      return;
    }

    if (uiPhaseOverride !== undefined) {
      return;
    }

    setUiPhase('submitting');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await AuthService.loginWithPassword(normalizedEmail, password);
      const requiresPasskeyEnrollment = response.requires_passkey_enrollment ?? true;
      if (requiresPasskeyEnrollment && onEnrollmentRequired) {
        onEnrollmentRequired(response, normalizedEmail);
      } else {
        onLoginSuccess?.(response);
      }
    } catch (loginError) {
      if (loginError instanceof AuthenticationError) {
        setBannerError('Credentials unrecognized.');
      } else {
        const presentation = mapPasskeyAuthError(loginError, 'login');
        setBannerError(presentation.bannerMessage);
        if (presentation.toastMessage) {
          pushToast(presentation.toastMessage);
        }
      }
      if (process.env.NODE_ENV !== 'test') {
        console.error('Password login failed:', loginError);
      }
    } finally {
      setUiPhase('idle');
    }
  };

  const caption =
    loginStep === 'password'
      ? 'No passkey forged yet. Use your password to establish one.'
      : loginStep === 'passkey'
        ? 'Confirm the passkey summons on your device.'
        : 'Confirm your credentials to enter.';

  const primaryLabel =
    resolvedPhase === 'awaitingCeremony'
      ? 'Approve passkey on your device…'
      : resolvedPhase === 'submitting'
        ? 'Entering...'
        : loginStep === 'password'
          ? 'Sign in with password'
          : 'Enter';

  return (
    <>
      <AuthFormLayout>
        <div className="space-y-5">
          <div className={cn('space-y-3', 'text-center')}>
            <Badge size="md">Rejoin the Path</Badge>
            <h2 className={cn(uiTypographyRecipes.pageTitle, uiTextRecipes.primary)}>
              Sign in to Sumurai
            </h2>
            <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>{caption}</p>
          </div>

          {loginStep === 'password' ? (
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              {resolvedBannerError ? (
                <Alert variant="error" title="Sign-in error">
                  {resolvedBannerError}
                </Alert>
              ) : null}

              <div className="space-y-1.5">
                <FormLabel htmlFor="login-email">Email</FormLabel>
                <Input
                  type="email"
                  id="login-email"
                  value={effectiveEmail}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  disabled={isBusy || isEmailLocked}
                  readOnly={isEmailLocked}
                />
              </div>

              <div className="space-y-1.5">
                <FormLabel htmlFor="login-password">Password</FormLabel>
                <Input
                  type="password"
                  id="login-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={isBusy}
                />
              </div>

              <Button
                type="submit"
                disabled={isBusy || !canSubmitPassword}
                variant="primary"
                size="lg"
                className="w-full"
              >
                {primaryLabel}
              </Button>

              {!isEmailLocked ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={isBusy}
                  onClick={resetToEmail}
                >
                  Try another email.
                </Button>
              ) : null}
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleEmailContinue}>
              {resolvedBannerError ? (
                <Alert variant="error" title="Sign-in error">
                  {resolvedBannerError}
                </Alert>
              ) : null}

              <div className="space-y-1.5">
                <FormLabel htmlFor="login-email">Email</FormLabel>
                <Input
                  type="email"
                  id="login-email"
                  value={effectiveEmail}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  variant={effectiveEmail && !isEmailValid ? 'invalid' : 'default'}
                  placeholder="you@example.com"
                  disabled={isBusy || isEmailLocked}
                  readOnly={isEmailLocked}
                />
                {effectiveEmail && !isEmailValid ? (
                  <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.danger)}>
                    Please enter a valid email address.
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                disabled={isBusy || !isEmailValid || isEmailLocked}
                variant="primary"
                size="lg"
                className="w-full"
              >
                {primaryLabel}
              </Button>

              {loginStep === 'passkey' && !isEmailLocked ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={isBusy}
                  onClick={resetToEmail}
                >
                  Try another email.
                </Button>
              ) : null}
            </form>
          )}

          <div className={cn(authLayout.footerLink)}>
            <p className="mb-3">Wish to join?</p>
            <Button
              type="button"
              onClick={onNavigateToRegister}
              variant="ghost"
              size="sm"
              disabled={isBusy || isEmailLocked}
            >
              Join
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
