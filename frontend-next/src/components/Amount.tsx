import React from 'react';
import { fmtUSD } from '../utils/format';
export { fmtUSD } from '../utils/format';

export function Amount({ value, className = '' }: { value: number; className?: string }) {
  const isNegative = value < 0;
  const color = isNegative
    ? 'text-red-600 dark:text-red-400'
    : 'text-slate-900 dark:text-slate-100';
  return <span className={`${color} tabular-nums ${className}`}>{fmtUSD(value)}</span>;
}
