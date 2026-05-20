import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, RefreshCw, Unlink } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import {
  ACCOUNT_GROUP_LABELS,
  type AccountGroupKey,
  accountTypeSortOrder,
} from '../domain/accountCategories';
import { getConnectionStatusCaption } from '../domain/connectionStatus';
import { Button, cn, GlassCard } from '../ui/primitives';
import { appTitleBarRecipes } from '../ui/primitives/AppTitleBar';
import {
  border as uiBorderRecipes,
  status as uiStatusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '../ui/recipes';
import { AccountGroupIcon } from './AccountGroupIcon';
import { AccountRow } from './AccountRow';
import { DisconnectModal } from './DisconnectModal';
import { StatusPill } from './StatusPill';

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

interface BankCardProps {
  bank: BankConnection;
  onSync: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
  isOnline: boolean;
  onImportSuccess?: (count: number, mask: string) => void;
}

export const BankCard: React.FC<BankCardProps> = ({
  bank,
  onSync,
  onDisconnect,
  isOnline,
  onImportSuccess,
}) => {
  const sectionBadgeClass = cn(uiTypographyRecipes.label, uiTextRecipes.muted);
  const statusCaption = getConnectionStatusCaption(bank.status);

  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    await onSync(bank.id);
    setLoading(false);
  };

  const handleDisconnectClick = () => {
    setShowDisconnectModal(true);
  };

  const handleDisconnectCancel = () => {
    setShowDisconnectModal(false);
  };

  const handleDisconnectConfirm = async () => {
    setDisconnectLoading(true);
    await onDisconnect(bank.id);
    setDisconnectLoading(false);
    setShowDisconnectModal(false);
  };

  const renderGroup = (group: AccountGroupKey, accounts: Account[]) => (
    <div key={group} className={cn('space-y-3')}>
      <span className={cn(sectionBadgeClass, 'inline-flex items-center gap-2')}>
        <AccountGroupIcon group={group} />
        {ACCOUNT_GROUP_LABELS[group]}
      </span>
      <div className={cn('grid', 'grid-cols-1', 'gap-3', 'md:grid-cols-2')}>
        {accounts.map((account) => (
          <AccountRow
            account={account}
            key={account.id}
            isOnline={isOnline}
            onImportSuccess={onImportSuccess}
          />
        ))}
      </div>
    </div>
  );

  return (
    <GlassCard
      variant="accent"
      rounded="lg"
      padding="none"
      withInnerEffects={false}
      containerClassName={cn('p-4', 'md:p-8', 'lg:p-8')}
      className={cn('space-y-6')}
    >
      <div
        className={cn(
          'grid',
          'min-w-0',
          'grid-cols-[auto_minmax(0,1fr)_auto]',
          'grid-rows-[auto_auto]',
          'items-start',
          'gap-x-3',
          'gap-y-2'
        )}
      >
        <Button
          type="button"
          onClick={handleSync}
          disabled={loading || !isOnline}
          variant="ghost"
          size="icon"
          aria-label="Sync now"
          title={!isOnline ? 'Unavailable while offline' : undefined}
          className={cn(appTitleBarRecipes.settingsIdle, 'col-start-1', 'row-start-1', 'shrink-0')}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
        <Button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          variant="ghost"
          size="icon"
          aria-label={expanded ? 'Hide accounts' : 'Show accounts'}
          className={cn(appTitleBarRecipes.settingsIdle, 'col-start-1', 'row-start-2', 'shrink-0')}
        >
          <ChevronDown
            className={cn(
              'h-4 w-4',
              'transition-transform',
              'duration-200',
              expanded && 'rotate-180'
            )}
          />
        </Button>
        <div
          className={cn(
            'col-start-2',
            'row-span-2',
            'row-start-1',
            'grid',
            'min-w-0',
            'grid-cols-[auto_minmax(0,1fr)]',
            'grid-rows-[2.5rem_auto]',
            'gap-x-2',
            'self-start'
          )}
        >
          <div className={cn('col-start-1', 'row-start-1', 'flex', 'h-10', 'items-center')}>
            <StatusPill status={bank.status} className={cn('shrink-0')} />
          </div>
          <h3
            title={bank.name}
            className={cn(
              'col-start-2',
              'row-start-1',
              'row-span-2',
              'min-w-0',
              'line-clamp-2',
              'break-words',
              'pt-[calc((2.5rem-1.5rem*1.25)/2)]',
              uiTypographyRecipes.sectionTitle,
              uiTextRecipes.primary
            )}
          >
            {bank.name}
          </h3>
        </div>
        <Button
          type="button"
          onClick={handleDisconnectClick}
          variant="danger"
          size="icon"
          aria-label="Disconnect"
          className={cn('col-start-3', 'row-start-1', 'shrink-0')}
        >
          <Unlink className={cn('h-4 w-4')} />
        </Button>
        {statusCaption ? (
          <p
            className={cn(
              'col-span-3',
              'row-start-3',
              uiTypographyRecipes.caption,
              ...(bank.status === 'needs_reauth'
                ? uiStatusRecipes.warning.text
                : uiStatusRecipes.danger.text)
            )}
          >
            {statusCaption}
          </p>
        ) : null}
      </div>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
            className={cn('space-y-6', 'border-t', ...uiBorderRecipes.elevatedGlass, 'pt-4')}
          >
            {(() => {
              const sortedAccounts = bank.accounts.slice().sort((a, b) => {
                const aOrder = accountTypeSortOrder[a.type] ?? 4;
                const bOrder = accountTypeSortOrder[b.type] ?? 4;

                if (aOrder !== bOrder) {
                  return aOrder - bOrder;
                }

                const aBalance = a.balance || 0;
                const bBalance = b.balance || 0;
                return bBalance - aBalance;
              });

              const cashAccounts = sortedAccounts.filter(
                (a) => a.type === 'checking' || a.type === 'savings'
              );
              const creditAccounts = sortedAccounts.filter((a) => a.type === 'credit');
              const investmentAccounts = sortedAccounts.filter((a) => a.type === 'other');
              const loanAccounts = sortedAccounts.filter((a) => a.type === 'loan');

              return (
                <>
                  {cashAccounts.length > 0 && renderGroup('cash', cashAccounts)}
                  {creditAccounts.length > 0 && renderGroup('credit', creditAccounts)}
                  {investmentAccounts.length > 0 && renderGroup('investments', investmentAccounts)}
                  {loanAccounts.length > 0 && renderGroup('loans', loanAccounts)}
                </>
              );
            })()}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <DisconnectModal
        isOpen={showDisconnectModal}
        bank={bank}
        onConfirm={handleDisconnectConfirm}
        onCancel={handleDisconnectCancel}
        loading={disconnectLoading}
      />
    </GlassCard>
  );
};
