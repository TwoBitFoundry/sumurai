import { Key, Trash2 } from 'lucide-react';
import type React from 'react';
import { ToastStack, type ToastStackTransientItem } from '@/components/toastStack/ToastStack';
import { PasskeyEnrollmentModalForm } from '@/features/auth/PasskeyEnrollmentModalForm';
import type { PasskeyItem } from '@/types/api';
import { Alert, Button, cn, disabledClasses, GlassCard, IconButton, Modal } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import {
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
  isAddModalOpen: boolean;
  addModalError: string | null;
  newPasskeyName: string;
  isEnrolling: boolean;
  removeTarget: PasskeyItem | null;
  isRemoving: boolean;
  transients: ToastStackTransientItem[];
  onOpenAddModal: () => void;
  onCancelAdd: () => void;
  onNewPasskeyNameChange: (value: string) => void;
  onConfirmAdd: () => void;
  onRequestRemove: (passkey: PasskeyItem) => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
  onDismissTransient: (id: string) => void;
};

export function PasskeySecuritySectionView({
  passkeys,
  isLoading,
  bannerError,
  isAddModalOpen,
  addModalError,
  newPasskeyName,
  isEnrolling,
  removeTarget,
  isRemoving,
  transients,
  onOpenAddModal,
  onCancelAdd,
  onNewPasskeyNameChange,
  onConfirmAdd,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove,
  onDismissTransient,
}: PasskeySecuritySectionViewProps) {
  const removeAllowed = canRemovePasskey(passkeys.length);
  const isBusy = isEnrolling || isRemoving;
  const showInitialLoading = isLoading && passkeys.length === 0;
  const listKey = passkeys.map((passkey) => passkey.id).join(',');

  const handleAddSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onConfirmAdd();
  };

  return (
    <>
      <GlassCard variant="default" padding="lg" className={cn('space-y-4')}>
        <section className={cn('space-y-4')}>
          <div className={cn(settingsSecurityLayout.sectionHeader)}>
            <div className={cn(settingsSecurityLayout.sectionIntro)}>
              <h2 className={cn(uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
                Protect your dominion
              </h2>
              <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
                Manage passkeys used to sign in. You must keep at least one passkey active.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className={cn(settingsSecurityLayout.addTrigger)}
              disabled={isBusy}
              onClick={onOpenAddModal}
            >
              Add passkey
            </Button>
          </div>

          {bannerError ? (
            <Alert variant="error" title="Passkey error">
              {bannerError}
            </Alert>
          ) : null}

          {showInitialLoading ? (
            <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
              Loading passkeys…
            </p>
          ) : null}

          {!showInitialLoading && passkeys.length === 0 ? (
            <Alert
              variant="warning"
              title="No passkey enrolled"
              icon={<Key className={cn('h-5', 'w-5')} aria-hidden />}
            >
              Add a passkey to secure your account.
            </Alert>
          ) : null}

          {passkeys.length > 0 ? (
            <ul key={listKey} className={cn(settingsSecurityLayout.list)}>
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
                        title={!removeAllowed ? LAST_PASSKEY_REMOVE_TOOLTIP : undefined}
                      >
                        <IconButton
                          type="button"
                          variant="danger"
                          size="md"
                          className={cn(disabledClasses)}
                          aria-label={`Remove passkey ${passkey.name}`}
                          disabled={removeDisabled}
                          onClick={() => onRequestRemove(passkey)}
                        >
                          <Trash2 aria-hidden />
                        </IconButton>
                      </span>
                    </GlassCard>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      </GlassCard>

      <Modal
        isOpen={isAddModalOpen}
        onClose={isEnrolling ? undefined : onCancelAdd}
        labelledBy="add-passkey-title"
        size="md"
        presentation="centered"
        preventCloseOnBackdrop={isEnrolling}
        onEscapeKeyDown={isEnrolling ? (event) => event.preventDefault() : undefined}
      >
        <GlassCard variant="auth" padding="lg" className={cn('w-full', uiTextRecipes.primary)}>
          <PasskeyEnrollmentModalForm
            titleId="add-passkey-title"
            title="Add passkey"
            description="Choose a name you will recognize, then approve the prompt on this device."
            nameInputId="add-passkey-name"
            passkeyName={newPasskeyName}
            onPasskeyNameChange={onNewPasskeyNameChange}
            bannerError={addModalError}
            isLoading={isEnrolling}
            onSubmit={handleAddSubmit}
            secondaryAction={{
              label: 'Cancel',
              onClick: onCancelAdd,
              variant: 'ghost',
              className: 'normal-case',
            }}
          />
        </GlassCard>
      </Modal>

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
