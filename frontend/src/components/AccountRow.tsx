import React from "react";

interface Account {
  id: string;
  name: string;
  mask: string; // last 4 digits
  type: "checking" | "savings" | "credit" | "loan" | "other";
  balance?: number;
  transactions?: number;
}

interface AccountRowProps {
  account: Account;
}

const classNames = (...classes: (string | false | null | undefined)[]) => {
  return classes.filter(Boolean).join(" ");
};

const formatMoney = (amount?: number) => {
  if (typeof amount !== "number") return "PLACEHOLDER";
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
};

const AccountTypeDot: React.FC<{ type: Account["type"] }> = ({ type }) => {
  const colors = {
    checking: "#38bdf8",
    savings: "#22c55e", 
    credit: "#f59e0b",
    loan: "#a78bfa",
    other: "#94a3b8",
  };

  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: colors[type] }}
    />
  );
};

export const AccountRow: React.FC<AccountRowProps> = ({ account }) => {
  const isDebtAccount = account.type === 'credit' || account.type === 'loan';
  const isOtherAccount = account.type === 'other';

  return (
    <div className="group rounded-xl border border-slate-200 dark:border-slate-700/60 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/60 dark:to-slate-800/40 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="text-slate-900 dark:text-slate-100 font-bold text-base">
          {account.name}
        </div>
        <div
          className={classNames(
            "text-xl font-mono font-bold tabular-nums",
            account.balance != null
              ? isDebtAccount
                ? "text-red-500 dark:text-red-400"
                : isOtherAccount
                ? "text-slate-500 dark:text-slate-400"
                : account.balance < 0
                ? "text-rose-500 dark:text-rose-400"
                : account.balance > 0
                ? "text-emerald-500 dark:text-emerald-400"
                : "text-slate-300 dark:text-slate-600"
              : "text-slate-400"
          )}
        >
          {formatMoney(account.balance)}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AccountTypeDot type={account.type} />
          <span className="text-slate-600 dark:text-slate-400 text-xs font-medium capitalize">
            {account.type}
          </span>
          <span className="text-slate-500 dark:text-slate-500 text-xs font-mono">
            ••{account.mask}
          </span>
        </div>
        <span className="inline-flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
          {account.transactions ?? 0} items
        </span>
      </div>
    </div>
  );
};