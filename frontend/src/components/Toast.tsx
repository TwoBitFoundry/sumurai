import React from "react";
import { motion } from "framer-motion";

interface ToastProps {
  message: string;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-4 overflow-hidden rounded-2xl border border-white/35 bg-white/90 px-5 py-3.5 text-sm font-medium text-[#0f172a] shadow-[0_24px_70px_-38px_rgba(15,23,42,0.55)] backdrop-blur-md transition-colors duration-300 ease-out dark:border-white/12 dark:bg-[#0f172a]/92 dark:text-white"
    >
      <div className="flex-1">{message}</div>
      <button
        className="inline-flex items-center justify-center rounded-full border border-[#e2e8f0] bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#475569] shadow-[0_12px_34px_-26px_rgba(15,23,42,0.45)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#93c5fd] hover:text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-[#334155] dark:bg-[#1e293b]/85 dark:text-[#cbd5e1] dark:hover:border-[#38bdf8] dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
        onClick={onClose}
      >
        Close
      </button>
    </motion.div>
  );
};
