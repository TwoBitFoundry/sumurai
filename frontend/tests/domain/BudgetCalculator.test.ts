import { BudgetCalculator } from '../../src/domain/BudgetCalculator';
import type { Transaction } from '../../src/types/api';

interface ComputedBudget {
  id: string;
  category: string;
  amount: number;
  spent: number;
}

const mockToday = new Date('2025-10-15');

describe('BudgetCalculator.computeStats', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockToday);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('with empty budgets', () => {
    it('returns zero values for all stats', () => {
      const stats = BudgetCalculator.computeStats([], mockToday);

      expect(stats.totalBudgeted).toBe(0);
      expect(stats.totalSpent).toBe(0);
      expect(stats.remaining).toBe(0);
      expect(stats.variance).toBe(0);
      expect(stats.overBudgetCount).toBe(0);
      expect(stats.overBudgetCategories).toEqual([]);
      expect(stats.activeBudgetCategories).toEqual([]);
      expect(stats.nearLimitCategories).toEqual([]);
    });
  });

  describe('with single budget', () => {
    it('calculates totals correctly when under budget', () => {
      const budgets: ComputedBudget[] = [{ id: '1', category: 'Food', amount: 500, spent: 300 }];

      const stats = BudgetCalculator.computeStats(budgets, mockToday);

      expect(stats.totalBudgeted).toBe(500);
      expect(stats.totalSpent).toBe(300);
      expect(stats.remaining).toBe(200);
      expect(stats.variance).toBe(200);
      expect(stats.overBudgetCount).toBe(0);
      expect(stats.overBudgetCategories).toEqual([]);
    });

    it('detects when over budget', () => {
      const budgets: ComputedBudget[] = [{ id: '1', category: 'Food', amount: 300, spent: 500 }];

      const stats = BudgetCalculator.computeStats(budgets, mockToday);

      expect(stats.overBudgetCount).toBe(1);
      expect(stats.overBudgetCategories).toEqual(['Food']);
      expect(stats.variance).toBe(-200);
    });

    it('includes category in activeBudgetCategories', () => {
      const budgets: ComputedBudget[] = [{ id: '1', category: 'Food', amount: 500, spent: 300 }];

      const stats = BudgetCalculator.computeStats(budgets, mockToday);

      expect(stats.activeBudgetCategories).toEqual(['Food']);
    });

    it('identifies categories near limit (80-100%)', () => {
      const budgets: ComputedBudget[] = [{ id: '1', category: 'Food', amount: 100, spent: 90 }];

      const stats = BudgetCalculator.computeStats(budgets, mockToday);

      expect(stats.nearLimitCategories).toEqual(['Food']);
    });

    it('excludes categories below 80% utilization from nearLimitCategories', () => {
      const budgets: ComputedBudget[] = [{ id: '1', category: 'Food', amount: 100, spent: 70 }];

      const stats = BudgetCalculator.computeStats(budgets, mockToday);

      expect(stats.nearLimitCategories).toEqual([]);
    });

    it('excludes over-budget categories from nearLimitCategories', () => {
      const budgets: ComputedBudget[] = [{ id: '1', category: 'Food', amount: 100, spent: 120 }];

      const stats = BudgetCalculator.computeStats(budgets, mockToday);

      expect(stats.nearLimitCategories).toEqual([]);
    });
  });

  describe('with multiple budgets', () => {
    let budgets: ComputedBudget[];

    beforeEach(() => {
      budgets = [
        { id: '1', category: 'Food', amount: 500, spent: 300 },
        { id: '2', category: 'Transport', amount: 200, spent: 250 },
        { id: '3', category: 'Entertainment', amount: 150, spent: 120 },
      ];
    });

    it('sums all budgets and spending', () => {
      const stats = BudgetCalculator.computeStats(budgets, mockToday);

      expect(stats.totalBudgeted).toBe(850);
      expect(stats.totalSpent).toBe(670);
      expect(stats.remaining).toBe(180);
      expect(stats.variance).toBe(180);
    });

    it('counts all over-budget categories', () => {
      const stats = BudgetCalculator.computeStats(budgets, mockToday);

      expect(stats.overBudgetCount).toBe(1);
      expect(stats.overBudgetCategories).toContain('Transport');
    });

    it('lists all active categories', () => {
      const stats = BudgetCalculator.computeStats(budgets, mockToday);

      expect(stats.activeBudgetCategories).toEqual(['Food', 'Transport', 'Entertainment']);
    });

    it('limits nearLimitCategories to 3 items', () => {
      const manyBudgets: ComputedBudget[] = [
        { id: '1', category: 'Cat1', amount: 100, spent: 85 },
        { id: '2', category: 'Cat2', amount: 100, spent: 85 },
        { id: '3', category: 'Cat3', amount: 100, spent: 85 },
        { id: '4', category: 'Cat4', amount: 100, spent: 85 },
      ];

      const stats = BudgetCalculator.computeStats(manyBudgets, new Date('2025-10-15'));

      expect(stats.nearLimitCategories).toHaveLength(3);
    });
  });

  describe('days remaining and total days calculation', () => {
    it('returns correct total days in month regardless of date', () => {
      const october = new Date('2025-10-15');
      const stats = BudgetCalculator.computeStats([], october);
      expect(stats.totalDays).toBe(31);

      const november = new Date('2025-11-15');
      const statsNov = BudgetCalculator.computeStats([], november);
      expect(statsNov.totalDays).toBe(30);

      const february = new Date('2025-02-28');
      const statsFeb = BudgetCalculator.computeStats([], february);
      expect(statsFeb.totalDays).toBe(28);
    });
  });

  describe('remaining calculation', () => {
    it('returns positive remaining when under budget', () => {
      const budgets: ComputedBudget[] = [{ id: '1', category: 'Food', amount: 500, spent: 300 }];

      const stats = BudgetCalculator.computeStats(budgets, mockToday);

      expect(stats.remaining).toBe(200);
    });

    it('returns zero remaining when over budget', () => {
      const budgets: ComputedBudget[] = [{ id: '1', category: 'Food', amount: 300, spent: 500 }];

      const stats = BudgetCalculator.computeStats(budgets, mockToday);

      expect(stats.remaining).toBe(0);
    });
  });
});

