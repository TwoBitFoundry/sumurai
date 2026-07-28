import { describe, expect, it } from 'bun:test';
import {
  resolveSankeyLayoutMetrics,
  resolveSankeyTooltipMetadata,
  type SankeyChartNode,
  sankeyResponseToChartData,
} from '@/features/analytics/adapters/chartData';
import type { SankeyResponse } from '@/types/api';
import { sankeyChartSizing } from '@/ui/recipes';

const makeSankeyNode = (
  node: Pick<SankeyChartNode, 'id' | 'label' | 'kind' | 'name'>
): SankeyChartNode => ({
  ...node,
  value: 100,
  percentOfExpenses: null,
  percentContext: null,
});

describe('resolveSankeyLayoutMetrics', () => {
  it('scales chart height and node padding with category count', () => {
    const compact = resolveSankeyLayoutMetrics([
      makeSankeyNode({ id: 'income', label: 'Income', kind: 'Income', name: 'Income' }),
      makeSankeyNode({ id: 'expenses', label: 'Expenses', kind: 'Expenses', name: 'Expenses' }),
      makeSankeyNode({ id: 'food', label: 'Food', kind: 'Category', name: 'Food' }),
    ]);
    const expanded = resolveSankeyLayoutMetrics(
      Array.from({ length: 9 }, (_, index) =>
        makeSankeyNode({
          id: `category_${index}`,
          label: `Category ${index}`,
          kind: 'Category',
          name: `Category ${index}`,
        })
      )
    );

    const defaultMinHeight = sankeyChartSizing.baseMinHeightPx * sankeyChartSizing.defaultScale;
    const defaultMaxHeight = sankeyChartSizing.baseMaxHeightPx * sankeyChartSizing.defaultScale;

    expect(compact.height).toBe(defaultMinHeight);
    expect(expanded.height).toBeGreaterThan(compact.height);
    expect(expanded.height).toBeLessThanOrEqual(defaultMaxHeight);
    expect(expanded.nodePadding).toBeGreaterThanOrEqual(6);
    expect(expanded.nodePadding).toBeLessThanOrEqual(14);
  });

  it('uses the measured container height when provided', () => {
    const nodes = Array.from({ length: 4 }, (_, index) =>
      makeSankeyNode({
        id: `category_${index}`,
        label: `Category ${index}`,
        kind: 'Category',
        name: `Category ${index}`,
      })
    );
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
        { id: 'income', percentOfExpenses: 100, percentContext: 'expenseFunding' },
        { id: 'expenses', percentOfExpenses: 93.75, percentContext: 'income' },
        { id: 'fixed_expenses', percentOfExpenses: 10, percentContext: 'expenses' },
        { id: 'free_spending', percentOfExpenses: 90, percentContext: 'expenses' },
        { id: 'subscription', percentOfExpenses: 100, percentContext: 'fixedExpenses' },
        {
          id: 'food_and_drink',
          percentOfExpenses: 51.85185185185185,
          percentContext: 'freeSpending',
        },
        {
          id: 'transportation',
          percentOfExpenses: 37.03703703703704,
          percentContext: 'freeSpending',
        },
        { id: 'shopping', percentOfExpenses: 11.11111111111111, percentContext: 'freeSpending' },
        { id: 'savings', percentOfExpenses: 6.25, percentContext: 'income' },
      ],
      links: [
        {
          sourceId: 'income',
          targetId: 'expenses',
          percentOfExpenses: 100,
          percentContext: 'expenses',
        },
        {
          sourceId: 'expenses',
          targetId: 'fixed_expenses',
          percentOfExpenses: 10,
          percentContext: 'expenses',
        },
        {
          sourceId: 'expenses',
          targetId: 'free_spending',
          percentOfExpenses: 90,
          percentContext: 'expenses',
        },
        {
          sourceId: 'fixed_expenses',
          targetId: 'subscription',
          percentOfExpenses: 100,
          percentContext: 'fixedExpenses',
        },
        {
          sourceId: 'free_spending',
          targetId: 'food_and_drink',
          percentOfExpenses: 51.85185185185185,
          percentContext: 'freeSpending',
        },
        {
          sourceId: 'free_spending',
          targetId: 'transportation',
          percentOfExpenses: 37.03703703703704,
          percentContext: 'freeSpending',
        },
        {
          sourceId: 'free_spending',
          targetId: 'shopping',
          percentOfExpenses: 11.11111111111111,
          percentContext: 'freeSpending',
        },
        {
          sourceId: 'income',
          targetId: 'savings',
          percentOfExpenses: 6.25,
          percentContext: 'income',
        },
      ],
    });
  });

  it('uses contextual percentages that sum to 100% within each split level', () => {
    const response: SankeyResponse = {
      nodes: [
        { id: 'income', label: 'Income', kind: 'Income' },
        { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
        { id: 'savings', label: 'Savings', kind: 'Savings' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 507.78 },
        { source: 'income', target: 'savings', value: 1992.22 },
      ],
      currency: 'USD',
      summary: {
        income: 2500,
        expenses: 507.78,
        covered: 507.78,
        deficit: 0,
        surplus: 1992.22,
        coverage_ratio: 1,
      },
    };

    const chartData = sankeyResponseToChartData(response);
    expect(chartData.nodes.find((node) => node.id === 'income')).toMatchObject({
      percentOfExpenses: 100,
      percentContext: 'expenseFunding',
    });
    expect(chartData.nodes.find((node) => node.id === 'savings')).toMatchObject({
      percentOfExpenses: 79.6888,
      percentContext: 'income',
    });
    expect(chartData.nodes.find((node) => node.id === 'expenses')).toMatchObject({
      percentOfExpenses: 20.3112,
      percentContext: 'income',
    });
    expect(chartData.links).toMatchObject([
      {
        sourceId: 'income',
        targetId: 'expenses',
        percentOfExpenses: 100,
        percentContext: 'expenses',
      },
      {
        sourceId: 'income',
        targetId: 'savings',
        percentOfExpenses: 79.6888,
        percentContext: 'income',
      },
    ]);
  });
});

