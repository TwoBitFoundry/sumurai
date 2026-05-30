import { useCallback, useEffect, useState } from 'react';
import { useAuthToastStack } from '@/features/auth/hooks/useAuthToastStack';
import { mapPasskeyAuthError } from '@/features/auth/utils/mapPasskeyAuthError';
import { ConflictError } from '@/services/boundaries/errors';
import { PasskeyService, suggestPasskeyName } from '@/services/passkeyService';
import type { PasskeyItem } from '@/types/api';
import { PasskeySecuritySectionView } from './PasskeySecuritySectionView';
import {
  canRemovePasskey,
  LAST_PASSKEY_REMOVE_TOOLTIP,
  passkeyIdsEqual,
} from './passkeySecurityPolicy';

export function PasskeySecuritySection() {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalError, setAddModalError] = useState<string | null>(null);
  const [newPasskeyName, setNewPasskeyName] = useState(() => suggestPasskeyName());
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<PasskeyItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const { transients, pushToast, dismissTransient } = useAuthToastStack();

  const loadPasskeys = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
      }
      setBannerError(null);
      try {
        const items = await PasskeyService.list();
        setPasskeys(items);
      } catch (error) {
        const presentation = mapPasskeyAuthError(error, 'enroll');
        setBannerError(presentation.bannerMessage ?? 'Failed to load passkeys');
        if (presentation.toastMessage) {
          pushToast(presentation.toastMessage);
        }
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [pushToast]
  );

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  const handleOpenAddModal = () => {
    setAddModalError(null);
    setNewPasskeyName(suggestPasskeyName());
    setIsAddModalOpen(true);
  };

  const handleCancelAdd = () => {
    if (!isEnrolling) {
      setIsAddModalOpen(false);
      setAddModalError(null);
    }
  };

  const handleConfirmAdd = async () => {
    setAddModalError(null);
    setIsEnrolling(true);
    try {
      const name = newPasskeyName.trim() || undefined;
      await PasskeyService.enrollPasskey(name);
      setIsAddModalOpen(false);
      setNewPasskeyName(suggestPasskeyName());
      await loadPasskeys({ silent: true });
    } catch (error) {
      const presentation = mapPasskeyAuthError(error, 'enroll');
      setAddModalError(presentation.bannerMessage);
      if (presentation.toastMessage) {
        pushToast(presentation.toastMessage);
      }
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) {
      return;
    }
    if (!canRemovePasskey(passkeys.length)) {
      setBannerError(LAST_PASSKEY_REMOVE_TOOLTIP);
      setRemoveTarget(null);
      return;
    }
    const removedId = removeTarget.id;
    setIsRemoving(true);
    setBannerError(null);
    try {
      await PasskeyService.remove(removedId);
      setRemoveTarget(null);
      setPasskeys((current) =>
        current.filter((passkey) => !passkeyIdsEqual(passkey.id, removedId))
      );
      await loadPasskeys({ silent: true });
    } catch (error) {
      if (error instanceof ConflictError) {
        await loadPasskeys({ silent: true });
        setBannerError(LAST_PASSKEY_REMOVE_TOOLTIP);
        setRemoveTarget(null);
        return;
      }
      const presentation = mapPasskeyAuthError(error, 'enroll');
      setBannerError(presentation.bannerMessage);
      if (presentation.toastMessage) {
        pushToast(presentation.toastMessage);
      }
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <PasskeySecuritySectionView
      passkeys={passkeys}
      isLoading={isLoading}
      bannerError={bannerError}
      isAddModalOpen={isAddModalOpen}
      addModalError={addModalError}
      newPasskeyName={newPasskeyName}
      isEnrolling={isEnrolling}
      removeTarget={removeTarget}
      isRemoving={isRemoving}
      transients={transients}
      onOpenAddModal={handleOpenAddModal}
      onCancelAdd={handleCancelAdd}
      onNewPasskeyNameChange={setNewPasskeyName}
      onConfirmAdd={() => void handleConfirmAdd()}
      onRequestRemove={setRemoveTarget}
      onConfirmRemove={() => void handleConfirmRemove()}
      onCancelRemove={() => {
        if (!isRemoving) {
          setRemoveTarget(null);
        }
      }}
      onDismissTransient={dismissTransient}
    />
  );
}