describe('BudgetCalculator.calculateSpent', () => {
  const baseTransaction: Transaction = {
    id: 'txn-1',
    date: '2025-10-10',
    name: 'Store',
    amount: 50,
    category: { primary: 'Food' },
    account_name: 'Checking',
    account_type: 'depository',
  };

  it('excludes credit card bill payments from budget spending', () => {
    const transactions: Transaction[] = [
      baseTransaction,
      {
        ...baseTransaction,
        id: 'txn-2',
        amount: 500,
        category: { primary: 'Credit Card Bills' },
      },
    ];

    expect(
      BudgetCalculator.calculateSpent(transactions, 'Credit Card Bills', '2025-10-01', '2025-10-31')
    ).toBe(0);
  });

  it('nets credit-card returns against purchases for budget spending', () => {
    const transactions: Transaction[] = [
      {
        ...baseTransaction,
        id: 'teller-purchase',
        amount: -100,
        category: { primary: 'Home Improvement' },
        account_type: 'credit',
        provider: 'teller',
      },
      {
        ...baseTransaction,
        id: 'teller-return',
        amount: 20,
        category: { primary: 'Home Improvement' },
        account_type: 'credit',
        provider: 'teller',
      },
      {
        ...baseTransaction,
        id: 'plaid-purchase',
        amount: 50,
        category: { primary: 'Home Improvement' },
        account_type: 'credit',
        provider: 'plaid',
      },
      {
        ...baseTransaction,
        id: 'plaid-return',
        amount: -10,
        category: { primary: 'Home Improvement' },
        account_type: 'credit',
        provider: 'plaid',
      },
    ];

    expect(
      BudgetCalculator.calculateSpent(transactions, 'Home Improvement', '2025-10-01', '2025-10-31')
    ).toBe(120);
  });
});

