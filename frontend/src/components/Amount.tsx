import React from "react";

export function fmtUSD(n: number | string) {
  const num = Number(n);
  if (!Number.isFinite(num) || isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

export function Amount({ value, className = "" }: { value: number; className?: string }) {
  const isNegative = value < 0;
  const color = isNegative ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100";
  return <span className={`${color} tabular-nums ${className}`}>{fmtUSD(value)}</span>;
}

