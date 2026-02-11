import { AlertTriangle, Loader2 } from 'lucide-react';
import type React from 'react';
import { cn } from '@/ui/primitives';
import { Alert, Button, GlassCard, Modal } from '../ui/primitives';

interface Account {
  id: string;
  name: string;
  mask: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'other';
  balance?: number;
  transactions?: number;
}

interface BankConnection {
  id: string;
  name: string;
  short: string;
  status: 'connected' | 'needs_reauth' | 'error';
  lastSync?: string;
  accounts: Account[];
}

interface DisconnectModalProps {
  isOpen: boolean;
  bank: BankConnection;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const DisconnectModal: React.FC<DisconnectModalProps> = ({
  isOpen,
  bank,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const accountCount = bank.accounts.length;
  const accountText = accountCount === 1 ? '1 account' : `${accountCount} accounts`;

  return (
    <Modal isOpen={isOpen} onClose={onCancel} labelledBy="disconnect-modal-title" size="md">
      <GlassCard
        variant="accent"
        rounded="xl"
        padding="lg"
        withInnerEffects={false}
        className="space-y-6"
      >
        <Alert
          id="disconnect-modal-title"
          variant="warning"
          title={`Disconnect ${bank.name}?`}
          icon={<AlertTriangle className={cn('h-5', 'w-5')} />}
          className="text-left"
        >
          <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>
            This will remove {accountText} and related transactions from your dashboard. This action
            cannot be undone.
          </p>
        </Alert>

        <div className={cn('flex', 'justify-end', 'gap-3')}>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 className={cn('h-4', 'w-4', 'animate-spin')} />}
            {loading ? 'Disconnecting' : 'Disconnect'}
          </Button>
        </div>
      </GlassCard>
    </Modal>
  );
};