describe('BudgetCalculator.computeRolloverBudget', () => {
  it('correctly calculates semi-annual rollover budget with carryover and YTD spending', () => {
    const budget: Budget = {
      id: 'b-ins',
      category: 'Insurance',
      amount: 100,
      frequency: 'semi_annual',
      rollover: true,
    };

    // User is in March 2026 (month index 2). Spent $0 in Jan and Feb.
    const allYtdTransactions: Transaction[] = [
      {
        id: 't-1',
        date: '2026-03-15',
        name: 'Car Insurance Payment',
        amount: 250,
        category: { primary: 'Insurance', detailed: 'Car Insurance' },
        account_name: 'Checking',
        account_type: 'depository',
      },
    ];

    const result = BudgetCalculator.computeRolloverBudget(
      budget,
      allYtdTransactions,
      { month: 2, year: 2026 } // March (index 2)
    );

    expect(result.monthlyAmount).toBe(100);
    expect(result.periodAmount).toBe(600);
    expect(result.periodMultiplier).toBe(6);
    expect(result.frequency).toBe('semi_annual');
    expect(result.rollover).toBe(true);

    // Prior months (Jan, Feb) = 2 months. 2 * $100 = $200 allocated, $0 spent => $200 carryover
    expect(result.priorCarryover).toBe(200);
    // Available this month = $100 + $200 = $300
    expect(result.availableThisMonth).toBe(300);
    // Month spent in March = $250
    expect(result.monthSpent).toBe(250);
    // Remaining = $300 - $250 = $50
    expect(result.remainingThisMonth).toBe(50);
    expect(result.isOverBudget).toBe(false);
    // YTD spent = $250
    expect(result.ytdSpent).toBe(250);
  });

  it('correctly calculates quarterly rollover budget for Water subcategory', () => {
    const budget: Budget = {
      id: 'b-water',
      category: 'Water',
      amount: 50,
      frequency: 'quarterly',
      rollover: true,
    };

    const allYtdTransactions: Transaction[] = [
      {
        id: 't-water-jan',
        date: '2026-01-20',
        name: 'County Water',
        amount: 30,
        category: { primary: 'Bills & Utilities', detailed: 'Water' },
        account_name: 'Checking',
        account_type: 'depository',
      },
      {
        id: 't-other-feb',
        date: '2026-02-10',
        name: 'Electric Co',
        amount: 100,
        category: { primary: 'Bills & Utilities', detailed: 'Utilities' },
        account_name: 'Checking',
        account_type: 'depository',
      },
      {
        id: 't-water-mar',
        date: '2026-03-25',
        name: 'County Water',
        amount: 80,
        category: { primary: 'Bills & Utilities', detailed: 'Water' },
        account_name: 'Checking',
        account_type: 'depository',
      },
    ];

    const result = BudgetCalculator.computeRolloverBudget(
      budget,
      allYtdTransactions,
      { month: 2, year: 2026 }, // March
      'Water'
    );

    expect(result.monthlyAmount).toBe(50);
    expect(result.periodAmount).toBe(150);
    // Jan allocated = $50, Jan spent on water = $30. Feb allocated = $50, Feb spent on water = $0.
    // Prior allocated = $100. Prior spent = $30. Prior carryover = $70.
    expect(result.priorCarryover).toBe(70);
    // Available this month = $50 + $70 = $120
    expect(result.availableThisMonth).toBe(120);
    // Month spent in March = $80
    expect(result.monthSpent).toBe(80);
    // Remaining = $120 - $80 = $40
    expect(result.remainingThisMonth).toBe(40);
    expect(result.isOverBudget).toBe(false);
    // YTD spent on Water = $30 + $80 = $110
    expect(result.ytdSpent).toBe(110);
  });

  it('correctly calculates rollover starting from a specific start month (Option #2)', () => {
    const budget: Budget = {
      id: 'b-bills',
      category: 'Bills & Utilities',
      amount: 450,
      frequency: 'monthly',
      rollover: true,
      rollover_start_month: '2026-09',
    };

    const allYtdTransactions: Transaction[] = [
      {
        id: 't-aug',
        date: '2026-08-15',
        name: 'Electric Bill',
        amount: 408.69,
        category: { primary: 'Bills & Utilities', detailed: 'Utilities' },
        account_name: 'Checking',
        account_type: 'depository',
      },
      {
        id: 't-sep',
        date: '2026-09-10',
        name: 'Electric & Internet',
        amount: 705.97,
        category: { primary: 'Bills & Utilities', detailed: 'Utilities' },
        account_name: 'Checking',
        account_type: 'depository',
      },
    ];

    // Case 1: In September 2026 (the start month, month index 8)
    const sepResult = BudgetCalculator.computeRolloverBudget(budget, allYtdTransactions, {
      month: 8,
      year: 2026,
    });

    // Carryover should be $0.00 since September is the start month (no accumulation before start month)
    expect(sepResult.priorCarryover).toBe(0);
    expect(sepResult.availableThisMonth).toBe(450);
    expect(sepResult.monthSpent).toBe(705.97);
    expect(sepResult.remainingThisMonth).toBeCloseTo(450 - 705.97);
    expect(sepResult.isOverBudget).toBe(true);
    // YTD spent still reflects full calendar year spending (Aug + Sep)
    expect(sepResult.ytdSpent).toBeCloseTo(408.69 + 705.97);

    // Case 2: In October 2026 (month index 9)
    // In Sep, allocated $450, spent $705.97 -> net negative, so carryover is 0
    const octResult = BudgetCalculator.computeRolloverBudget(budget, allYtdTransactions, {
      month: 9,
      year: 2026,
    });
    expect(octResult.priorCarryover).toBe(0);

    // Case 3: If in September spend was under budget (e.g., $300 spent instead of $705.97)
    const underSpendTransactions: Transaction[] = [
      {
        id: 't-aug',
        date: '2026-08-15',
        name: 'Electric Bill',
        amount: 408.69,
        category: { primary: 'Bills & Utilities', detailed: 'Utilities' },
        account_name: 'Checking',
        account_type: 'depository',
      },
      {
        id: 't-sep',
        date: '2026-09-10',
        name: 'Electric',
        amount: 300,
        category: { primary: 'Bills & Utilities', detailed: 'Utilities' },
        account_name: 'Checking',
        account_type: 'depository',
      },
    ];

    const octUnderResult = BudgetCalculator.computeRolloverBudget(budget, underSpendTransactions, {
      month: 9,
      year: 2026,
    });
    // Prior month (September only, NOT August): 1 month * $450 = $450 allocated, $300 spent => +$150 carryover
    expect(octUnderResult.priorMonthsSpent).toBe(300);
    expect(octUnderResult.priorMonthsAllocated).toBe(450);
    expect(octUnderResult.priorCarryover).toBe(150);
    expect(octUnderResult.availableThisMonth).toBe(600); // 450 + 150
  });
});

