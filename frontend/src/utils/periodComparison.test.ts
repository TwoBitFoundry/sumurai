import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Date to get consistent test results
const mockDate = new Date('2024-09-15T10:00:00Z'); // September 15, 2024
vi.setSystemTime(mockDate);

// Extract and test the period comparison logic separately
// This is the core business logic that was causing the bug
const calculatePeriodComparison = (
  dateRangeKey: string, 
  transactions: Array<{ id: string; date: string; amount: number; category: any; account_name: string; account_type: string }>
): { current: number; previous: number; change: number; changePercent: number } => {
  const now = new Date();
  const y = now.getFullYear(); // 2024
  const m = now.getMonth(); // 8 (September, 0-based)
  const fmt = (d: Date) => d.toISOString().slice(0,10);

  let currentStart: string, currentEnd: string, previousStart: string, previousEnd: string;

  switch (dateRangeKey) {
    case 'current-month': {
      // Current: September 2024, Previous: August 2024
      currentStart = fmt(new Date(y, m, 1)); // 2024-09-01
      currentEnd = fmt(new Date(y, m + 1, 0)); // 2024-09-30
      previousStart = fmt(new Date(y, m - 1, 1)); // 2024-08-01
      previousEnd = fmt(new Date(y, m, 0)); // 2024-08-31
      break;
    }
    case 'past-3-months': {
      // Current: July-Sept 2024, Previous: April-June 2024
      currentStart = fmt(new Date(y, m - 2, 1)); // 2024-07-01
      currentEnd = fmt(new Date(y, m + 1, 0)); // 2024-09-30
      previousStart = fmt(new Date(y, m - 5, 1)); // 2024-04-01
      previousEnd = fmt(new Date(y, m - 2, 0)); // 2024-06-30
      break;
    }
    case 'past-6-months': {
      // Current: April-Sept 2024, Previous: Oct 2023-March 2024
      currentStart = fmt(new Date(y, m - 5, 1)); // 2024-04-01
      currentEnd = fmt(new Date(y, m + 1, 0)); // 2024-09-30
      previousStart = fmt(new Date(y, m - 11, 1)); // 2023-10-01
      previousEnd = fmt(new Date(y, m - 5, 0)); // 2024-03-31
      break;
    }
    default: {
      return { current: 0, previous: 0, change: 0, changePercent: 0 };
    }
  }

  const filterTransactions = (start: string, end: string) => {
    return transactions.filter(txn => {
      const txnDate = new Date(txn.date).toISOString().slice(0, 10);
      return txnDate >= start && txnDate <= end;
    });
  };

  const calculateTotal = (txns: typeof transactions) => {
    return txns.reduce((total, txn) => total + Number(txn.amount), 0);
  };

  const currentTransactions = filterTransactions(currentStart, currentEnd);
  const previousTransactions = filterTransactions(previousStart, previousEnd);

  const current = calculateTotal(currentTransactions);
  const previous = calculateTotal(previousTransactions);
  const change = current - previous;
  const changePercent = previous > 0 ? (change / previous) * 100 : 0;

  return { current, previous, change, changePercent };
};

