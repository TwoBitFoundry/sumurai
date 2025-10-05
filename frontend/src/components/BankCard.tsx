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
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-white/75 text-[#64748b] shadow-[0_14px_36px_-28px_rgba(15,23,42,0.45)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#93c5fd] hover:text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-[#1e293b]/85 dark:text-[#94a3b8] dark:hover:border-[#38bdf8] dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
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
            className="absolute right-0 z-20 mt-3 w-48 overflow-hidden rounded-2xl border border-white/45 bg-white/95 p-2 shadow-[0_22px_60px_-32px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-white/12 dark:bg-[#0f172a]/92 dark:shadow-[0_28px_70px_-36px_rgba(2,6,23,0.7)]"
          >
            <button
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[#475569] transition-colors duration-200 ease-out hover:bg-[#f8fafc] dark:text-[#cbd5e1] dark:hover:bg-[#1e293b]"
              onClick={() => {
                setOpen(false);
                onDisconnect();
              }}
            >
              <Unlink className="h-4 w-4 text-[#475569] dark:text-[#cbd5e1]" /> Disconnect
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
  const [expanded, setExpanded] = useState(false);
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
    <div className="relative rounded-[1.9rem] border border-[#00000012] bg-white/90 p-6 shadow-[0_24px_68px_-38px_rgba(15,23,42,0.45)] transition-all duration-300 ease-out hover:-translate-y-[2px] hover:shadow-[0_28px_78px_-34px_rgba(15,23,42,0.55)] dark:border-[#ffffff14] dark:bg-[#0f172a]/88 dark:shadow-[0_28px_80px_-40px_rgba(2,6,23,0.78)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.9rem]">
        <div className="absolute inset-[1px] rounded-[1.75rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),inset_0_-1px_0_rgba(15,23,42,0.12)] dark:ring-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.45)]" />
        <div className="absolute inset-0 rounded-[1.9rem] bg-[radial-gradient(135%_155%_at_88%_112%,rgba(14,165,233,0.16)_0%,rgba(167,139,250,0.12)_42%,transparent_80%)] opacity-70 dark:bg-[radial-gradient(135%_160%_at_90%_116%,rgba(38,198,218,0.24)_0%,rgba(167,139,250,0.2)_40%,transparent_82%)]" />
      </div>

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
          <button
            onClick={handleSync}
            disabled={loading}
            className={classNames(
              'inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white/90 px-4 py-2 text-sm font-semibold text-[#475569] shadow-[0_14px_38px_-30px_rgba(15,23,42,0.35)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#93c5fd] hover:text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:border-[#334155] dark:bg-[#1e293b]/90 dark:text-[#cbd5e1] dark:hover:border-[#38bdf8] dark:hover:text-white dark:focus-visible:ring-offset-slate-900'
            )}
          >
            <RefreshCw
              className={classNames('h-4 w-4', loading && 'animate-spin')}
            />
            Sync now
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white/90 px-4 py-2 text-sm font-semibold text-[#475569] shadow-[0_14px_38px_-30px_rgba(15,23,42,0.35)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#93c5fd] hover:text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-[#334155] dark:bg-[#1e293b]/90 dark:text-[#cbd5e1] dark:hover:border-[#38bdf8] dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
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
                      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#64748b] transition-colors duration-300 ease-out dark:text-[#94a3b8]">Cash</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {cashAccounts.map((account) => (
                          <AccountRow account={account} key={account.id} />
                        ))}
                      </div>
                    </div>
                  )}

                  {debtAccounts.length > 0 && (
                    <div>
                      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#64748b] transition-colors duration-300 ease-out dark:text-[#94a3b8]">Debt</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {debtAccounts.map((account) => (
                          <AccountRow account={account} key={account.id} />
                        ))}
                      </div>
                    </div>
                  )}

                  {investmentAccounts.length > 0 && (
                    <div>
                      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#64748b] transition-colors duration-300 ease-out dark:text-[#94a3b8]">Investments</h4>
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
