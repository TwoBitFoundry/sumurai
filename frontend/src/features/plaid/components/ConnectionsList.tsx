import { Link2 } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import type { AccountCategoryType } from '@/domain/accountCategories';
import { compareInstitutionNames } from '@/domain/institutionSort';
import type { FinancialProvider } from '@/types/api';
import { EmptyState } from '@/ui/primitives';
import { BankCard } from '../../../components/BankCard';
import ConnectButton from './ConnectButton';

export interface BankAccount {
  id: string;
  name: string;
  mask: string;
  type: AccountCategoryType;
  balance?: number;
  transactions?: number;
  providerAccountId?: string | null;
}

export interface BankConnectionViewModel {
  id: string;
  name: string;
  short: string;
  status: 'connected' | 'needs_reauth' | 'error';
  lastSync?: string | null;
  provider: FinancialProvider;
  connectionId: string | null;
  accounts: BankAccount[];
}

interface ConnectionsListProps {
  banks: BankConnectionViewModel[];
  onConnect: () => void;
  onSync: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
  onAddAccount?: (bank: BankConnectionViewModel) => void;
  onExport?: (format: 'csv' | 'ofx', connectionId?: string) => Promise<void>;
  isExporting?: boolean;
  isOnline: boolean;
  onImportSuccess?: (count: number, mask: string) => void;
  providerName?: string;
  connectLabel?: string;
  emptyState?: ReactNode;
}

const ConnectionsList = ({
  banks,
  onConnect,
  onSync,
  onDisconnect,
  onAddAccount,
  onExport = async () => undefined,
  isExporting = false,
  isOnline,
  onImportSuccess,
  providerName,
  connectLabel,
  emptyState,
}: ConnectionsListProps) => {
  const headingProviderName = providerName ?? 'accounts';
  const connectButtonLabel = connectLabel ?? 'Add ally account';
  const sortedBanks = useMemo(
    () => [...banks].sort((left, right) => compareInstitutionNames(left.name, right.name)),
    [banks]
  );

  if (!sortedBanks.length) {
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
          >
            {connectButtonLabel}
          </ConnectButton>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {sortedBanks.map((bank) => (
        <BankCard
          key={bank.id}
          bank={bank}
          onSync={onSync}
          onDisconnect={onDisconnect}
          onAddAccount={onAddAccount ? () => onAddAccount(bank) : undefined}
          onExport={onExport}
          isExporting={isExporting}
          isOnline={isOnline}
          onImportSuccess={onImportSuccess}
        />
      ))}
    </div>
  );
};

export default ConnectionsList;
