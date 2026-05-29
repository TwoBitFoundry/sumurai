import type React from 'react';
import { useMemo, useState } from 'react';
import { ToastStack } from '@/components/toastStack/ToastStack';
import { AuthService } from '@/services/authService';
import { AuthenticationError } from '@/services/boundaries';
import { PasskeyService } from '@/services/passkeyService';
import type { AuthResponse } from '@/types/api';
import { Alert, Badge, Button, cn, FormLabel, Input } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { getPasskeyCredential, type RequestChallengeResponseJSON } from '@/utils/webauthnEncoding';
import { AuthFormLayout } from './AuthFormLayout';
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
  onEnrollmentRequired?: (authResponse: AuthResponse) => void;
  uiPhase?: AuthUiPhase;
  bannerError?: string | null;
}

export function LoginScreen({
  onNavigateToRegister,
  onLoginSuccess,
  onEnrollmentRequired,
  uiPhase: uiPhaseOverride,
  bannerError: bannerErrorOverride,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginStep, setLoginStep] = useState<LoginStep>('email');
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [uiPhase, setUiPhase] = useState<AuthUiPhase>('idle');
  const { transients, pushToast, dismissTransient } = useAuthToastStack();
  const isEmailValid = useMemo(() => validateEmail(email), [email]);
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
      if (!begin.passkey_available) {
        setLoginStep('password');
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

    if (!canSubmitPassword) {
      return;
    }

    if (uiPhaseOverride !== undefined) {
      return;
    }

    setUiPhase('submitting');

    try {
      const response = await AuthService.loginWithPassword(email.trim().toLowerCase(), password);
      if (onEnrollmentRequired) {
        onEnrollmentRequired(response);
      } else {
        onLoginSuccess?.(response);
      }
    } catch (loginError) {
      if (loginError instanceof AuthenticationError) {
        setBannerError('Invalid email or password.');
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
      ? 'No passkey is enrolled for this email yet. Sign in with your password to set one up.'
      : loginStep === 'passkey'
        ? 'Approve the passkey prompt on this device.'
        : 'Enter your email to continue.';

  const primaryLabel =
    resolvedPhase === 'awaitingCeremony'
      ? 'Approve passkey on your device…'
      : resolvedPhase === 'submitting'
        ? 'Signing in…'
        : loginStep === 'password'
          ? 'Sign in with password'
          : 'Continue';

  return (
    <>
      <AuthFormLayout>
        <div className="space-y-5">
          <div className={cn('space-y-3', 'text-center')}>
            <Badge size="md">Welcome Back</Badge>
            <h2 className={cn(uiTypographyRecipes.pageTitle, uiTextRecipes.primary)}>
              Sign in to your account
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
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  disabled={isBusy}
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

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={isBusy}
                onClick={resetToEmail}
              >
                Use a different email
              </Button>
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
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  variant={email && !isEmailValid ? 'invalid' : 'default'}
                  placeholder="you@example.com"
                  disabled={isBusy}
                />
                {email && !isEmailValid ? (
                  <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.danger)}>
                    Please enter a valid email address.
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                disabled={isBusy || !isEmailValid}
                variant="primary"
                size="lg"
                className="w-full"
              >
                {primaryLabel}
              </Button>

              {loginStep === 'passkey' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={isBusy}
                  onClick={resetToEmail}
                >
                  Use a different email
                </Button>
              ) : null}
            </form>
          )}

          <div className={cn('text-center', uiTypographyRecipes.body, uiTextRecipes.body)}>
            <p className="mb-3">Don't have an account?</p>
            <Button
              type="button"
              onClick={onNavigateToRegister}
              variant="ghost"
              size="sm"
              disabled={isBusy}
            >
              Create account
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
