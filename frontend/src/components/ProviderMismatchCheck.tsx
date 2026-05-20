import { useEffect } from 'react';
import { useProviderCatalog } from '../hooks/useProviderCatalog';
import { ProviderMismatchModal } from './ProviderMismatchModal';

interface ProviderMismatchCheckProps {
  showMismatch: boolean;
  onShowMismatch: (show: boolean) => void;
  onConfirm: () => void;
}

export const ProviderMismatchCheck = ({
  showMismatch,
  onShowMismatch,
  onConfirm,
}: ProviderMismatchCheckProps) => {
  const providerCatalog = useProviderCatalog();

  useEffect(() => {
    if (providerCatalog.loading) {
      return;
    }

    if (!providerCatalog.userProvider || !providerCatalog.defaultProvider) {
      return;
    }

    if (providerCatalog.userProvider !== providerCatalog.defaultProvider) {
      onShowMismatch(true);
    }
  }, [
    providerCatalog.loading,
    providerCatalog.userProvider,
    providerCatalog.defaultProvider,
    onShowMismatch,
  ]);

  if (!showMismatch || !providerCatalog.userProvider || !providerCatalog.defaultProvider) {
    return null;
  }

  return (
    <ProviderMismatchModal
      userProvider={providerCatalog.userProvider}
      defaultProvider={providerCatalog.defaultProvider}
      onConfirm={onConfirm}
    />
  );
};
