import { Link2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/ui/primitives';
import { BankCard } from '../../../components/BankCard';
import ConnectButton from './ConnectButton';

export interface BankAccount {
  id: string;
  name: string;
  mask: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'other';
  balance?: number;
  transactions?: number;
}

export interface BankConnectionViewModel {
  id: string;
  name: string;
  short: string;
  status: 'connected' | 'needs_reauth' | 'error';
  lastSync?: string | null;
  provider: string;
  accounts: BankAccount[];
}

interface ConnectionsListProps {
  banks: BankConnectionViewModel[];
  onConnect: () => void;
  onSync: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
  isOnline: boolean;
  onImportSuccess?: (count: number, mask: string) => void;
  providerName?: string;
  connectLabel?: string;
  connectLogoSrc?: string;
  emptyState?: ReactNode;
}

const ConnectionsList = ({
  banks,
  onConnect,
  onSync,
  onDisconnect,
  isOnline,
  onImportSuccess,
  providerName,
  connectLabel,
  connectLogoSrc,
  emptyState,
}: ConnectionsListProps) => {
  const headingProviderName = providerName ?? 'accounts';
  const connectButtonLabel = connectLabel ?? 'Add account';

  if (!banks.length) {
    if (emptyState) {
      return emptyState;
    }

    return (
      <EmptyState
        icon={Link2}
        title={`No ${headingProviderName} connected yet`}
        description={`Use ${connectButtonLabel} to unlock live balances and automated transaction sync.`}
        action={
          <ConnectButton
            onClick={onConnect}
            disabled={!isOnline}
            title={!isOnline ? 'Unavailable while offline' : undefined}
            leadingImageSrc={connectLogoSrc}
          >
            {connectButtonLabel}
          </ConnectButton>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {banks.map((bank) => (
        <BankCard
          key={bank.id}
          bank={bank}
          onSync={onSync}
          onDisconnect={onDisconnect}
          isOnline={isOnline}
          onImportSuccess={onImportSuccess}
        />
      ))}
    </div>
  );
};

export default ConnectionsList;
