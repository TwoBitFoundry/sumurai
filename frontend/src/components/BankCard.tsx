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

const classNames = (...classes: (string | false | null | undefined)[]) => {
  return classes.filter(Boolean).join(" ");
};

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
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl text-slate-500 dark:text-slate-300"
        onClick={() => setOpen((v) => !v)}
        aria-label="more"
      >
        <MoreVertical className="h-5 w-5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/95 backdrop-blur p-1 shadow-xl"
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              onClick={() => {
                setOpen(false);
                onDisconnect();
              }}
            >
              <Unlink className="h-4 w-4 text-slate-600 dark:text-slate-300" /> Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const BankCard: React.FC<BankCardProps> = ({
  bank,
  onSync,
  onDisconnect,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  const Avatar = useMemo(
    () => (
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 dark:from-cyan-500/30 dark:to-emerald-500/30 grid place-items-center border border-cyan-200 dark:border-slate-600">
        <span className="text-sm font-semibold text-cyan-800 dark:text-slate-100">
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
    <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-lg dark:shadow-2xl hover:shadow-xl transition-shadow">
      {/* Header row: identity + actions */}
      <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {Avatar}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-slate-900 dark:text-slate-100 font-semibold leading-tight text-lg md:text-xl break-words">
                {bank.name}
              </h3>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
              <StatusPill status={bank.status} className="scale-90" />
              <span>Last sync {relativeTime(bank.lastSync)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-start md:justify-end gap-2 flex-shrink-0">
          <button
            onClick={handleSync}
            disabled={loading}
            className={classNames(
              "inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-100 whitespace-nowrap shadow-sm",
              loading && "opacity-60 cursor-not-allowed",
              !loading && "hover:bg-slate-100 dark:hover:bg-slate-600"
            )}
          >
            <RefreshCw
              className={classNames("h-4 w-4", loading && "animate-spin")}
            />
            Sync now
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-600 whitespace-nowrap shadow-sm"
          >
            <ChevronDown
              className={classNames(
                "h-4 w-4 transition-transform",
                expanded && "rotate-180"
              )}
            />
            {expanded ? "Hide" : "Show"}
          </button>
          <CardMenu onDisconnect={handleDisconnectClick} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-6"
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
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Cash</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {cashAccounts.map((account) => (
                          <AccountRow account={account} key={account.id} />
                        ))}
                      </div>
                    </div>
                  )}

                  {debtAccounts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Debt</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {debtAccounts.map((account) => (
                          <AccountRow account={account} key={account.id} />
                        ))}
                      </div>
                    </div>
                  )}

                  {investmentAccounts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Investments</h4>
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
