import { groupMinorSubcategories, SankeyCalculator } from '../../src/domain/SankeyCalculator';
import type { Transaction } from '../../src/types/api';

describe('SankeyCalculator', () => {
  const createMockTransaction = (overrides: Partial<Transaction>): Transaction => ({
    id: 'tx-1',
    date: '2026-09-15',
    name: 'Sample Transaction',
    amount: 100,
    account_type: 'depository',
    category: {
      primary: 'Bills & Utilities',
      detailed: 'Utilities',
    },
    ...overrides,
  });

  describe('Empty or invalid transactions', () => {
    it('returns empty result when given no transactions', () => {
      const result = SankeyCalculator.computeSankeyData([]);
      expect(result.hasData).toBe(false);
      expect(result.nodes).toEqual([]);
      expect(result.links).toEqual([]);
      expect(result.stats.totalInflow).toBe(0);
      expect(result.stats.totalOutflow).toBe(0);
    });

    it('ignores pending transactions', () => {
      const txs = [
        createMockTransaction({
          pending: true,
          amount: 500,
          category: { primary: 'Food & Dining' },
        }),
      ];
      const result = SankeyCalculator.computeSankeyData(txs);
      expect(result.hasData).toBe(false);
    });

    it('ignores credit card payments and internal transfers', () => {
      const txs = [
        createMockTransaction({
          amount: 1000,
          category: { primary: 'Transfer', detailed: 'Credit Card Payment' },
        }),
      ];
      const result = SankeyCalculator.computeSankeyData(txs);
      expect(result.hasData).toBe(false);
    });
  });

  describe('Full Cash Flow (Income > Expenses)', () => {
    const transactions: Transaction[] = [
      // Income: Paycheck $4,000 and Bonus $500
      createMockTransaction({
        id: 'inc-1',
        amount: -4000,
        account_type: 'depository',
        category: { primary: 'Earned Income', detailed: 'Paycheck' },
      }),
      createMockTransaction({
        id: 'inc-2',
        amount: -500,
        account_type: 'depository',
        category: { primary: 'Earned Income', detailed: 'Bonus' },
      }),
      // Expenses: Bills & Utilities ($300 total: $200 Utilities, $100 Internet)
      createMockTransaction({
        id: 'exp-1',
        amount: 200,
        account_type: 'credit card',
        category: { primary: 'Bills & Utilities', detailed: 'Utilities' },
      }),
      createMockTransaction({
        id: 'exp-2',
        amount: 100,
        account_type: 'credit card',
        category: { primary: 'Bills & Utilities', detailed: 'Internet' },
      }),
      // Groceries $700
      createMockTransaction({
        id: 'exp-3',
        amount: 700,
        account_type: 'depository',
        category: { primary: 'Groceries', detailed: 'Groceries' },
      }),
    ];

    it('calculates totals, net savings, and savings rate correctly', () => {
      const result = SankeyCalculator.computeSankeyData(transactions);
      expect(result.hasData).toBe(true);
      expect(result.hasIncome).toBe(true);
      expect(result.stats.totalInflow).toBe(4500);
      expect(result.stats.totalOutflow).toBe(1000);
      expect(result.stats.netSavings).toBe(3500);
      expect(result.stats.savingsRate).toBe(77.8);
      expect(result.stats.topExpenseCategory).toEqual({
        name: 'Groceries',
        amount: 700,
        percentage: 70,
      });
    });

    it('builds valid nodes and links connecting Income -> Total -> Categories -> Subcategories & Savings', () => {
      const result = SankeyCalculator.computeSankeyData(transactions, {
        includeSubcategories: true,
      });

      const nodeNames = result.nodes.map((n) => n.name);
      expect(nodeNames).toContain('Paycheck');
      expect(nodeNames).toContain('Bonus');
      expect(nodeNames).toContain('Total Income');
      expect(nodeNames).toContain('Bills & Utilities');
      expect(nodeNames).toContain('Groceries');
      expect(nodeNames).toContain('Utilities');
      expect(nodeNames).toContain('Internet');
      expect(nodeNames).toContain('Net Savings');

      // Verify all links reference valid indices within [0, nodes.length - 1]
      for (const link of result.links) {
        expect(link.source).toBeGreaterThanOrEqual(0);
        expect(link.source).toBeLessThan(result.nodes.length);
        expect(link.target).toBeGreaterThanOrEqual(0);
        expect(link.target).toBeLessThan(result.nodes.length);
        expect(link.value).toBeGreaterThan(0);
      }

      // Check Total Income link connections
      const totalIncomeIdx = result.nodes.findIndex((n) => n.name === 'Total Income');
      expect(totalIncomeIdx).toBeGreaterThanOrEqual(0);

      // Links coming into Total Income must be from Paycheck and Bonus
      const incomingToTotal = result.links.filter((l) => l.target === totalIncomeIdx);
      const incomingSum = incomingToTotal.reduce((sum, l) => sum + l.value, 0);
      expect(incomingSum).toBe(4500);

      // Links going out from Total Income must sum to total inflow (1000 spending + 3500 savings)
      const outgoingFromTotal = result.links.filter((l) => l.source === totalIncomeIdx);
      const outgoingSum = outgoingFromTotal.reduce((sum, l) => sum + l.value, 0);
      expect(outgoingSum).toBe(4500);
    });

    it('omits subcategories when includeSubcategories is false', () => {
      const result = SankeyCalculator.computeSankeyData(transactions, {
        includeSubcategories: false,
      });

      const nodeNames = result.nodes.map((n) => n.name);
      expect(nodeNames).toContain('Bills & Utilities');
      expect(nodeNames).not.toContain('Utilities');
      expect(nodeNames).not.toContain('Internet');
    });

    it('shows top category name instead of General when subcategory is not specified or generic', () => {
      const txs: Transaction[] = [
        createMockTransaction({
          id: 'inc-1',
          amount: -1000,
          account_type: 'depository',
          category: { primary: 'Earned Income', detailed: 'Paycheck' },
        }),
        // Shopping with no subcategory
        createMockTransaction({
          id: 'exp-1',
          amount: 200,
          account_type: 'credit card',
          category: { primary: 'Shopping', detailed: 'Other' },
        }),
        // Groceries with identical subcategory
        createMockTransaction({
          id: 'exp-2',
          amount: 150,
          account_type: 'credit card',
          category: { primary: 'Groceries', detailed: 'Groceries' },
        }),
      ];

      const result = SankeyCalculator.computeSankeyData(txs, { includeSubcategories: true });
      const nodeNames = result.nodes.map((n) => n.name);

      expect(nodeNames).not.toContain('General');
      // Subcategory nodes should use top category name
      const subNodes = result.nodes.filter((n) => n.categoryType === 'subcategory');
      const subNames = subNodes.map((n) => n.name);
      expect(subNames).toContain('Shopping');
      expect(subNames).toContain('Groceries');
      expect(subNames).not.toContain('General');
    });
  });

  describe('Deficit Cash Flow (Expenses > Income)', () => {
    const transactions: Transaction[] = [
      // Income: $1,000
      createMockTransaction({
        id: 'inc-1',
        amount: -1000,
        account_type: 'depository',
        category: { primary: 'Earned Income', detailed: 'Paycheck' },
      }),
      // Expense: $1,500
      createMockTransaction({
        id: 'exp-1',
        amount: 1500,
        account_type: 'credit card',
        category: { primary: 'Home Management', detailed: 'Mortgage' },
      }),
    ];

    it('adds From Savings node into Total Hub to balance the deficit', () => {
      const result = SankeyCalculator.computeSankeyData(transactions);
      expect(result.stats.totalInflow).toBe(1000);
      expect(result.stats.totalOutflow).toBe(1500);
      expect(result.stats.netSavings).toBe(-500);

      const nodeNames = result.nodes.map((n) => n.name);
      expect(nodeNames).toContain('From Savings');
      expect(nodeNames).not.toContain('Net Savings');

      const totalIncomeIdx = result.nodes.findIndex((n) => n.name === 'Total Income');
      const incomingToTotal = result.links.filter((l) => l.target === totalIncomeIdx);
      const incomingSum = incomingToTotal.reduce((sum, l) => sum + l.value, 0);
      // Inflow ($1,000) + From Savings ($500) = $1,500
      expect(incomingSum).toBe(1500);
    });
  });

  describe('Spending Only Flow (No Income recorded)', () => {
    const transactions: Transaction[] = [
      createMockTransaction({
        id: 'exp-1',
        amount: 250,
        category: { primary: 'Food & Dining', detailed: 'Restaurants' },
      }),
    ];

    it('creates Total Spending hub instead of Total Income', () => {
      const result = SankeyCalculator.computeSankeyData(transactions);
      expect(result.hasIncome).toBe(false);
      expect(result.stats.totalInflow).toBe(0);
      expect(result.stats.totalOutflow).toBe(250);

      const nodeNames = result.nodes.map((n) => n.name);
      expect(nodeNames).toContain('Total Spending');
      expect(nodeNames).toContain('Food & Dining');
      expect(nodeNames).not.toContain('Total Income');
      expect(nodeNames).not.toContain('Net Savings');
    });
  });

  describe('groupMinorSubcategories', () => {
    it('leaves <= 3 subcategories untouched', () => {
      const subs: Array<[string, number]> = [
        ['Doctor', 50],
        ['Pharmacy', 11],
      ];
      expect(groupMinorSubcategories(subs, 61)).toEqual(subs);
    });

    it('clubs minor subcategories (<$30 and <5%) into Other when >= 2 minor items exist', () => {
      const subs: Array<[string, number]> = [
        ['Water', 350],
        ['Utilities', 250],
        ['Internet', 50],
        ['Phone', 25],
        ['AI', 20],
        ['Misc', 10],
      ];
      const result = groupMinorSubcategories(subs, 705);
      expect(result).toEqual([
        ['Water', 350],
        ['Utilities', 250],
        ['Other', 55],
        ['Internet', 50],
      ]);
    });
  });
});
