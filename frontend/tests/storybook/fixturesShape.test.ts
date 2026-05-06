import { sampleAccounts } from '@/storybook/fixtures/accounts';
import { sampleDonutByCategory, sampleTopMerchants } from '@/storybook/fixtures/analytics';
import { sampleBudgetProgressEntries, sampleBudgets } from '@/storybook/fixtures/budgets';
import { sampleNetWorthSeries } from '@/storybook/fixtures/netWorth';
import { sampleBankConnections } from '@/storybook/fixtures/plaid';
import { STORY_FIXED_ISO } from '@/storybook/fixtures/time';
import { sampleTransactions, transactionsTablePage } from '@/storybook/fixtures/transactions';

describe('storybook fixtures', () => {
  it('uses a fixed clock base for deterministic dates', () => {
    expect(STORY_FIXED_ISO).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('exposes representative transactions', () => {
    expect(sampleTransactions.length).toBeGreaterThan(0);
    const first = sampleTransactions[0];
    expect(first).toMatchObject({
      id: expect.any(String),
      date: STORY_FIXED_ISO,
      name: expect.any(String),
      amount: expect.any(Number),
      category: { primary: expect.any(String) },
    });
  });

  it('exposes representative accounts', () => {
    expect(sampleAccounts[0]).toMatchObject({
      id: expect.any(String),
      provider: expect.stringMatching(/^(plaid|teller)$/),
      balance_ledger: expect.any(Number),
    });
  });

  it('exposes representative budgets', () => {
    expect(sampleBudgets[0]).toMatchObject({
      id: expect.any(String),
      category: expect.any(String),
      amount: expect.any(Number),
    });
  });

  it('exposes analytics donut and merchants fixtures', () => {
    expect(sampleDonutByCategory.length).toBeGreaterThan(0);
    expect(sampleDonutByCategory[0]).toMatchObject({
      name: expect.any(String),
      value: expect.any(Number),
    });
    expect(sampleTopMerchants[0]).toMatchObject({
      name: expect.any(String),
      amount: expect.any(Number),
      percentage: expect.any(Number),
    });
  });

  it('exposes budget progress rows derived from categories', () => {
    expect(sampleBudgetProgressEntries.length).toBeGreaterThan(0);
    expect(sampleBudgetProgressEntries[0]).toMatchObject({
      id: expect.any(String),
      category: expect.any(String),
      spent: expect.any(Number),
      percentage: expect.any(Number),
    });
  });

  it('exposes plaid connection view models', () => {
    expect(sampleBankConnections[0]).toMatchObject({
      id: expect.any(String),
      status: expect.stringMatching(/^(connected|needs_reauth|error)$/),
      accounts: expect.any(Array),
    });
  });

  it('exposes a transactions table page slice', () => {
    expect(transactionsTablePage.length).toBeGreaterThanOrEqual(8);
    expect(transactionsTablePage[0]).toMatchObject({
      id: expect.any(String),
      amount: expect.any(Number),
      category: { primary: expect.any(String) },
    });
  });

  it('exposes deterministic net worth series points', () => {
    expect(sampleNetWorthSeries.length).toBeGreaterThan(0);
    expect(sampleNetWorthSeries[0]).toMatchObject({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      value: expect.any(Number),
    });
  });
});
