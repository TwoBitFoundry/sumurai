import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Download, Plus, RefreshCw, Unlink } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { getSessionBankExpanded, setSessionBankExpanded } from '@/utils/sessionPreferences';
import {
  ACCOUNT_GROUP_LABELS,
  type AccountGroupKey,
  accountTypeSortOrder,
} from '../domain/accountCategories';
import { getConnectionStatusCaption } from '../domain/connectionStatus';
import { Button, cn, GlassCard, IconButton, MenuDropdown, MenuItem } from '../ui/primitives';
import { appTitleBarRecipes } from '../ui/primitives/AppTitleBar';
import {
  control,
  controlIconWell,
  border as uiBorderRecipes,
  insightsPanel as uiInsightsPanelRecipes,
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
  onAddAccount?: (id: string) => void;
  onExport?: (format: 'csv' | 'ofx', connectionId?: string) => Promise<void>;
  isExporting?: boolean;
  isOnline: boolean;
  onImportSuccess?: (count: number, mask: string) => void;
}

export const BankCard: React.FC<BankCardProps> = ({
  bank,
  onSync,
  onDisconnect,
  onAddAccount,
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
  const showSyncButton = bank.provider !== 'simplefin' && bank.provider !== 'diy';

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

  const syncControl = showSyncButton ? (
    <IconButton
      type="button"
      size="md"
      onClick={handleSync}
      disabled={loading || !isOnline}
      variant="ghost"
      aria-label="Sync now"
      title={!isOnline ? 'Unavailable while offline' : undefined}
      className={cn(appTitleBarRecipes.settingsIdle, 'shrink-0')}
    >
      <div className={cn('flex', 'flex-col', 'items-center', 'gap-0.5', control.glyph.md)}>
        <RefreshCw className={cn(loading && 'animate-spin')} />
        {loading && syncElapsed > 0 && (
          <span className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted, 'tabular-nums')}>
            {syncElapsed}s
          </span>
        )}
      </div>
    </IconButton>
  ) : null;

  const exportControl = (
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
  );

  const disconnectControl = (
    <Button
      type="button"
      variant="danger"
      size="md"
      onClick={handleDisconnectClick}
      aria-label="Disconnect"
      className={cn(
        'shrink-0',
        'normal-case',
        'pointer-events-auto',
        'aspect-square',
        '!px-0',
        'md:aspect-auto',
        'md:gap-2',
        'md:!px-3'
      )}
    >
      <Unlink className={cn(control.glyph.md)} />
      <span className={cn('hidden', 'md:inline')}>Disconnect</span>
    </Button>
  );

  const addAccountControl =
    bank.provider === 'diy' && onAddAccount ? (
      <IconButton
        type="button"
        variant="ghost"
        size="md"
        onClick={() => onAddAccount(bank.id)}
        aria-label="Add account"
        title="Add account"
        className={cn(appTitleBarRecipes.settingsIdle, 'shrink-0')}
      >
        <Plus />
      </IconButton>
    ) : null;

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
      containerClassName={cn('py-4', 'pr-4', 'pl-3', 'md:py-5', 'md:pr-5', 'md:pl-3.5')}
      className={cn('space-y-6')}
    >
      <div
        className={cn(
          ...uiInsightsPanelRecipes.summaryToggleShell,
          'pr-3',
          'pl-1',
          'pt-3',
          'pb-2',
          'md:pr-3',
          'md:pl-1.5'
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Hide accounts' : 'Show accounts'}
          aria-expanded={expanded}
          className={cn(...uiInsightsPanelRecipes.summaryToggleOverlay)}
        />
        <div
          className={cn(
            ...uiInsightsPanelRecipes.summaryToggleGrid,
            ...uiInsightsPanelRecipes.summaryToggleContent
          )}
        >
          <div className={cn(...uiInsightsPanelRecipes.summaryChevronColumn)} aria-hidden="true">
            <ChevronDown
              className={cn(...uiInsightsPanelRecipes.summaryChevron, expanded && 'rotate-180')}
            />
          </div>
          <div className={cn('min-w-0')}>
            <div
              className={cn(
                'flex',
                'min-w-0',
                'flex-wrap',
                'items-center',
                'gap-x-2',
                'gap-y-2',
                'md:flex-nowrap'
              )}
            >
              <div
                className={cn(
                  'flex',
                  'min-w-0',
                  'w-full',
                  'flex-1',
                  'items-center',
                  'gap-x-2',
                  'md:w-auto'
                )}
              >
                <div
                  className={cn(
                    'flex',
                    'items-center',
                    'justify-center',
                    control.square.md,
                    'shrink-0'
                  )}
                >
                  <StatusPill status={bank.status} provider={bank.provider} />
                </div>
                <h3
                  title={bank.name}
                  className={cn(
                    'min-w-0',
                    'line-clamp-2',
                    'break-words',
                    uiTypographyRecipes.sectionTitle,
                    uiTextRecipes.primary
                  )}
                >
                  {bank.name}
                </h3>
              </div>
              <div
                className={cn(
                  'pointer-events-auto',
                  'flex',
                  'w-full',
                  'items-center',
                  'gap-2',
                  'md:ml-auto',
                  'md:w-auto',
                  'md:justify-end'
                )}
              >
                {addAccountControl}
                {syncControl}
                {exportControl}
                <div className={cn('ml-auto', 'md:ml-0')}>{disconnectControl}</div>
              </div>
            </div>
            {statusCaption ? (
              <p
                className={cn(
                  'mt-1',
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
        </div>
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
