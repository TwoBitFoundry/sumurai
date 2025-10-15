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
import { Button, MenuDropdown, MenuItem, cn } from "../ui/primitives";

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

const BANK_CARD_ACCENT = {
  gradFrom: "#38bdf8",
  gradVia: "#0ea5e9",
} as const;

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
          <MoreVertical className="h-5 w-5" />
        </Button>
      }
    >
      <MenuItem
        icon={<Unlink className="h-4 w-4" />}
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
  const sectionTitleClass =
    "mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-600 transition-colors duration-300 ease-out dark:text-slate-200";

  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  const Avatar = useMemo(
    () => (
      <div className="relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/85 text-[#0ea5e9] shadow-[0_20px_55px_-32px_rgba(14,165,233,0.55)] ring-1 ring-white/55 transition-colors duration-300 ease-out dark:bg-[#1e293b]/85 dark:text-[#38bdf8] dark:shadow-[0_22px_60px_-34px_rgba(56,189,248,0.45)] dark:ring-white/12">
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0ea5e9]/24 via-transparent to-[#a78bfa]/28 opacity-80" />
        <span className="pointer-events-none absolute inset-[22%] rounded-2xl bg-white/40 blur-[18px] opacity-60 dark:bg-white/10" />
        <span className="relative text-sm font-semibold tracking-wide">
          {bank.short}
        </span>
      </div>
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

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/85 p-6 backdrop-blur-sm transition-colors duration-300 dark:border-white/10 dark:bg-[#111a2f]/75"
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          backgroundImage: `linear-gradient(180deg, ${BANK_CARD_ACCENT.gradFrom}20 0%, ${BANK_CARD_ACCENT.gradVia}14 34%, rgba(14,165,233,0.06) 55%, transparent 85%)`,
        }}
      />
      <div className="relative z-10 flex w-full flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {Avatar}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-lg font-semibold leading-tight text-[#0f172a] transition-colors duration-300 ease-out dark:text-white md:text-xl">
                {bank.name}
              </h3>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-[#64748b] transition-colors duration-300 ease-out dark:text-[#94a3b8]">
              <StatusPill status={bank.status} className="scale-90" />
              <span>Last sync {relativeTime(bank.lastSync)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center justify-start gap-2 md:justify-end">
          <Button
            onClick={handleSync}
            disabled={loading}
            variant="secondary"
          >
            <RefreshCw
              className={cn('h-4 w-4', loading && 'animate-spin')}
            />
            Sync now
          </Button>
          <Button
            onClick={() => setExpanded((v) => !v)}
            variant="secondary"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-180"
              )}
            />
            {expanded ? "Hide" : "Show"}
          </Button>
          <CardMenu onDisconnect={handleDisconnectClick} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-6 border-t border-white/60 pt-4 transition-colors duration-300 ease-out dark:border-white/10"
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
                  {cashAccounts.length > 0 && (
                    <div>
                      <h4 className={sectionTitleClass}>Cash</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {cashAccounts.map((account) => (
                          <AccountRow account={account} key={account.id} />
                        ))}
                      </div>
                    </div>
                  )}

                  {debtAccounts.length > 0 && (
                    <div>
                      <h4 className={sectionTitleClass}>Debt</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {debtAccounts.map((account) => (
                          <AccountRow account={account} key={account.id} />
                        ))}
                      </div>
                    </div>
                  )}

                  {investmentAccounts.length > 0 && (
                    <div>
                      <h4 className={sectionTitleClass}>Investments</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {investmentAccounts.map((account) => (
                          <AccountRow account={account} key={account.id} />
                        ))}
                      </div>
                    </div>
                  )}
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
    </div>
  );
};
