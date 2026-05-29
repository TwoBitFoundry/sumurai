import { useCallback, useEffect, useState } from 'react';
import { useAuthToastStack } from '@/features/auth/hooks/useAuthToastStack';
import { mapPasskeyAuthError } from '@/features/auth/utils/mapPasskeyAuthError';
import { ConflictError } from '@/services/boundaries/errors';
import { PasskeyService, suggestPasskeyName } from '@/services/passkeyService';
import type { PasskeyItem } from '@/types/api';
import { PasskeySecuritySectionView } from './PasskeySecuritySectionView';

export function PasskeySecuritySection() {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [newPasskeyName, setNewPasskeyName] = useState(() => suggestPasskeyName());
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<PasskeyItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const { transients, pushToast, dismissTransient } = useAuthToastStack();

  const loadPasskeys = useCallback(async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  const handleAddPasskey = async () => {
    setBannerError(null);
    setIsEnrolling(true);
    try {
      const name = newPasskeyName.trim() || undefined;
      await PasskeyService.enrollPasskey(name);
      setNewPasskeyName(suggestPasskeyName());
      await loadPasskeys();
    } catch (error) {
      const presentation = mapPasskeyAuthError(error, 'enroll');
      setBannerError(presentation.bannerMessage);
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
    setIsRemoving(true);
    setBannerError(null);
    try {
      await PasskeyService.remove(removeTarget.id);
      setRemoveTarget(null);
      await loadPasskeys();
    } catch (error) {
      if (error instanceof ConflictError) {
        setBannerError('Enroll another passkey before removing this one.');
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
      newPasskeyName={newPasskeyName}
      isEnrolling={isEnrolling}
      removeTarget={removeTarget}
      isRemoving={isRemoving}
      transients={transients}
      onNewPasskeyNameChange={setNewPasskeyName}
      onAddPasskey={() => void handleAddPasskey()}
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
