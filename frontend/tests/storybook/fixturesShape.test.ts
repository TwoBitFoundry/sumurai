import { sampleAccounts } from '@/storybook/fixtures/accounts';
import { sampleBudgets } from '@/storybook/fixtures/budgets';
import { STORY_FIXED_ISO } from '@/storybook/fixtures/time';
import { sampleTransactions } from '@/storybook/fixtures/transactions';

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
});
