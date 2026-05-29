import { Trash2 } from 'lucide-react';
import type React from 'react';
import { ToastStack, type ToastStackTransientItem } from '@/components/toastStack/ToastStack';
import type { PasskeyItem } from '@/types/api';
import { Alert, Button, cn, FormLabel, GlassCard, IconButton, Input, Modal } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import {
  control,
  settingsSecurityLayout,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import {
  canRemovePasskey,
  formatPasskeyTimestamp,
  LAST_PASSKEY_REMOVE_TOOLTIP,
} from './passkeySecurityPolicy';

export type PasskeySecuritySectionViewProps = {
  passkeys: PasskeyItem[];
  isLoading: boolean;
  bannerError: string | null;
  newPasskeyName: string;
  isEnrolling: boolean;
  removeTarget: PasskeyItem | null;
  isRemoving: boolean;
  transients: ToastStackTransientItem[];
  onNewPasskeyNameChange: (value: string) => void;
  onAddPasskey: () => void;
  onRequestRemove: (passkey: PasskeyItem) => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
  onDismissTransient: (id: string) => void;
};

export function PasskeySecuritySectionView({
  passkeys,
  isLoading,
  bannerError,
  newPasskeyName,
  isEnrolling,
  removeTarget,
  isRemoving,
  transients,
  onNewPasskeyNameChange,
  onAddPasskey,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove,
  onDismissTransient,
}: PasskeySecuritySectionViewProps) {
  const removeAllowed = canRemovePasskey(passkeys.length);
  const isBusy = isLoading || isEnrolling || isRemoving;

  const handleAddSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onAddPasskey();
  };

  return (
    <>
      <section className={cn(settingsSecurityLayout.section)}>
        <div className={cn('space-y-1')}>
          <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>Security</h2>
          <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
            Manage passkeys used to sign in. You must keep at least one passkey enrolled.
          </p>
        </div>

        {bannerError ? (
          <Alert variant="error" title="Passkey error">
            {bannerError}
          </Alert>
        ) : null}

        {isLoading ? (
          <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>Loading passkeys…</p>
        ) : null}

        {!isLoading && passkeys.length === 0 ? (
          <Alert variant="warning" title="No passkey enrolled">
            Sign out and complete passkey enrollment, or contact your operator if you were locked
            out of every device.
          </Alert>
        ) : null}

        {!isLoading && passkeys.length > 0 ? (
          <ul className={cn(settingsSecurityLayout.list)}>
            {passkeys.map((passkey) => {
              const removeDisabled = !removeAllowed || isBusy;
              return (
                <li key={passkey.id}>
                  <GlassCard
                    variant="default"
                    padding="md"
                    rounded="lg"
                    className={cn(settingsSecurityLayout.passkeyRow)}
                  >
                    <div className={cn(settingsSecurityLayout.passkeyMeta)}>
                      <p className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}>
                        {passkey.name}
                      </p>
                      <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                        Added {formatPasskeyTimestamp(passkey.created_at)}
                        {' · '}
                        Last used {formatPasskeyTimestamp(passkey.last_used_at ?? null)}
                      </p>
                    </div>
                    <span
                      className={cn(settingsSecurityLayout.passkeyRemoveWrap)}
                      title={
                        removeDisabled && !removeAllowed ? LAST_PASSKEY_REMOVE_TOOLTIP : undefined
                      }
                    >
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="md"
                        aria-label={`Remove passkey ${passkey.name}`}
                        disabled={removeDisabled}
                        onClick={() => onRequestRemove(passkey)}
                      >
                        <Trash2 className={control.glyph.md} aria-hidden />
                      </IconButton>
                    </span>
                  </GlassCard>
                </li>
              );
            })}
          </ul>
        ) : null}

        <form onSubmit={handleAddSubmit} className={cn(settingsSecurityLayout.addForm)}>
          <p className={cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.primary)}>Add passkey</p>
          <div className={cn(settingsSecurityLayout.addFormBody)}>
            <div className={cn('space-y-1.5')}>
              <FormLabel htmlFor="settings-passkey-name">Passkey name</FormLabel>
              <Input
                id="settings-passkey-name"
                value={newPasskeyName}
                onChange={(event) => onNewPasskeyNameChange(event.target.value)}
                placeholder="MacBook Pro"
                autoComplete="off"
                disabled={isBusy}
              />
            </div>
            <div className={cn(settingsSecurityLayout.addActions)}>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className={cn(settingsSecurityLayout.primaryAction)}
                disabled={isBusy}
              >
                {isEnrolling ? 'Waiting for your device…' : 'Add passkey'}
              </Button>
            </div>
          </div>
        </form>
      </section>

      <Modal
        isOpen={removeTarget !== null}
        onClose={onCancelRemove}
        labelledBy="remove-passkey-title"
        size="md"
        preventCloseOnBackdrop={isRemoving}
      >
        <GlassCard variant="auth" padding="lg">
          <h2
            id="remove-passkey-title"
            className={cn(uiTypographyRecipes.cardTitle, 'mb-3', uiTextRecipes.primary)}
          >
            Remove passkey?
          </h2>
          <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body, 'mb-6')}>
            {removeTarget
              ? `“${removeTarget.name}” will no longer work for sign-in.`
              : 'This passkey will no longer work for sign-in.'}
          </p>
          <div className={cn(settingsSecurityLayout.modalActions)}>
            <Button
              type="button"
              variant="ghost"
              onClick={onCancelRemove}
              disabled={isRemoving}
              className={cn(
                appTitleBarRecipes.settingsIdle,
                settingsSecurityLayout.modalAction,
                'normal-case'
              )}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={onConfirmRemove}
              disabled={isRemoving}
              className={cn(settingsSecurityLayout.modalAction)}
            >
              {isRemoving ? 'Removing…' : 'Remove passkey'}
            </Button>
          </div>
        </GlassCard>
      </Modal>

      <ToastStack
        transients={transients}
        pinnedToast={null}
        onDismissTransient={onDismissTransient}
        onDismissPinned={() => {}}
      />
    </>
  );
}
