import { describe, expect, it } from '@jest/globals';
import type { Transaction } from '@/types/api';
import {
  getDisplayAmount,
  getNetSpendingAmount,
  isSpendingTransaction,
} from '@/utils/transactionAmounts';

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'txn_1',
  account_id: 'acc_1',
  date: '2026-06-03',
  name: 'Best Buy',
  merchant: 'Best Buy',
  amount: 42.99,
  category: { primary: 'GENERAL_MERCHANDISE' },
  account_name: 'Best Buy Credit Card',
  account_type: 'credit',
  provider: 'plaid',
  ...overrides,
});

describe('transactionAmounts', () => {
  it('renders positive Plaid credit-card purchases as spending', () => {
    const purchase = transaction({ amount: 42.99, account_type: 'credit', provider: 'plaid' });

    expect(getDisplayAmount(purchase)).toBe(-42.99);
    expect(isSpendingTransaction(purchase)).toBe(true);
  });

  it('renders negative Teller credit-card purchases as spending', () => {
    const purchase = transaction({
      amount: -25,
      account_name: 'Prime Visa',
      account_type: 'credit',
      provider: 'teller',
    });

    expect(getDisplayAmount(purchase)).toBe(-25);
    expect(isSpendingTransaction(purchase)).toBe(true);
  });

  it('renders negative stored Plaid credits as income', () => {
    const payment = transaction({ amount: -25, account_type: 'credit', provider: 'plaid' });

    expect(getDisplayAmount(payment)).toBe(25);
    expect(isSpendingTransaction(payment)).toBe(false);
  });

  it('subtracts credit-card refunds from net spending', () => {
    const tellerRefund = transaction({ amount: 25, account_type: 'credit', provider: 'teller' });
    const plaidRefund = transaction({ amount: -15, account_type: 'credit', provider: 'plaid' });

    expect(getNetSpendingAmount(tellerRefund)).toBe(-25);
    expect(getNetSpendingAmount(plaidRefund)).toBe(-15);
  });

  it('excludes paychecks and income from spending', () => {
    const paycheck = transaction({
      amount: -2500,
      account_name: 'Checking',
      account_type: 'depository',
      category: { primary: 'INCOME', detailed: 'INCOME_SALARY' },
    });

    expect(getDisplayAmount(paycheck)).toBe(2500);
    expect(getNetSpendingAmount(paycheck)).toBe(0);
    expect(isSpendingTransaction(paycheck)).toBe(false);
  });

  it('excludes credit card payments on credit card accounts from spending', () => {
    const cardPayment = transaction({
      amount: -500,
      account_name: 'Best Buy Credit Card',
      account_type: 'credit',
      category: {
        primary: 'LOAN_PAYMENTS',
        detailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT',
      },
    });

    expect(getDisplayAmount(cardPayment)).toBe(500);
    expect(getNetSpendingAmount(cardPayment)).toBe(0);
    expect(isSpendingTransaction(cardPayment)).toBe(false);
  });

  it('excludes credit card payments from checking accounts from spending', () => {
    const billPayment = transaction({
      amount: 500,
      account_name: 'Checking',
      account_type: 'depository',
      category: {
        primary: 'LOAN_PAYMENTS',
        detailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT',
      },
    });

    expect(getDisplayAmount(billPayment)).toBe(-500);
    expect(getNetSpendingAmount(billPayment)).toBe(0);
    expect(isSpendingTransaction(billPayment)).toBe(false);
  });

  it('does not treat deposits into checking accounts as negative spending', () => {
    const deposit = transaction({
      amount: -1000,
      account_name: 'Checking',
      account_type: 'depository',
      category: { primary: 'GENERAL_SERVICES' },
    });

    expect(getDisplayAmount(deposit)).toBe(1000);
    expect(getNetSpendingAmount(deposit)).toBe(0);
    expect(isSpendingTransaction(deposit)).toBe(false);
  });

  it('counts checking account expenses as positive spending', () => {
    const rent = transaction({
      amount: 1500,
      account_name: 'Checking',
      account_type: 'depository',
      category: { primary: 'Bills & Utilities' },
    });

    expect(getDisplayAmount(rent)).toBe(-1500);
    expect(getNetSpendingAmount(rent)).toBe(1500);
    expect(isSpendingTransaction(rent)).toBe(true);
  });
});
