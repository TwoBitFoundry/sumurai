import React, { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  RefreshCw,
  MoreVertical,
  ChevronDown,
  Unlink,
} from "lucide-react";
import { StatusPill } from "./StatusPill";
import { AccountRow } from "./AccountRow";
import { DisconnectModal } from "./DisconnectModal";
import { Button, GlassCard, MenuDropdown, MenuItem, cn } from "../ui/primitives";

interface Account {
  id: string;
  name: string;
  mask: string;
  type: "checking" | "savings" | "credit" | "loan" | "other";
  balance?: number;
  transactions?: number;
}

interface BankConnection {
  id: string;
  name: string;
  short: string; // initials for avatar
  status: "connected" | "needs_reauth" | "error";
  lastSync?: string; // ISO date string
  accounts: Account[];
}

interface BankCardProps {
  bank: BankConnection;
  onSync: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
}

const relativeTime = (iso?: string) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
};

const CardMenu: React.FC<{
  onDisconnect: () => void;
}> = ({ onDisconnect }) => {
  return (
    <MenuDropdown
      trigger={
        <Button
          variant="icon"
          size="icon"
          aria-label="more"
        >
          <MoreVertical className={cn('h-5', 'w-5')} />
        </Button>
      }
    >
      <MenuItem
        icon={<Unlink className={cn('h-4', 'w-4')} />}
        onClick={onDisconnect}
      >
        Disconnect
      </MenuItem>
    </MenuDropdown>
  );
};

export const BankCard: React.FC<BankCardProps> = ({
  bank,
  onSync,
  onDisconnect,
}) => {
  const sectionBadgeClass = "text-xs font-semibold text-slate-600 dark:text-slate-200";

  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  const Avatar = useMemo(
    () => (
      <GlassCard
        variant="accent"
        rounded="lg"
        padding="sm"
        withInnerEffects={false}
        className={cn('grid', 'h-12', 'w-12', 'place-items-center', 'text-sky-500', 'dark:text-sky-300')}
      >
        <span className={cn('text-sm', 'font-semibold')}>{bank.short}</span>
      </GlassCard>
    ),
    [bank.short]
  );

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

  const renderGroup = (title: string, accounts: Account[]) => (
    <div key={title} className={cn('space-y-3')}>
      <span className={sectionBadgeClass}>{title}</span>
      <div className={cn('grid', 'grid-cols-1', 'gap-3', 'md:grid-cols-2')}>
        {accounts.map((account) => (
          <AccountRow account={account} key={account.id} />
        ))}
      </div>
    </div>
  );

  return (
    <GlassCard
      variant="accent"
      rounded="xl"
      padding="lg"
      withInnerEffects={false}
      className={cn('space-y-6')}
    >
      <div className={cn('flex', 'flex-col', 'gap-4', 'md:flex-row', 'md:gap-6')}>
        <div className={cn('flex-1', 'space-y-3')}>
          <div className={cn('flex', 'items-center', 'gap-3')}>
            {Avatar}
            <div className={cn('min-w-0', 'flex-1', 'space-y-1')}>
              <h3 className={cn('truncate', 'text-lg', 'font-semibold', 'text-slate-900', 'dark:text-white')}>
                {bank.name}
              </h3>
              <div className={cn('flex', 'items-center', 'gap-2', 'text-xs')}>
                <StatusPill status={bank.status} />
                <span className={cn('text-slate-600', 'dark:text-slate-300')}>
                  {(() => {
                    const label = relativeTime(bank.lastSync);
                    return `Last sync ${label.includes('ago') ? label : `${label} ago`}`;
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className={cn('flex', 'items-center', 'gap-2')}>
          <Button onClick={handleSync} disabled={loading} variant="secondary">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Sync now
          </Button>
          <Button onClick={() => setExpanded((v) => !v)} variant="secondary">
            <ChevronDown className={cn('h-4 w-4', expanded && 'rotate-180')} />
            {expanded ? 'Hide' : 'Show'}
          </Button>
          <CardMenu onDisconnect={handleDisconnectClick} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={cn('space-y-6', 'border-t', 'border-white/40', 'pt-4', 'dark:border-white/10')}
          >
            {(() => {
              const sortedAccounts = bank.accounts
                .slice()
                .sort((a, b) => {
                  const typeOrder = { checking: 1, savings: 1, credit: 2, loan: 3, other: 4 };
                  const aOrder = typeOrder[a.type] || 4;
                  const bOrder = typeOrder[b.type] || 4;

                  if (aOrder !== bOrder) {
                    return aOrder - bOrder;
                  }

                  const aBalance = a.balance || 0;
                  const bBalance = b.balance || 0;
                  return bBalance - aBalance;
                });

              const cashAccounts = sortedAccounts.filter(a => a.type === 'checking' || a.type === 'savings');
              const debtAccounts = sortedAccounts.filter(a => a.type === 'credit' || a.type === 'loan');
              const investmentAccounts = sortedAccounts.filter(a => a.type === 'other');

              return (
                <>
                  {cashAccounts.length > 0 && renderGroup('Cash', cashAccounts)}
                  {debtAccounts.length > 0 && renderGroup('Debt', debtAccounts)}
                  {investmentAccounts.length > 0 && renderGroup('Investments', investmentAccounts)}
                </>
              );
            })()}
          </motion.div>
        )}
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
