import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, AlertTriangle } from "lucide-react";

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
  short: string;
  status: "connected" | "needs_reauth" | "error";
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

const classNames = (...classes: (string | false | null | undefined)[]) => {
  return classes.filter(Boolean).join(" ");
};

export const DisconnectModal: React.FC<DisconnectModalProps> = ({
  isOpen,
  bank,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const accountCount = bank.accounts.length;
  const accountText = accountCount === 1 ? "1 account" : `${accountCount} accounts`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#0f172a]/70 backdrop-blur-sm transition-colors duration-300 ease-out dark:bg-black/70"
            onClick={onCancel}
            data-testid="modal-backdrop"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/18 bg-white/92 p-6 shadow-[0_32px_95px_-48px_rgba(15,23,42,0.55)] transition-colors duration-300 ease-out dark:border-white/12 dark:bg-[#0f172a]/92 dark:shadow-[0_36px_100px_-46px_rgba(2,6,23,0.78)]"
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-[1px] rounded-[1.6rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(15,23,42,0.12)] opacity-80 dark:ring-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(2,6,23,0.5)]" />
              <div className="absolute inset-0 rounded-[1.75rem] bg-[radial-gradient(130%_140%_at_88%_112%,rgba(248,113,113,0.18)_0%,rgba(167,139,250,0.16)_40%,transparent_78%)] opacity-75 dark:bg-[radial-gradient(140%_150%_at_90%_118%,rgba(248,113,113,0.28)_0%,rgba(167,139,250,0.22)_42%,transparent_82%)]" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fef3c7]/80 text-[#d97706] shadow-[0_18px_45px_-30px_rgba(248,196,113,0.65)] ring-1 ring-[#fbbf24]/40 dark:bg-[#451a03]/70 dark:text-[#facc15] dark:ring-[#facc15]/35">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="mb-2 text-lg font-semibold text-[#0f172a] transition-colors duration-300 ease-out dark:text-white">
                  Disconnect {bank.name}?
                </h2>
                <p className="text-sm leading-relaxed text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
                  This will remove all {accountText} and transaction data from your app. 
                  This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="relative z-10 mt-6 flex justify-end gap-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className={classNames(
                  "inline-flex items-center justify-center rounded-full border border-[#e2e8f0] bg-white/90 px-4 py-2 text-sm font-semibold text-[#475569] shadow-[0_14px_38px_-30px_rgba(15,23,42,0.35)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#93c5fd] hover:text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:border-[#334155] dark:bg-[#1e293b]/85 dark:text-[#cbd5e1] dark:hover:border-[#38bdf8] dark:hover:text-white dark:focus-visible:ring-offset-slate-900",
                  loading && "pointer-events-none opacity-60 cursor-not-allowed"
                )}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={classNames(
                  "inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#f87171] via-[#f97316] to-[#fbbf24] px-5 py-2 text-sm font-semibold text-white shadow-[0_22px_60px_-32px_rgba(248,113,113,0.68)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-[0_26px_72px_-34px_rgba(248,113,113,0.78)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:focus-visible:ring-offset-[#0f172a]",
                  loading && "pointer-events-none opacity-60 cursor-not-allowed"
                )}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
