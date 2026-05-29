import type React from 'react';
import { useState } from 'react';
import { PasskeyService } from '@/services/passkeyService';
import {
  Alert,
  Badge,
  Button,
  cn,
  FormLabel,
  GlassCard,
  GradientShell,
  Input,
} from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

export interface EnrollPasskeyScreenProps {
  onEnrollmentComplete?: () => void;
}

export function EnrollPasskeyScreen({ onEnrollmentComplete }: EnrollPasskeyScreenProps) {
  const [passkeyName, setPasskeyName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await PasskeyService.enrollPasskey(passkeyName.trim() || undefined);
      onEnrollmentComplete?.();
    } catch (enrollmentError) {
      const message =
        enrollmentError instanceof Error
          ? enrollmentError.message
          : 'Unable to enroll your passkey. Please try again.';
      if (message.toLowerCase().includes('cancel')) {
        setError('Passkey setup was cancelled. You can try again when ready.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GradientShell className={uiTextRecipes.primary}>
      <div className={cn('flex', 'min-h-dvh', 'items-center', 'justify-center', 'px-4', 'py-12')}>
        <GlassCard variant="auth" padding="lg" className={cn('w-full', 'max-w-md')}>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className={cn('space-y-3', 'text-center')}>
              <Badge size="md">Security Update</Badge>
              <h1 className={cn(uiTypographyRecipes.pageTitle, uiTextRecipes.primary)}>
                Set up your passkey
              </h1>
              <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                Sumurai now uses passkeys instead of passwords. Enroll one to continue using your
                account.
              </p>
            </div>

            {error ? <Alert variant="error">{error}</Alert> : null}

            <div className="space-y-2">
              <FormLabel htmlFor="passkey-name">Passkey name</FormLabel>
              <Input
                id="passkey-name"
                value={passkeyName}
                onChange={(event) => setPasskeyName(event.target.value)}
                placeholder="MacBook Pro"
                autoComplete="off"
              />
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
              {isLoading ? 'Waiting for your device…' : 'Enroll passkey'}
            </Button>
          </form>
        </GlassCard>
      </div>
    </GradientShell>
  );
}
