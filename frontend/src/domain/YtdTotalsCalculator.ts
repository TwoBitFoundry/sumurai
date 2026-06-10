import type { Transaction } from '@/types/api';

export function isTransferCategory(categoryPrimary: string | undefined | null): boolean {
  const normalized = (categoryPrimary || '').trim().replace(/\s+/g, '_').toUpperCase();
  return normalized === 'TRANSFER_IN' || normalized === 'TRANSFER_OUT';
}

export function computeYtdIncomeExpenses(
  transactions: Transaction[],
  year: number,
  referenceDate: Date = new Date()
): { incomeYtd: number; expensesYtd: number } {
  const start = `${year}-01-01`;
  const end =
    referenceDate.getFullYear() === year
      ? referenceDate.toISOString().slice(0, 10)
      : `${year}-12-31`;

  let incomeYtd = 0;
  let expensesYtd = 0;

  for (const transaction of transactions) {
    const dateString = new Date(transaction.date).toISOString().slice(0, 10);
    if (dateString < start || dateString > end) {
      continue;
    }

    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      continue;
    }

    if (isTransferCategory(transaction.category?.primary)) {
      continue;
    }

    if (amount > 0) {
      incomeYtd += amount;
    } else {
      expensesYtd += Math.abs(amount);
    }
  }

  return { incomeYtd, expensesYtd };
}
