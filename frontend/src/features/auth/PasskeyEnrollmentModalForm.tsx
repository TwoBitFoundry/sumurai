import type React from 'react';
import { Alert, Badge, Button, cn, FormLabel, Input } from '@/ui/primitives';
import { authLayout, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

export type PasskeyEnrollmentModalSecondaryAction = {
  label: string;
  onClick: () => void;
  variant: 'danger' | 'ghost';
  icon?: React.ReactNode;
  className?: string;
};

export type PasskeyEnrollmentModalFormProps = {
  titleId: string;
  title: string;
  description: string;
  nameInputId: string;
  passkeyName: string;
  onPasskeyNameChange: (value: string) => void;
  bannerError: string | null;
  isLoading: boolean;
  onSubmit: (event: React.FormEvent) => void;
  badgeLabel?: string;
  primaryLabel?: string;
  loadingLabel?: string;
  secondaryAction?: PasskeyEnrollmentModalSecondaryAction | null;
};

export function PasskeyEnrollmentModalForm({
  titleId,
  title,
  description,
  nameInputId,
  passkeyName,
  onPasskeyNameChange,
  bannerError,
  isLoading,
  onSubmit,
  badgeLabel,
  primaryLabel = 'Enroll passkey',
  loadingLabel = 'Waiting for your device…',
  secondaryAction,
}: PasskeyEnrollmentModalFormProps) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className={cn('space-y-3', 'text-center')}>
        {badgeLabel ? <Badge size="md">{badgeLabel}</Badge> : null}
        <h2 id={titleId} className={cn(uiTypographyRecipes.pageTitle, uiTextRecipes.primary)}>
          {title}
        </h2>
        <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>{description}</p>
      </div>

      {bannerError ? (
        <Alert variant="error" title="Enrollment error">
          {bannerError}
        </Alert>
      ) : null}

      <div className="space-y-2">
        <FormLabel htmlFor={nameInputId}>Passkey name</FormLabel>
        <Input
          id={nameInputId}
          value={passkeyName}
          onChange={(event) => onPasskeyNameChange(event.target.value)}
          placeholder="Provider Name"
          autoComplete="off"
          disabled={isLoading}
        />
      </div>

      <div className={cn(authLayout.stackedActions)}>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className={cn(authLayout.primaryAction)}
          disabled={isLoading}
        >
          {isLoading ? loadingLabel : primaryLabel}
        </Button>

        {secondaryAction ? (
          <Button
            type="button"
            variant={secondaryAction.variant}
            size="md"
            className={cn(authLayout.secondaryAction, secondaryAction.className)}
            disabled={isLoading}
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.icon}
            {secondaryAction.label}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
