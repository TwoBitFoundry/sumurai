import type React from 'react';
import { useMemo, useState } from 'react';
import type { AuthResponse } from '@/types/api';
import { PasskeyService } from './services/passkeyService';
import { Alert, Badge, Button, cn, FormLabel, GlassCard, Input } from './ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from './ui/recipes';

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onLoginSuccess?: (authResponse: AuthResponse) => void;
}

export function LoginScreen({ onNavigateToRegister, onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isEmailValid = useMemo(() => validateEmail(email), [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isEmailValid) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await PasskeyService.signIn(email);
      onLoginSuccess?.(response);
    } catch (loginError) {
      const errorMessage =
        loginError instanceof Error ? loginError.message : 'Sign-in failed. Please try again.';
      if (errorMessage.toLowerCase().includes('cancel')) {
        setError('Passkey sign-in was cancelled. You can try again when ready.');
      } else {
        setError(errorMessage);
      }
      if (process.env.NODE_ENV !== 'test') {
        console.error('Login failed:', loginError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'relative',
        'flex',
        'min-h-screen',
        'items-center',
        'justify-center',
        'px-4',
        'py-12',
        'md:px-6'
      )}
    >
      <div
        className={cn(
          'hidden',
          'lg:flex',
          'fixed',
          'right-0',
          'top-0',
          'bottom-0',
          'w-1/2',
          'items-end',
          'justify-end',
          'pointer-events-none',
          'z-0'
        )}
      >
        <img
          src="/sumurai-logo-no-background.webp"
          alt="Sumurai"
          className={cn('w-full', 'h-full', 'object-contain', 'object-right-bottom')}
        />
      </div>
      <GlassCard
        variant="auth"
        padding="lg"
        className={cn('w-full', 'max-w-md', 'relative', 'z-10')}
      >
        <div className="space-y-5">
          <div className={cn('space-y-3', 'text-center')}>
            <Badge size="md">Welcome Back</Badge>
            <h2 className={cn(uiTypographyRecipes.pageTitle, uiTextRecipes.primary)}>
              Sign in with your passkey
            </h2>
            <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
              Enter your email, then approve the passkey prompt on this device.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <Alert variant="error" title="Authentication error">
                {error}
              </Alert>
            )}

            <div className="space-y-1.5">
              <FormLabel htmlFor="email">Email</FormLabel>
              <Input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                variant={email && !isEmailValid ? 'invalid' : 'default'}
                placeholder="you@example.com"
                disabled={isLoading}
              />
              {email && !isEmailValid && (
                <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.danger)}>
                  Please enter a valid email address.
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || !isEmailValid}
              variant="primary"
              size="lg"
              className="w-full"
            >
              {isLoading ? 'Waiting for your device…' : 'Sign in with passkey'}
            </Button>
          </form>

          <div className={cn('text-center', uiTypographyRecipes.body, uiTextRecipes.body)}>
            <p className="mb-3">Don't have an account?</p>
            <Button type="button" onClick={onNavigateToRegister} variant="ghost" size="sm">
              Create account
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  onRegisterSuccess?: (authResponse: AuthResponse) => void;
}

export function RegisterScreen({ onNavigateToLogin, onRegisterSuccess }: RegisterScreenProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isEmailValid = useMemo(() => validateEmail(email), [email]);
  const isNameValid = useMemo(() => name.trim().length > 0, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isEmailValid) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!isNameValid) {
      setError('Please enter your name.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await PasskeyService.signUp(email, name.trim());
      onRegisterSuccess?.(response);
    } catch (registerError) {
      const errorMessage =
        registerError instanceof Error ? registerError.message : 'Registration failed';
      if (errorMessage.includes('409')) {
        setError('Email already exists');
      } else if (errorMessage.toLowerCase().includes('cancel')) {
        setError('Passkey setup was cancelled. You can try again when ready.');
      } else {
        setError(errorMessage);
      }
      console.error('Registration failed:', registerError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'relative',
        'flex',
        'min-h-screen',
        'items-center',
        'justify-center',
        'px-4',
        'py-12',
        'md:px-6'
      )}
    >
      <div
        className={cn(
          'hidden',
          'lg:flex',
          'fixed',
          'right-0',
          'top-0',
          'bottom-0',
          'w-1/2',
          'items-end',
          'justify-end',
          'pointer-events-none',
          'z-0'
        )}
      >
        <img
          src="/sumurai-logo-no-background.webp"
          alt="Sumurai"
          className={cn('w-full', 'h-full', 'object-contain', 'object-right-bottom')}
        />
      </div>
      <GlassCard
        variant="auth"
        padding="lg"
        className={cn('w-full', 'max-w-md', 'relative', 'z-10')}
      >
        <div className="space-y-5">
          <div className={cn('space-y-3', 'text-center')}>
            <Badge size="md">JOIN TODAY</Badge>
            <h2 className={cn(uiTypographyRecipes.pageTitle, uiTextRecipes.primary)}>
              Create your Sumurai account
            </h2>
            <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
              Enter your details, then enroll a passkey to finish sign up.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <Alert variant="error" title="Registration error">
                {error}
              </Alert>
            )}

            <div className="space-y-1.5">
              <FormLabel htmlFor="email">Email</FormLabel>
              <Input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                variant={email && !isEmailValid ? 'invalid' : 'default'}
                placeholder="you@example.com"
                disabled={isLoading}
              />
              {email && !isEmailValid && (
                <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.danger)}>
                  Please enter a valid email address.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <FormLabel htmlFor="name">Name</FormLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                variant={name && !isNameValid ? 'invalid' : 'default'}
                placeholder="Your name"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !isEmailValid || !isNameValid}
              variant="primary"
              size="lg"
              className="w-full"
            >
              {isLoading ? 'Waiting for your device…' : 'Create account with passkey'}
            </Button>
          </form>

          <div className={cn('text-center', uiTypographyRecipes.body, uiTextRecipes.body)}>
            <p className="mb-3">Already have an account?</p>
            <Button type="button" onClick={onNavigateToLogin} variant="ghost" size="sm">
              Sign in
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
