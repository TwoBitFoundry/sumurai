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
      className="fixed bottom-6 right-6 z-50 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 shadow-2xl"
    >
      {message}
      <button
        className="ml-4 text-slate-300 hover:text-white"
        onClick={onClose}
      >
        Close
      </button>
    </motion.div>
  );
};