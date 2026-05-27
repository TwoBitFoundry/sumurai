import { useState } from 'react';
import { Alert, Button, GlassCard, Input } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { text as semanticTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

interface SimpleFinTokenEntryProps {
  isOnline: boolean;
  isSubmitting: boolean;
  error: string | null;
  blockedReason?: string | null;
  onSubmit: (setupToken: string) => Promise<void> | void;
  showCard?: boolean;
  showHeader?: boolean;
  centered?: boolean;
  buttonLabel?: string;
  className?: string;
}

export function SimpleFinTokenEntry({
  isOnline,
  isSubmitting,
  error,
  blockedReason,
  onSubmit,
  showCard = true,
  showHeader = true,
  centered = false,
  buttonLabel = 'Connect with SimpleFIN',
  className,
}: SimpleFinTokenEntryProps) {
  const [setupToken, setSetupToken] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async () => {
    const token = setupToken.trim();
    if (!token) {
      setValidationError('Paste your SimpleFIN setup token.');
      return;
    }

    setValidationError(null);
    await onSubmit(token);
  };

  const disabled = !isOnline || isSubmitting || Boolean(blockedReason);

  const content = (
    <>
      {showHeader ? (
        <div className="space-y-2">
          <h3 className={cn(uiTypographyRecipes.cardTitle, semanticTextRecipes.primary)}>
            Connect with your SimpleFIN token
          </h3>
          <p className={cn(uiTypographyRecipes.body, semanticTextRecipes.body)}>
            Paste the one-time setup token from SimpleFIN Bridge to connect or refresh your
            institutions.
          </p>
        </div>
      ) : null}

      {blockedReason ? (
        <Alert variant="warning" className="rounded-2xl">
          <p className={cn(uiTypographyRecipes.bodyStrong)}>{blockedReason}</p>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="error" className="rounded-2xl">
          <p className={cn(uiTypographyRecipes.bodyStrong)}>{error}</p>
        </Alert>
      ) : null}

      <div className={cn('space-y-3', centered && 'text-center')}>
        <label
          htmlFor="simplefin-setup-token"
          className={cn(uiTypographyRecipes.label, semanticTextRecipes.primary)}
        >
          SimpleFIN setup token
        </label>
        <Input
          id="simplefin-setup-token"
          type="password"
          value={setupToken}
          onChange={(event) => setSetupToken(event.target.value)}
          placeholder="Paste your token"
          disabled={disabled}
          autoComplete="off"
          className={cn(centered && 'text-center placeholder:text-center')}
        />
        {(validationError ?? null) && (
          <p className={cn(uiTypographyRecipes.caption, semanticTextRecipes.warning)}>
            {validationError}
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="connect"
        size="md"
        disabled={disabled}
        onClick={submit}
        className={cn(centered && 'w-full')}
      >
        {isSubmitting ? 'Connecting…' : buttonLabel}
      </Button>
    </>
  );

  if (!showCard) {
    return <div className={cn('space-y-4', className)}>{content}</div>;
  }

  return (
    <GlassCard padding="md" className={cn('space-y-4', className)}>
      {content}
    </GlassCard>
  );
}