describe('resolveSankeyTooltipMetadata', () => {
  it('looks up tooltip percentages from chart data when recharts omits custom fields', () => {
    const response: SankeyResponse = {
      nodes: [
        { id: 'income', label: 'Income', kind: 'Income' },
        { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
        { id: 'savings', label: 'Savings', kind: 'Savings' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 507.78 },
        { source: 'income', target: 'savings', value: 1992.22 },
      ],
      currency: 'USD',
      summary: {
        income: 2500,
        expenses: 507.78,
        covered: 507.78,
        deficit: 0,
        surplus: 1992.22,
        coverage_ratio: 1,
      },
    };
    const chartData = sankeyResponseToChartData(response);

    expect(resolveSankeyTooltipMetadata(chartData, { value: 2500 }, 'INCOME')).toMatchObject({
      percentOfExpenses: 100,
      percentContext: 'expenseFunding',
      kind: 'Income',
    });
    expect(resolveSankeyTooltipMetadata(chartData, { value: 1992.22 }, 'SAVINGS')).toMatchObject({
      percentOfExpenses: 79.6888,
      percentContext: 'income',
      kind: 'Savings',
    });
    expect(resolveSankeyTooltipMetadata(chartData, { value: 507.78 }, 'EXPENSES')).toMatchObject({
      percentOfExpenses: 20.3112,
      percentContext: 'income',
      kind: 'Expenses',
    });
    expect(
      resolveSankeyTooltipMetadata(chartData, {
        source: 0,
        target: 2,
        value: 1992.22,
      })
    ).toMatchObject({
      percentOfExpenses: 79.6888,
      percentContext: 'income',
      kind: 'Savings',
    });
  });
});