describe('Period Comparison Calculation Logic', () => {
  const mockTransactions = [
    // Current month (September 2024)
    { id: '1', date: '2024-09-15', amount: 5.00, category: { id: 'food', name: 'Food' }, account_name: 'Checking', account_type: 'checking' },
    { id: '2', date: '2024-09-20', amount: 12.50, category: { id: 'food', name: 'Food' }, account_name: 'Checking', account_type: 'checking' },
    
    // Previous month (August 2024) 
    { id: '3', date: '2024-08-15', amount: 45.75, category: { id: 'food', name: 'Food' }, account_name: 'Checking', account_type: 'checking' },
    { id: '4', date: '2024-08-22', amount: 35.00, category: { id: 'transport', name: 'Transport' }, account_name: 'Checking', account_type: 'checking' },
    
    // 3 months ago (June 2024)
    { id: '5', date: '2024-06-10', amount: 28.00, category: { id: 'food', name: 'Food' }, account_name: 'Checking', account_type: 'checking' },
    
    // 6 months ago (March 2024)
    { id: '6', date: '2024-03-05', amount: 89.50, category: { id: 'utilities', name: 'Utilities' }, account_name: 'Checking', account_type: 'checking' },
  ];

  beforeEach(() => {
    vi.setSystemTime(mockDate);
  });

  it('correctly calculates current month vs previous month comparison', () => {
    const result = calculatePeriodComparison('current-month', mockTransactions);
    
    // September total: $5.00 + $12.50 = $17.50
    expect(result.current).toBe(17.50);
    
    // August total: $45.75 + $35.00 = $80.75
    expect(result.previous).toBe(80.75);
    
    // Change: $17.50 - $80.75 = -$63.25
    expect(result.change).toBe(-63.25);
    
    // Percentage: (-63.25 / 80.75) * 100 ≈ -78.33%
    expect(Math.round(result.changePercent * 100) / 100).toBe(-78.33);
  });

  it('correctly calculates 3-month period comparison', () => {
    const result = calculatePeriodComparison('past-3-months', mockTransactions);
    
    // Current: July-Sept 2024 
    // July: $0, August: $80.75, September: $17.50 = $98.25
    expect(result.current).toBe(98.25);
    
    // Previous: April-June 2024
    // April: $0, May: $0, June: $28.00 = $28.00  
    expect(result.previous).toBe(28.00);
    
    // Change: $98.25 - $28.00 = $70.25 (more spending)
    expect(result.change).toBe(70.25);
    
    // Percentage: (70.25 / 28.00) * 100 = 250.89%
    expect(Math.round(result.changePercent * 100) / 100).toBe(250.89);
  });

  it('correctly calculates 6-month period comparison', () => {
    const result = calculatePeriodComparison('past-6-months', mockTransactions);
    
    // Current: April-Sept 2024
    // April: $0, May: $0, June: $28.00, July: $0, August: $80.75, September: $17.50 = $126.25
    expect(result.current).toBe(126.25);
    
    // Previous: Oct 2023-March 2024  
    // Only March has data: $89.50
    expect(result.previous).toBe(89.50);
    
    // Change: $126.25 - $89.50 = $36.75
    expect(result.change).toBe(36.75);
    
    // Percentage: (36.75 / 89.50) * 100 ≈ 41.06%
    expect(Math.round(result.changePercent * 100) / 100).toBe(41.06);
  });

  it('handles edge case when previous period has no spending', () => {
    const transactionsWithNoHistory = [
      { id: '1', date: '2024-09-15', amount: 100.00, category: { id: 'food', name: 'Food' }, account_name: 'Checking', account_type: 'checking' },
    ];
    
    const result = calculatePeriodComparison('current-month', transactionsWithNoHistory);
    
    expect(result.current).toBe(100.00);
    expect(result.previous).toBe(0);
    expect(result.change).toBe(100.00);
    expect(result.changePercent).toBe(0); // Avoid division by zero
  });

  it('handles edge case when both periods have identical spending', () => {
    const identicalTransactions = [
      { id: '1', date: '2024-09-15', amount: 50.00, category: { id: 'food', name: 'Food' }, account_name: 'Checking', account_type: 'checking' },
      { id: '2', date: '2024-08-15', amount: 50.00, category: { id: 'food', name: 'Food' }, account_name: 'Checking', account_type: 'checking' },
    ];
    
    const result = calculatePeriodComparison('current-month', identicalTransactions);
    
    expect(result.current).toBe(50.00);
    expect(result.previous).toBe(50.00);
    expect(result.change).toBe(0);
    expect(result.changePercent).toBe(0);
  });

  it('returns zeros for unsupported date range keys', () => {
    const result = calculatePeriodComparison('invalid-range', mockTransactions);
    
    expect(result.current).toBe(0);
    expect(result.previous).toBe(0);
    expect(result.change).toBe(0);
    expect(result.changePercent).toBe(0);
  });
});