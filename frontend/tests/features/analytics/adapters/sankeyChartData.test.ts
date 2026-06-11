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
        { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' },
        { id: 'surplus', label: 'Surplus', kind: 'Surplus' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 800 },
        { source: 'debt', target: 'expenses', value: 200 },
        { source: 'expenses', target: 'food_and_drink', value: 900 },
        { source: 'income', target: 'surplus', value: 100 },
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
          id: 'food_and_drink',
          name: 'Food & Drink',
          label: 'Food & Drink',
          kind: 'Category',
        },
        { id: 'surplus', name: 'Surplus', label: 'Surplus', kind: 'Surplus' },
      ],
      links: [
        { source: 0, target: 1, value: 800, sourceId: 'income', targetId: 'expenses' },
        { source: 2, target: 1, value: 200, sourceId: 'debt', targetId: 'expenses' },
        {
          source: 1,
          target: 3,
          value: 900,
          sourceId: 'expenses',
          targetId: 'food_and_drink',
        },
        { source: 0, target: 4, value: 100, sourceId: 'income', targetId: 'surplus' },
      ],
    });
  });

  it('calculates percent of expenses for nodes and links', () => {
    const response: SankeyResponse = {
      nodes: [
        { id: 'income', label: 'Income', kind: 'Income' },
        { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
        { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' },
        { id: 'transportation', label: 'Transport', kind: 'Category' },
        { id: 'shopping', label: 'Shopping', kind: 'Category' },
        { id: 'surplus', label: 'Surplus', kind: 'Surplus' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 1500 },
        { source: 'expenses', target: 'food_and_drink', value: 700 },
        { source: 'expenses', target: 'transportation', value: 500 },
        { source: 'expenses', target: 'shopping', value: 300 },
        { source: 'income', target: 'surplus', value: 100 },
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
        { id: 'food_and_drink', percentOfExpenses: 46.666666666666664 },
        { id: 'transportation', percentOfExpenses: 33.33333333333333 },
        { id: 'shopping', percentOfExpenses: 20 },
        { id: 'surplus', percentOfExpenses: 6.666666666666667 },
      ],
      links: [
        { sourceId: 'income', targetId: 'expenses', percentOfExpenses: 100 },
        { sourceId: 'expenses', targetId: 'food_and_drink', percentOfExpenses: 46.666666666666664 },
        { sourceId: 'expenses', targetId: 'transportation', percentOfExpenses: 33.33333333333333 },
        { sourceId: 'expenses', targetId: 'shopping', percentOfExpenses: 20 },
        { sourceId: 'income', targetId: 'surplus', percentOfExpenses: 6.666666666666667 },
      ],
    });
  });
});
