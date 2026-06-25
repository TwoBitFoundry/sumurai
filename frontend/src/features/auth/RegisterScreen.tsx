import type React from 'react';
import { useMemo, useState } from 'react';
import { PasswordChecker } from '@/components/PasswordChecker';
import { ToastStack } from '@/components/toastStack/ToastStack';
import { useRegistrationValidation } from '@/hooks/useRegistrationValidation';
import { AuthService } from '@/services/authService';
import { PasskeyService } from '@/services/passkeyService';
import type { AuthResponse } from '@/types/api';
import { Alert, Button, cn, FormLabel, Input } from '@/ui/primitives';
import { authLayout, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import {
  type CreationChallengeResponseJSON,
  createPasskeyCredential,
} from '@/utils/webauthnEncoding';
import { AuthFormLayout } from './AuthFormLayout';
import { useAuthToastStack } from './hooks/useAuthToastStack';
import type { AuthUiPhase } from './LoginScreen';
import { isPasswordAuthEnabled } from './passwordAuthPolicy';
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
  const passwordAuthEnabled = isPasswordAuthEnabled();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const registrationValidation = useRegistrationValidation();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [uiPhase, setUiPhase] = useState<AuthUiPhase>('idle');
  const { transients, pushToast, dismissTransient } = useAuthToastStack();
  const isEmailValid = useMemo(
    () => (passwordAuthEnabled ? registrationValidation.isEmailValid : validateEmail(email)),
    [email, passwordAuthEnabled, registrationValidation.isEmailValid]
  );
  const isNameValid = useMemo(() => name.trim().length > 0, [name]);

  const resolvedPhase = uiPhaseOverride ?? uiPhase;
  const resolvedBannerError = bannerErrorOverride ?? bannerError;
  const isBusy = resolvedPhase !== 'idle';
  const canSubmit = passwordAuthEnabled
    ? registrationValidation.isFormValid
    : isEmailValid && isNameValid;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBannerError(null);

    if (passwordAuthEnabled) {
      const validationError = registrationValidation.validateForm();
      if (validationError) {
        setBannerError(validationError);
        return;
      }
    } else {
      if (!isEmailValid) {
        setBannerError('Enter a valid email.');
        return;
      }

      if (!isNameValid) {
        setBannerError('Enter your name.');
        return;
      }
    }

    if (uiPhaseOverride !== undefined) {
      return;
    }

    setUiPhase('submitting');

    try {
      try {
        await AuthService.logout();
      } catch {}

      if (passwordAuthEnabled) {
        const result = await AuthService.registerWithPassword(
          registrationValidation.email.trim(),
          registrationValidation.password,
          name.trim() || registrationValidation.email.trim()
        );
        onRegisterSuccess?.(result);
        return;
      }

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

  const submitLabel = passwordAuthEnabled
    ? resolvedPhase === 'submitting'
      ? 'Creating account...'
      : 'Sign up'
    : resolvedPhase === 'awaitingCeremony'
      ? 'Confirm the passkey summons on your device.'
      : resolvedPhase === 'submitting'
        ? 'Enrolling...'
        : 'Sign up';

  const subtitle = passwordAuthEnabled
    ? 'Enter your email and password to create your account.'
    : 'Enter your details, then seal a passkey to finish creating your account.';

  const emailValue = passwordAuthEnabled ? registrationValidation.email : email;
  const onEmailChange = passwordAuthEnabled
    ? (event: React.ChangeEvent<HTMLInputElement>) =>
        registrationValidation.setEmail(event.target.value)
    : (event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value);

  return (
    <>
      <AuthFormLayout>
        <div className="space-y-5">
          <div className={cn('space-y-3', 'text-center')}>
            <h2 className={cn(uiTypographyRecipes.pageTitle, uiTextRecipes.primary)}>
              Become a Sumurai
            </h2>
            <p className={cn(authLayout.subtitle)}>{subtitle}</p>
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
                value={emailValue}
                onChange={onEmailChange}
                autoComplete="email"
                variant={emailValue && !isEmailValid ? 'invalid' : 'default'}
                placeholder="you@example.com"
                disabled={isBusy}
              />
              {emailValue && !isEmailValid ? (
                <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.danger)}>
                  Enter a valid email.
                </p>
              ) : null}
            </div>

            {passwordAuthEnabled ? (
              <>
                <div className="space-y-1.5">
                  <FormLabel htmlFor="register-password">Password</FormLabel>
                  <Input
                    type="password"
                    id="register-password"
                    value={registrationValidation.password}
                    onChange={(event) => registrationValidation.setPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={isBusy}
                  />
                </div>
                <div className="space-y-1.5">
                  <FormLabel htmlFor="register-confirm-password">Confirm password</FormLabel>
                  <Input
                    type="password"
                    id="register-confirm-password"
                    value={registrationValidation.confirmPassword}
                    onChange={(event) =>
                      registrationValidation.setConfirmPassword(event.target.value)
                    }
                    autoComplete="new-password"
                    variant={
                      registrationValidation.confirmPassword &&
                      !registrationValidation.isPasswordMatch
                        ? 'invalid'
                        : 'default'
                    }
                    disabled={isBusy}
                  />
                  {registrationValidation.confirmPassword &&
                  !registrationValidation.isPasswordMatch ? (
                    <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.danger)}>
                      Passwords do not match.
                    </p>
                  ) : null}
                </div>
                {registrationValidation.password ? (
                  <PasswordChecker validation={registrationValidation.passwordValidation} />
                ) : null}
              </>
            ) : (
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
            )}

            <Button
              type="submit"
              disabled={isBusy || !canSubmit}
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
              variant="secondary"
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
