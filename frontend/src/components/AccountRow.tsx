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
  if (typeof amount !== "number") return "—"
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

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
  const isDebtAccount = account.type === "credit" || account.type === "loan"
  const isOtherAccount = account.type === "other"

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white/92 px-4 py-4 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.35)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#93c5fd] hover:shadow-[0_22px_60px_-34px_rgba(15,23,42,0.45)] dark:border-[#334155] dark:bg-[#101a2d]/92 dark:shadow-[0_20px_54px_-34px_rgba(2,6,23,0.65)]">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0ea5e9]/12 via-transparent to-[#a78bfa]/14 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 dark:from-[#38bdf8]/18 dark:via-transparent dark:to-[#a78bfa]/18" />
      <div className="relative z-10">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-[#0f172a] transition-colors duration-300 ease-out dark:text-white">
            {account.name}
          </div>
          <div
            className={classNames(
              'text-sm font-semibold tabular-nums transition-colors duration-300 ease-out',
              account.balance != null
                ? isDebtAccount
                  ? 'text-[#f87171] dark:text-[#fca5a5]'
                  : isOtherAccount
                    ? 'text-[#64748b] dark:text-[#94a3b8]'
                    : account.balance < 0
                      ? 'text-[#f87171] dark:text-[#fca5a5]'
                      : account.balance > 0
                        ? 'text-[#10b981] dark:text-[#34d399]'
                        : 'text-[#94a3b8] dark:text-[#475569]'
                : 'text-[#94a3b8] dark:text-[#475569]'
            )}
          >
            {formatMoney(account.balance)}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium capitalize text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
            <AccountTypeDot type={account.type} />
            <span>{account.type}</span>
            <span className="font-mono text-[#94a3b8] transition-colors duration-300 ease-out dark:text-[#64748b]">
              ••{account.mask}
            </span>
          </div>
          <span className="inline-flex items-center justify-center rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 text-xs font-semibold text-[#475569] transition-colors duration-300 ease-out dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1]">
            {account.transactions ?? 0} items
          </span>
        </div>
      </div>
    </div>
  )
}
