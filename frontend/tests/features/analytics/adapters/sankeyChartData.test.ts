import { describe, expect, it } from 'bun:test';
import {
  resolveSankeyLayoutMetrics,
  sankeyResponseToChartData,
} from '@/features/analytics/adapters/chartData';
import type { SankeyResponse } from '@/types/api';

describe('resolveSankeyLayoutMetrics', () => {
  it('scales chart height and node padding with category count', () => {
    const compact = resolveSankeyLayoutMetrics([
      { id: 'income', label: 'Income', kind: 'Income', name: 'Income' },
      { id: 'expenses', label: 'Expenses', kind: 'Expenses', name: 'Expenses' },
      { id: 'food', label: 'Food', kind: 'Category', name: 'Food' },
    ]);
    const expanded = resolveSankeyLayoutMetrics(
      Array.from({ length: 9 }, (_, index) => ({
        id: `category_${index}`,
        label: `Category ${index}`,
        kind: 'Category' as const,
        name: `Category ${index}`,
      }))
    );

    expect(compact.height).toBe(280);
    expect(expanded.height).toBeGreaterThan(compact.height);
    expect(expanded.height).toBeLessThanOrEqual(560);
    expect(expanded.nodePadding).toBeGreaterThanOrEqual(6);
    expect(expanded.nodePadding).toBeLessThanOrEqual(14);
  });

  it('uses the measured container height when provided', () => {
    const nodes = Array.from({ length: 4 }, (_, index) => ({
      id: `category_${index}`,
      label: `Category ${index}`,
      kind: 'Category' as const,
      name: `Category ${index}`,
    }));
    const metrics = resolveSankeyLayoutMetrics(nodes, 640);

    expect(metrics.height).toBe(640);
    expect(metrics.nodePadding).toBeGreaterThanOrEqual(6);
    expect(metrics.nodePadding).toBeLessThanOrEqual(14);
  });
});

describe('sankeyResponseToChartData', () => {
  it('maps node ids to Sankey indices while preserving node kinds and labels', () => {
    const response: SankeyResponse = {
      nodes: [
        { id: 'income', label: 'Income', kind: 'Income' },
        { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
        { id: 'debt', label: 'Debt', kind: 'Deficit' },
        { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
        { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' },
        { id: 'savings', label: 'Savings', kind: 'Savings' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 800 },
        { source: 'debt', target: 'expenses', value: 200 },
        { source: 'expenses', target: 'free_spending', value: 900 },
        { source: 'free_spending', target: 'food_and_drink', value: 900 },
        { source: 'income', target: 'savings', value: 100 },
      ],
      currency: 'USD',
      summary: {
        income: 900,
        expenses: 900,
        covered: 800,
        deficit: 100,
        surplus: 0,
        coverage_ratio: 0.89,
      },
    };

    expect(sankeyResponseToChartData(response)).toMatchObject({
      nodes: [
        { id: 'income', name: 'Income', label: 'Income', kind: 'Income' },
        { id: 'expenses', name: 'Expenses', label: 'Expenses', kind: 'Expenses' },
        { id: 'debt', name: 'Debt', label: 'Debt', kind: 'Deficit' },
        {
          id: 'free_spending',
          name: 'Free Spending',
          label: 'Free Spending',
          kind: 'FreeSpending',
        },
        {
          id: 'food_and_drink',
          name: 'Food & Drink',
          label: 'Food & Drink',
          kind: 'Category',
        },
        { id: 'savings', name: 'Savings', label: 'Savings', kind: 'Savings' },
      ],
      links: [
        { source: 0, target: 1, value: 800, sourceId: 'income', targetId: 'expenses' },
        { source: 2, target: 1, value: 200, sourceId: 'debt', targetId: 'expenses' },
        {
          source: 1,
          target: 3,
          value: 900,
          sourceId: 'expenses',
          targetId: 'free_spending',
        },
        {
          source: 3,
          target: 4,
          value: 900,
          sourceId: 'free_spending',
          targetId: 'food_and_drink',
        },
        { source: 0, target: 5, value: 100, sourceId: 'income', targetId: 'savings' },
      ],
    });
  });

  it('calculates percent of expenses for nodes and links', () => {
    const response: SankeyResponse = {
      nodes: [
        { id: 'income', label: 'Income', kind: 'Income' },
        { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
        { id: 'fixed_expenses', label: 'Fixed Expenses', kind: 'FixedExpenses' },
        { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
        { id: 'subscription', label: 'SUBSCRIPTION', kind: 'Category' },
        { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' },
        { id: 'transportation', label: 'Transport', kind: 'Category' },
        { id: 'shopping', label: 'Shopping', kind: 'Category' },
        { id: 'savings', label: 'Savings', kind: 'Savings' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 1500 },
        { source: 'expenses', target: 'fixed_expenses', value: 150 },
        { source: 'expenses', target: 'free_spending', value: 1350 },
        { source: 'fixed_expenses', target: 'subscription', value: 150 },
        { source: 'free_spending', target: 'food_and_drink', value: 700 },
        { source: 'free_spending', target: 'transportation', value: 500 },
        { source: 'free_spending', target: 'shopping', value: 150 },
        { source: 'income', target: 'savings', value: 100 },
      ],
      currency: 'USD',
      summary: {
        income: 1600,
        expenses: 1500,
        covered: 1500,
        deficit: 0,
        surplus: 100,
        coverage_ratio: 1,
      },
    };

    expect(sankeyResponseToChartData(response)).toMatchObject({
      nodes: [
        { id: 'income', percentOfExpenses: 106.66666666666667 },
        { id: 'expenses', percentOfExpenses: 100 },
        { id: 'fixed_expenses', percentOfExpenses: 10 },
        { id: 'free_spending', percentOfExpenses: 90 },
        { id: 'subscription', percentOfExpenses: 10 },
        { id: 'food_and_drink', percentOfExpenses: 46.666666666666664 },
        { id: 'transportation', percentOfExpenses: 33.33333333333333 },
        { id: 'shopping', percentOfExpenses: 10 },
        { id: 'savings', percentOfExpenses: 6.666666666666667 },
      ],
      links: [
        { sourceId: 'income', targetId: 'expenses', percentOfExpenses: 100 },
        { sourceId: 'expenses', targetId: 'fixed_expenses', percentOfExpenses: 10 },
        { sourceId: 'expenses', targetId: 'free_spending', percentOfExpenses: 90 },
        { sourceId: 'fixed_expenses', targetId: 'subscription', percentOfExpenses: 10 },
        {
          sourceId: 'free_spending',
          targetId: 'food_and_drink',
          percentOfExpenses: 46.666666666666664,
        },
        {
          sourceId: 'free_spending',
          targetId: 'transportation',
          percentOfExpenses: 33.33333333333333,
        },
        { sourceId: 'free_spending', targetId: 'shopping', percentOfExpenses: 10 },
        { sourceId: 'income', targetId: 'savings', percentOfExpenses: 6.666666666666667 },
      ],
    });
  });
});
