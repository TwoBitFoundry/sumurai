import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Download, RefreshCw, Unlink } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { getSessionBankExpanded, setSessionBankExpanded } from '@/utils/sessionPreferences';
import {
  ACCOUNT_GROUP_LABELS,
  type AccountGroupKey,
  accountTypeSortOrder,
} from '../domain/accountCategories';
import { getConnectionStatusCaption } from '../domain/connectionStatus';
import { cn, GlassCard, IconButton, MenuDropdown, MenuItem } from '../ui/primitives';
import { appTitleBarRecipes } from '../ui/primitives/AppTitleBar';
import {
  control,
  controlIconWell,
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
  provider: string;
  connectionId?: string | null;
  accounts: Account[];
}

interface BankCardProps {
  bank: BankConnection;
  onSync: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
  onExport?: (format: 'csv' | 'ofx', connectionId?: string) => Promise<void>;
  isExporting?: boolean;
  isOnline: boolean;
  onImportSuccess?: (count: number, mask: string) => void;
}

export const BankCard: React.FC<BankCardProps> = ({
  bank,
  onSync,
  onDisconnect,
  onExport = async () => undefined,
  isExporting = false,
  isOnline,
  onImportSuccess,
}) => {
  const sectionBadgeClass = cn(uiTypographyRecipes.label, uiTextRecipes.muted);
  const statusCaption = getConnectionStatusCaption(bank.status);

  const [expanded, setExpanded] = useState(() => getSessionBankExpanded(bank.id));

  useEffect(() => {
    setSessionBankExpanded(bank.id, expanded);
  }, [bank.id, expanded]);
  const [loading, setLoading] = useState(false);
  const [syncElapsed, setSyncElapsed] = useState(0);
  const syncStartRef = useRef<number | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const showSyncButton = bank.provider !== 'simplefin';

  useEffect(() => {
    if (!loading) {
      setSyncElapsed(0);
      syncStartRef.current = null;
      return;
    }
    syncStartRef.current = Date.now();
    const id = setInterval(() => {
      setSyncElapsed(Math.floor((Date.now() - (syncStartRef.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [loading]);

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

  const handleExport = async (format: 'csv' | 'ofx') => {
    await onExport(format, bank.connectionId ?? undefined);
  };

  const renderGroup = (group: AccountGroupKey, accounts: Account[]) => (
    <div key={group} className={cn('space-y-3')}>
      <span className={cn(sectionBadgeClass, 'inline-flex items-center gap-2')}>
        <span className={cn(...controlIconWell.lg)}>
          <AccountGroupIcon group={group} />
        </span>
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
      containerClassName={cn('p-4', 'md:p-5', 'lg:p-5')}
      className={cn('space-y-6')}
    >
      <div
        className={cn(
          'grid',
          'min-w-0',
          'grid-cols-[minmax(0,1fr)_auto]',
          'gap-x-3',
          'gap-y-2',
          statusCaption ? 'grid-rows-[auto_auto_auto]' : 'grid-rows-[auto_auto]'
        )}
      >
        <div
          className={cn(
            'col-start-1',
            'row-start-1',
            'row-span-2',
            'grid',
            'min-w-0',
            'items-center',
            'gap-2',
            'px-3',
            'pt-3',
            'pb-3',
            showSyncButton
              ? 'grid-cols-[auto_auto_minmax(0,1fr)]'
              : 'grid-cols-[auto_minmax(0,1fr)]'
          )}
        >
          <div
            className={cn(
              'col-start-1',
              'row-start-1',
              'flex',
              'items-center',
              'justify-center',
              control.square.md,
              'shrink-0'
            )}
          >
            <StatusPill status={bank.status} />
          </div>
          <h3
            title={bank.name}
            className={cn(
              showSyncButton ? 'col-start-3' : 'col-start-2',
              'row-start-1',
              'min-w-0',
              'line-clamp-2',
              'break-words',
              uiTypographyRecipes.sectionTitle,
              uiTextRecipes.primary
            )}
          >
            {bank.name}
          </h3>
          <IconButton
            type="button"
            size="md"
            onClick={() => setExpanded((v) => !v)}
            variant="ghost"
            aria-label={expanded ? 'Hide accounts' : 'Show accounts'}
            className={cn(
              appTitleBarRecipes.settingsIdle,
              'col-start-1',
              'row-start-2',
              'shrink-0',
              'justify-self-center'
            )}
          >
            <ChevronDown
              className={cn('transition-transform', 'duration-200', expanded && 'rotate-180')}
            />
          </IconButton>
          {showSyncButton ? (
            <IconButton
              type="button"
              size="md"
              onClick={handleSync}
              disabled={loading || !isOnline}
              variant="ghost"
              aria-label="Sync now"
              title={!isOnline ? 'Unavailable while offline' : undefined}
              className={cn(
                appTitleBarRecipes.settingsIdle,
                'col-start-2',
                'row-start-2',
                'shrink-0',
                'justify-self-center'
              )}
            >
              <div className={cn('flex', 'flex-col', 'items-center', 'gap-0.5', control.glyph.md)}>
                <RefreshCw className={cn(loading && 'animate-spin')} />
                {loading && syncElapsed > 0 && (
                  <span
                    className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted, 'tabular-nums')}
                  >
                    {syncElapsed}s
                  </span>
                )}
              </div>
            </IconButton>
          ) : null}
          <div
            className={cn(
              showSyncButton ? 'col-start-3' : 'col-start-2',
              'row-start-2',
              'justify-self-start'
            )}
          >
            <MenuDropdown
              trigger={
                <IconButton
                  type="button"
                  size="md"
                  variant="ghost"
                  aria-label="Export institution data"
                  title={
                    isExporting
                      ? 'Exporting...'
                      : !isOnline
                        ? 'Unavailable while offline'
                        : bank.connectionId == null
                          ? 'Export unavailable'
                          : 'Export institution data'
                  }
                  disabled={isExporting || !isOnline || bank.connectionId == null}
                  className={cn(appTitleBarRecipes.settingsIdle, 'shrink-0')}
                >
                  <Download className={cn(isExporting && 'animate-pulse')} />
                </IconButton>
              }
            >
              <MenuItem onClick={() => void handleExport('csv')}>Export as CSV</MenuItem>
              <MenuItem onClick={() => void handleExport('ofx')}>Export as OFX</MenuItem>
            </MenuDropdown>
          </div>
        </div>
        <div
          className={cn(
            'col-start-2',
            'row-start-1',
            'row-span-2',
            'flex',
            'items-center',
            'self-center',
            'pr-3'
          )}
        >
          <IconButton
            type="button"
            size="md"
            onClick={handleDisconnectClick}
            variant="danger"
            aria-label="Disconnect"
            className={cn('shrink-0')}
          >
            <Unlink />
          </IconButton>
        </div>
        {statusCaption ? (
          <p
            className={cn(
              'col-span-2',
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