describe('BudgetCalculator.computeCompositeMajorBudget', () => {
  it('correctly sums major category budget and subcategory budgets', () => {
    const directBudget: Budget = {
      id: 'b-bills',
      category: 'Bills & Utilities',
      amount: 400,
      frequency: 'monthly',
      rollover: false,
    };

    const subcategoryBudgets = [
      {
        subcategory: 'Water',
        budget: {
          id: 'b-water',
          category: 'Water',
          amount: 50,
          frequency: 'monthly' as const,
          rollover: true,
          rollover_start_month: '2026-09',
        },
      },
    ];

    const allYtdTransactions: Transaction[] = [
      {
        id: 't-water',
        date: '2026-09-05',
        name: 'County Water',
        amount: 35,
        category: { primary: 'Bills & Utilities', detailed: 'Water' },
        account_name: 'Checking',
        account_type: 'depository',
      },
      {
        id: 't-power',
        date: '2026-09-12',
        name: 'Electric Co',
        amount: 200,
        category: { primary: 'Bills & Utilities', detailed: 'Utilities' },
        account_name: 'Checking',
        account_type: 'depository',
      },
    ];

    const composite = BudgetCalculator.computeCompositeMajorBudget(
      'Bills & Utilities',
      directBudget,
      subcategoryBudgets,
      allYtdTransactions,
      { month: 8, year: 2026 } // September
    );

    // Monthly target: $400 (Bills & Utilities) + $50 (Water) = $450
    expect(composite.monthlyAmount).toBe(450);
    // Available: $400 + $50 = $450
    expect(composite.availableThisMonth).toBe(450);
    // Month spent across all of Bills & Utilities: $35 + $200 = $235
    expect(composite.monthSpent).toBe(235);
    // Remaining: $450 - $235 = $215
    expect(composite.remainingThisMonth).toBe(215);
    expect(composite.isOverBudget).toBe(false);
    expect(composite.subcategoryResults).toHaveLength(1);
    expect(composite.subcategoryResults[0].subcategory).toBe('Water');
    expect(composite.subcategoryResults[0].result.monthSpent).toBe(35);
    expect(composite.subcategoryResults[0].result.remainingThisMonth).toBe(15);
  });

  it('correctly calculates full year budget when month is null', () => {
    const budget: Budget = {
      id: 'b-monthly',
      category: 'Groceries',
      amount: 400,
      frequency: 'monthly',
      rollover: false,
    };

    const transactions: Transaction[] = [
      {
        id: 't-1',
        date: '2026-03-15',
        name: 'Supermarket',
        amount: 300,
        category: { primary: 'Groceries' },
        account_name: 'Checking',
        account_type: 'depository',
      },
      {
        id: 't-2',
        date: '2026-08-20',
        name: 'Whole Foods',
        amount: 250,
        category: { primary: 'Groceries' },
        account_name: 'Checking',
        account_type: 'depository',
      },
    ];

    const result = BudgetCalculator.computeRolloverBudget(budget, transactions, {
      month: null,
      year: 2026,
    });

    // Full year target is 12 * $400 = $4,800
    expect(result.periodAmount).toBe(4800);
    expect(result.monthSpent).toBe(550);
    expect(result.remainingThisMonth).toBe(4250);
    expect(result.isOverBudget).toBe(false);
  });
});
