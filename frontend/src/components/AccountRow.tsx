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
    <div className="grid grid-cols-12 items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 p-4">
      <div className="col-span-6 flex min-w-0 items-center gap-3">
        <AccountTypeDot type={account.type} />
        <div className="min-w-0">
          <div className="text-slate-900 dark:text-slate-100 font-medium break-words">
            {account.name}{" "}
            <span className="text-slate-600 dark:text-slate-400 font-normal">••{account.mask}</span>
          </div>
          <div className="text-slate-600 dark:text-slate-400 text-xs capitalize">{account.type}</div>
        </div>
      </div>
      <div
        className={classNames(
          "col-span-3 text-right text-sm font-mono tabular-nums",
          account.balance != null
            ? isDebtAccount
              ? "text-red-400"
              : isOtherAccount
              ? "text-slate-400" 
              : account.balance < 0
              ? "text-rose-400"
              : account.balance > 0
              ? "text-emerald-400"
              : "text-slate-200"
            : "text-slate-400"
        )}
      >
        {formatMoney(account.balance)}
      </div>
      <div className="col-span-3 text-right">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 dark:bg-slate-700/60 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
          {account.transactions ?? 0} txns
        </span>
      </div>
    </div>
  );
};