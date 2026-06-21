import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Download, Plus, RefreshCw, Shield, Unlink } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import useViewportBreakpoint from '@/hooks/useViewportBreakpoint';
import type { FinancialProvider } from '@/types/api';
import { getProviderCardConfig, getProviderLogoSrc } from '@/utils/providerCards';
import { getSessionBankExpanded, setSessionBankExpanded } from '@/utils/sessionPreferences';
import {
  ACCOUNT_GROUP_LABELS,
  type AccountCategoryType,
  type AccountGroupKey,
  accountTypeSortOrder,
} from '../domain/accountCategories';
import { getConnectionStatusCaption } from '../domain/connectionStatus';
import {
  Button,
  ControlHoverLabel,
  cn,
  GlassCard,
  IconButton,
  MenuDropdown,
  MenuItem,
} from '../ui/primitives';
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
  type: AccountCategoryType;
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

const FINANCIAL_PROVIDERS = new Set<FinancialProvider>(['diy', 'simplefin', 'teller', 'plaid']);

function resolveBankProvider(provider: string | undefined): FinancialProvider | null {
  if (provider && FINANCIAL_PROVIDERS.has(provider as FinancialProvider)) {
    return provider as FinancialProvider;
  }

  return null;
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
  const { isDesktop } = useViewportBreakpoint();
  const isCompactHeader = !isDesktop;
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

  const headerSecondaryActions = (
    <>
      {addAccountControl}
      {syncControl}
      {exportControl}
    </>
  );

  const headerSecondaryActionsRow = (
    <div
      className={cn(
        'pointer-events-auto',
        'flex',
        'items-center',
        'gap-2',
        'col-start-2',
        'col-span-2',
        'row-start-2'
      )}
    >
      {headerSecondaryActions}
    </div>
  );

  const headerDisconnect = (
    <div
      className={cn(
        'pointer-events-auto',
        'col-start-4',
        'row-start-2',
        'self-end',
        'justify-self-end'
      )}
    >
      {disconnectControl}
    </div>
  );

  const bankCardHeaderGrid = cn(
    'grid',
    'w-full',
    'grid-cols-[1rem_auto_minmax(0,1fr)_auto]',
    'gap-x-2'
  );

  const bankCardHeaderIconShell = cn(
    'flex',
    'items-center',
    'justify-center',
    control.square.md,
    'shrink-0'
  );

  const bankCardHeaderRowHeight = cn('min-h-11', 'md:min-h-9', 'lg:min-h-8');

  const bankProvider = resolveBankProvider(bank.provider);
  const providerLogoSrc = bankProvider ? getProviderLogoSrc(bankProvider) : undefined;
  const ProviderLogoIcon = bankProvider ? getProviderCardConfig(bankProvider).logoIcon : undefined;

  const providerEmblem =
    bankProvider === 'diy' ? (
      <span className={cn(...controlIconWell.lg, ...uiStatusRecipes.info.icon)}>
        <Shield strokeWidth={2.25} aria-hidden />
      </span>
    ) : providerLogoSrc ? (
      <img
        src={providerLogoSrc}
        alt=""
        className={cn(control.glyph.lg, 'rounded-full', 'object-cover')}
      />
    ) : ProviderLogoIcon ? (
      <span className={cn(...controlIconWell.lg, uiTextRecipes.subtle)}>
        <ProviderLogoIcon strokeWidth={2.25} aria-hidden />
      </span>
    ) : null;

  const providerEmblemTooltipLabel =
    bankProvider === 'diy'
      ? 'Self-managed'
      : bankProvider
        ? `Connected with ${getProviderCardConfig(bankProvider).title}`
        : undefined;

  const bankTitle = (
    <h3
      title={bank.name}
      className={cn(
        'min-w-0',
        'flex-1',
        'line-clamp-2',
        'break-words',
        uiTypographyRecipes.sectionTitle,
        uiTextRecipes.primary,
        isCompactHeader && 'leading-none'
      )}
    >
      {bank.name}
    </h3>
  );

  const providerEmblemCell =
    providerEmblem && providerEmblemTooltipLabel ? (
      <ControlHoverLabel label={providerEmblemTooltipLabel}>
        <div className={cn(bankCardHeaderIconShell)}>{providerEmblem}</div>
      </ControlHoverLabel>
    ) : (
      <div className={cn(bankCardHeaderIconShell)}>{providerEmblem}</div>
    );

  const desktopHeaderActions = (
    <div className={cn('pointer-events-auto', 'flex', 'shrink-0', 'items-center', 'gap-2')}>
      {headerSecondaryActions}
      {disconnectControl}
      {providerEmblemCell}
    </div>
  );

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
        <div className={cn(...uiInsightsPanelRecipes.summaryToggleContent)}>
          <div className={cn(bankCardHeaderGrid, 'items-start', 'gap-y-2')}>
            <div
              className={cn(
                'col-start-1',
                'row-start-1',
                'self-center',
                'flex',
                'w-4',
                'items-center',
                'justify-center',
                bankCardHeaderRowHeight
              )}
              aria-hidden="true"
            >
              <ChevronDown
                className={cn(...uiInsightsPanelRecipes.summaryChevron, expanded && 'rotate-180')}
              />
            </div>
            <div
              className={cn('col-start-2', 'row-start-1', 'self-center', bankCardHeaderIconShell)}
            >
              <StatusPill status={bank.status} />
            </div>
            <div
              className={cn(
                isCompactHeader ? 'col-start-3' : cn('col-start-3', 'col-span-2'),
                'row-start-1',
                'self-center',
                'flex',
                'min-w-0',
                'items-center',
                'gap-2',
                isCompactHeader && bankCardHeaderRowHeight
              )}
            >
              {bankTitle}
              {isCompactHeader ? null : desktopHeaderActions}
            </div>
            {isCompactHeader ? (
              <>
                <div
                  className={cn('col-start-4', 'row-start-1', 'self-center', 'justify-self-end')}
                >
                  {providerEmblemCell}
                </div>
                {headerSecondaryActionsRow}
                {headerDisconnect}
              </>
            ) : null}
          </div>
          {statusCaption ? (
            <div className={cn(bankCardHeaderGrid, 'mt-1', 'gap-y-0')}>
              <div className={cn('col-start-1')} aria-hidden />
              <p
                className={cn(
                  'col-start-2',
                  'col-span-2',
                  'min-w-0',
                  uiTypographyRecipes.caption,
                  ...(bank.status === 'needs_reauth'
                    ? uiStatusRecipes.warning.text
                    : uiStatusRecipes.danger.text)
                )}
              >
                {statusCaption}
              </p>
              <div className={cn('col-start-4')} aria-hidden />
            </div>
          ) : null}
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

              const cashAccounts = sortedAccounts.filter((a) => a.type === 'cash');
              const creditAccounts = sortedAccounts.filter((a) => a.type === 'credit');
              const investmentAccounts = sortedAccounts.filter((a) => a.type === 'investments');
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
