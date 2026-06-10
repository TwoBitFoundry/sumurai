import { computeYtdIncomeExpenses, isTransferCategory } from '@/domain/YtdTotalsCalculator';
import type { Transaction } from '@/types/api';

function makeTxn(
  date: string,
  amount: number,
  primary: string
): Pick<Transaction, 'date' | 'amount' | 'category'> {
  return {
    date,
    amount,
    category: { primary },
  };
}

describe('isTransferCategory', () => {
  it('matches transfer in and out slugs', () => {
    expect(isTransferCategory('TRANSFER_IN')).toBe(true);
    expect(isTransferCategory('TRANSFER_OUT')).toBe(true);
    expect(isTransferCategory('Transfer In')).toBe(true);
    expect(isTransferCategory('INCOME')).toBe(false);
  });
});

describe('computeYtdIncomeExpenses', () => {
  const referenceDate = new Date('2026-06-15T12:00:00.000Z');

  it('sums positive amounts as income and negative amounts as expenses', () => {
    const transactions = [
      makeTxn('2026-01-10', 5000, 'INCOME'),
      makeTxn('2026-02-12', -120, 'FOOD_AND_DRINK'),
      makeTxn('2026-03-05', 250, 'INCOME'),
      makeTxn('2026-03-20', -80, 'TRANSPORTATION'),
    ] as Transaction[];

    expect(computeYtdIncomeExpenses(transactions, 2026, referenceDate)).toEqual({
      incomeYtd: 5250,
      expensesYtd: 200,
    });
  });

  it('excludes transfer in and transfer out categories', () => {
    const transactions = [
      makeTxn('2026-04-01', 5000, 'INCOME'),
      makeTxn('2026-04-02', 300, 'TRANSFER_IN'),
      makeTxn('2026-04-03', -200, 'TRANSFER_OUT'),
      makeTxn('2026-04-04', -45, 'FOOD_AND_DRINK'),
    ] as Transaction[];

    expect(computeYtdIncomeExpenses(transactions, 2026, referenceDate)).toEqual({
      incomeYtd: 5000,
      expensesYtd: 45,
    });
  });

  it('includes loan payments and other negatives in expenses', () => {
    const transactions = [
      makeTxn('2026-05-01', 1000, 'INCOME'),
      makeTxn('2026-05-02', -400, 'LOAN_PAYMENTS'),
      makeTxn('2026-05-03', -5, 'BANK_FEES'),
    ] as Transaction[];

    expect(computeYtdIncomeExpenses(transactions, 2026, referenceDate)).toEqual({
      incomeYtd: 1000,
      expensesYtd: 405,
    });
  });

  it('limits to the requested year through the reference date', () => {
    const transactions = [
      makeTxn('2025-12-31', 1000, 'INCOME'),
      makeTxn('2026-01-01', 2000, 'INCOME'),
      makeTxn('2026-06-15', 500, 'INCOME'),
      makeTxn('2026-06-16', 900, 'INCOME'),
      makeTxn('2026-07-01', 700, 'INCOME'),
    ] as Transaction[];

    expect(computeYtdIncomeExpenses(transactions, 2026, referenceDate)).toEqual({
      incomeYtd: 2500,
      expensesYtd: 0,
    });
  });

  it('returns zeros for an empty list', () => {
    expect(computeYtdIncomeExpenses([], 2026, referenceDate)).toEqual({
      incomeYtd: 0,
      expensesYtd: 0,
    });
  });
});
