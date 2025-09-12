import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { XMarkIcon } from '@heroicons/react/24/outline';
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
            data-testid="modal-backdrop"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl"
          >
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-slate-100 mb-2">
                  Disconnect {bank.name}?
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  This will remove all {accountText} and transaction data from your app. 
                  This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={onCancel}
                disabled={loading}
                className={classNames(
                  "px-4 py-2 text-sm font-medium rounded-xl border border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-600 transition-colors",
                  loading && "opacity-60 cursor-not-allowed"
                )}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={classNames(
                  "px-4 py-2 text-sm font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-2",
                  loading && "opacity-60 cursor-not-allowed"
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