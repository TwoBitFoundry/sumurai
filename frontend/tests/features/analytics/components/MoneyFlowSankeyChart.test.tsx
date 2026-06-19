import { mock, spyOn } from 'bun:test';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { getCategoryLabelHex, getThemeColors } from '@/ui/tokens';
import { buildCategoryAccentIndex, getTagThemeForCategory } from '@/utils/categories';

let mockNodeHeight = 20;

const resolveMockNodeValue = (
  payload: Record<string, unknown>,
  links: Array<Record<string, unknown>>
) => {
  const nodeId = String(payload.id ?? '');
  const nodeKind = String(payload.kind ?? '');
  const sumLinks = (match: (link: Record<string, unknown>) => boolean) =>
    links.reduce((sum, link) => (match(link) ? sum + Number(link.value ?? 0) : sum), 0);

  if (nodeKind === 'Income' || nodeKind === 'Expenses' || nodeKind === 'Deficit') {
    return sumLinks((link) => String(link.sourceId ?? '') === nodeId);
  }

  if (nodeKind === 'Savings') {
    return sumLinks((link) => String(link.targetId ?? '') === nodeId);
  }

  if (nodeKind === 'FixedExpenses' || nodeKind === 'FreeSpending') {
    return sumLinks((link) => String(link.sourceId ?? '') === nodeId);
  }

  return sumLinks((link) => String(link.targetId ?? '') === nodeId);
};

const mockSankey = mock(
  ({
    data,
    node,
    link,
  }: {
    data: { nodes: Array<Record<string, unknown>>; links: Array<Record<string, unknown>> };
    node?: (props: Record<string, unknown>) => React.ReactNode;
    link?: (props: Record<string, unknown>) => React.ReactNode;
  }) => {
    const renderedNodes = data.nodes.map((payload, index) =>
      typeof node === 'function'
        ? React.cloneElement(
            node({
              x: index < 2 ? 0 : 240,
              y: 20 + index * 32,
              width: 16,
              height: mockNodeHeight,
              value: resolveMockNodeValue(payload, data.links),
              payload,
              index,
            }) as React.ReactElement,
            { key: String(payload.id) }
          )
        : null
    );
    const renderedLinks = data.links.map((payload, index) =>
      typeof link === 'function'
        ? React.cloneElement(
            link({
              sourceX: 24,
              sourceY: 24 + index * 16,
              sourceControlX: 120,
              targetX: 216,
              targetY: 24 + index * 16,
              targetControlX: 160,
              sourceRelativeY: 0,
              targetRelativeY: 0,
              linkWidth: Number(payload.value ?? 0),
              index,
              payload: {
                ...payload,
                source: data.nodes[payload.source as number],
                target: data.nodes[payload.target as number],
              },
            }) as React.ReactElement,
            { key: `${String(payload.sourceId)}-${String(payload.targetId)}` }
          )
        : null
    );

    return React.createElement(
      'svg',
      { 'data-testid': 'Sankey' },
      ...renderedNodes,
      ...renderedLinks
    );
  }
);

mock.module('recharts', () => ({
  Sankey: mockSankey,
  Tooltip: ({ children }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('div', { 'data-testid': 'Tooltip' }, children),
}));

const mockUseTheme = mock(() => ({
  preference: 'light' as const,
  mode: 'light' as const,
  setPreference: mock(() => {}),
  setMode: mock(() => {}),
  toggle: mock(() => {}),
  colors: getThemeColors('light'),
}));

mock.module('@/context/ThemeContext', () => ({
  useTheme: mockUseTheme,
}));

import { sankeyResponseToChartData } from '@/features/analytics/adapters/chartData';
import {
  MoneyFlowSankeyChart,
  SankeyTooltipContent,
} from '@/features/analytics/components/MoneyFlowSankeyChart';
import type { SankeyResponse } from '@/types/api';

describe('MoneyFlowSankeyChart', () => {
  let rectSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockNodeHeight = 20;
    rectSpy = spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 480,
      height: 320,
      top: 0,
      left: 0,
      bottom: 320,
      right: 480,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    mockUseTheme.mockReturnValue({
      preference: 'light',
      mode: 'light',
      setPreference: mock(() => {}),
      setMode: mock(() => {}),
      toggle: mock(() => {}),
      colors: getThemeColors('light'),
    });
    mockSankey.mockClear();
  });

  afterEach(() => {
    rectSpy.mockRestore();
  });

  it('renders token-colored nodes', async () => {
    mockNodeHeight = 40;

    const response: SankeyResponse = {
      nodes: [
        { id: 'income', label: 'Income', kind: 'Income' },
        { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
        { id: 'savings', label: 'Savings', kind: 'Savings' },
        { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
        { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 800 },
        { source: 'income', target: 'savings', value: 200 },
        { source: 'expenses', target: 'free_spending', value: 800 },
        { source: 'free_spending', target: 'food_and_drink', value: 800 },
      ],
      currency: 'USD',
      summary: {
        income: 1000,
        expenses: 800,
        covered: 800,
        deficit: 0,
        surplus: 200,
        coverage_ratio: 1,
      },
    };

    render(
      <MoneyFlowSankeyChart
        data={response}
        accentIndexByName={buildCategoryAccentIndex(['food_and_drink'])}
      />
    );

    expect(await screen.findByTestId('sankey-node-income')).toBeVisible();
    expect(screen.getByText('20%')).toBeVisible();
    expect(screen.getByText('80%')).toBeVisible();
    expect(screen.getAllByText('100%')).toHaveLength(3);
    const savingsNode = screen.getByTestId('sankey-node-savings');
    const savingsRect = savingsNode.querySelector('rect');
    const savingsLabel = savingsNode.querySelector('text:first-of-type');
    const savingsAmount = savingsNode.querySelector('text:nth-of-type(2)');
    const savingsPercent = savingsNode.querySelector('text:last-of-type');
    expect(savingsLabel).toHaveTextContent('Savings');
    expect(savingsLabel).toHaveClass('font-label');
    expect(savingsAmount).toHaveClass('font-card-title');
    expect(Number(savingsLabel?.getAttribute('y'))).toBeGreaterThan(
      Number(savingsRect?.getAttribute('y')) + Number(savingsRect?.getAttribute('height'))
    );
    expect(savingsPercent).toHaveAttribute('transform', 'rotate(270 230 104)');
    expect(Number(savingsPercent?.getAttribute('x'))).toBeLessThan(
      Number(savingsNode.querySelector('rect')?.getAttribute('x'))
    );
    const incomeNode = screen.getByTestId('sankey-node-income');
    const percentLabel = incomeNode.querySelector('text:last-of-type');
    expect(percentLabel).toHaveAttribute('transform', 'rotate(270 -10 40)');
    expect(Number(percentLabel?.getAttribute('x'))).toBeLessThan(
      Number(incomeNode.querySelector('rect')?.getAttribute('x'))
    );
    const categoryNode = screen.getByTestId('sankey-node-food_and_drink');
    expect(categoryNode.querySelector('text:first-of-type')).toHaveClass('font-label');
    expect(categoryNode.querySelector('text:nth-of-type(2)')).toHaveClass('font-card-title');
    const categoryPercentLabel = categoryNode.querySelector('text:last-of-type');
    expect(categoryPercentLabel).toHaveAttribute('transform', 'rotate(270 266 168)');
    expect(Number(categoryPercentLabel?.getAttribute('x'))).toBeGreaterThan(
      Number(categoryNode.querySelector('rect')?.getAttribute('x')) +
        Number(categoryNode.querySelector('rect')?.getAttribute('width'))
    );
    expect(screen.getByTestId('sankey-node-income').querySelector('rect')).toHaveAttribute(
      'fill',
      '#10b981'
    );
    expect(screen.getByTestId('sankey-node-expenses').querySelector('rect')).toHaveAttribute(
      'fill',
      getThemeColors('light').semantic.credit
    );
    expect(
      screen.getByTestId('sankey-node-free_spending').querySelector('text:first-of-type')
    ).toHaveTextContent('Free Spending');
    expect(screen.getByTestId('sankey-node-food_and_drink').querySelector('rect')).toHaveAttribute(
      'fill',
      '#38bdf8'
    );
    expect(screen.getByTestId('sankey-node-savings').querySelector('rect')).toHaveAttribute(
      'fill',
      '#06b6d4'
    );
    expect(screen.getByTestId('sankey-link-3')).toHaveAttribute('stroke', '#38bdf8');
    expect(mockSankey).toHaveBeenCalled();
  });

  it('hides the percent label when the node is too short', () => {
    mockNodeHeight = 12;

    render(
      <MoneyFlowSankeyChart
        data={{
          nodes: [
            { id: 'income', label: 'Income', kind: 'Income' },
            { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
            { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
            { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' },
          ],
          links: [
            { source: 'income', target: 'expenses', value: 500 },
            { source: 'expenses', target: 'free_spending', value: 500 },
            { source: 'free_spending', target: 'food_and_drink', value: 500 },
          ],
          currency: 'USD',
          summary: {
            income: 500,
            expenses: 500,
            covered: 500,
            deficit: 0,
            surplus: 0,
            coverage_ratio: 1,
          },
        }}
      />
    );

    expect(screen.getAllByText('100%')).toHaveLength(3);
  });

  it('keeps labels visible for small hub nodes', () => {
    mockNodeHeight = 12;

    render(
      <MoneyFlowSankeyChart
        data={{
          nodes: [
            { id: 'income', label: 'Income', kind: 'Income' },
            { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
            { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
            { id: 'fixed_expenses', label: 'Fixed Expenses', kind: 'FixedExpenses' },
            { id: 'category_travel', label: 'TRAVEL', kind: 'Category' },
            { id: 'category_bills', label: 'BILLS', kind: 'Category' },
          ],
          links: [
            { source: 'income', target: 'expenses', value: 500 },
            { source: 'expenses', target: 'free_spending', value: 300 },
            { source: 'expenses', target: 'fixed_expenses', value: 200 },
            { source: 'free_spending', target: 'category_travel', value: 300 },
            { source: 'fixed_expenses', target: 'category_bills', value: 200 },
          ],
          currency: 'USD',
          summary: {
            income: 500,
            expenses: 500,
            covered: 500,
            deficit: 0,
            surplus: 0,
            coverage_ratio: 1,
          },
        }}
      />
    );

    expect(screen.getByTestId('sankey-node-free_spending')).toHaveTextContent('Free Spending');
    expect(screen.getByTestId('sankey-node-fixed_expenses')).toHaveTextContent('Fixed Expenses');
  });

  it('keeps the debt label visible when the debt node is small', () => {
    mockNodeHeight = 12;

    render(
      <MoneyFlowSankeyChart
        data={{
          nodes: [
            { id: 'income', label: 'Income', kind: 'Income' },
            { id: 'debt', label: 'Debt', kind: 'Deficit' },
            { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
            { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
            { id: 'category_travel', label: 'TRAVEL', kind: 'Category' },
          ],
          links: [
            { source: 'income', target: 'expenses', value: 400 },
            { source: 'debt', target: 'expenses', value: 100 },
            { source: 'expenses', target: 'free_spending', value: 500 },
            { source: 'free_spending', target: 'category_travel', value: 500 },
          ],
          currency: 'USD',
          summary: {
            income: 400,
            expenses: 500,
            covered: 400,
            deficit: 100,
            surplus: 0,
            coverage_ratio: 0.8,
          },
        }}
      />
    );

    expect(screen.getByTestId('sankey-node-debt')).toHaveTextContent('Debt');
    expect(screen.getByTestId('sankey-node-debt')).toHaveTextContent('$100.00');
    expect(screen.getByText('20%')).toBeVisible();
  });

  it('places the larger funding source above and the smaller below', async () => {
    mockNodeHeight = 40;

    render(
      <MoneyFlowSankeyChart
        data={{
          nodes: [
            { id: 'income', label: 'Income', kind: 'Income' },
            { id: 'debt', label: 'Debt', kind: 'Deficit' },
            { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
            { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
            { id: 'category_travel', label: 'TRAVEL', kind: 'Category' },
          ],
          links: [
            { source: 'income', target: 'expenses', value: 400 },
            { source: 'debt', target: 'expenses', value: 100 },
            { source: 'expenses', target: 'free_spending', value: 500 },
            { source: 'free_spending', target: 'category_travel', value: 500 },
          ],
          currency: 'USD',
          summary: {
            income: 400,
            expenses: 500,
            covered: 400,
            deficit: 100,
            surplus: 0,
            coverage_ratio: 0.8,
          },
        }}
      />
    );

    expect(await screen.findByTestId('sankey-node-income')).toBeVisible();

    const incomeNode = screen.getByTestId('sankey-node-income');
    const debtNode = screen.getByTestId('sankey-node-debt');

    expect(Number(incomeNode.querySelector('text:first-of-type')?.getAttribute('y'))).toBeLessThan(
      Number(incomeNode.querySelector('rect')?.getAttribute('y'))
    );
    expect(Number(debtNode.querySelector('text:first-of-type')?.getAttribute('y'))).toBeGreaterThan(
      Number(debtNode.querySelector('rect')?.getAttribute('y')) +
        Number(debtNode.querySelector('rect')?.getAttribute('height'))
    );
  });

  it('places a lone expenses hub above the node', async () => {
    mockNodeHeight = 40;

    render(
      <MoneyFlowSankeyChart
        data={{
          nodes: [
            { id: 'income', label: 'Income', kind: 'Income' },
            { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
            { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
            { id: 'fixed_expenses', label: 'Fixed Expenses', kind: 'FixedExpenses' },
            { id: 'category_travel', label: 'TRAVEL', kind: 'Category' },
            { id: 'category_bills', label: 'BILLS', kind: 'Category' },
          ],
          links: [
            { source: 'income', target: 'expenses', value: 2624.29 },
            { source: 'expenses', target: 'free_spending', value: 1970.08 },
            { source: 'expenses', target: 'fixed_expenses', value: 766.15 },
            { source: 'free_spending', target: 'category_travel', value: 1970.08 },
            { source: 'fixed_expenses', target: 'category_bills', value: 766.15 },
          ],
          currency: 'USD',
          summary: {
            income: 2624.29,
            expenses: 2736.23,
            covered: 2624.29,
            deficit: 111.94,
            surplus: 0,
            coverage_ratio: 0.959090169905967,
          },
        }}
      />
    );

    expect(await screen.findByTestId('sankey-node-expenses')).toBeVisible();

    const expensesNode = screen.getByTestId('sankey-node-expenses');
    expect(
      Number(expensesNode.querySelector('text:first-of-type')?.getAttribute('y'))
    ).toBeLessThan(Number(expensesNode.querySelector('rect')?.getAttribute('y')));
  });

  it('shows savings label and amount when the savings node is short', () => {
    mockNodeHeight = 8;

    render(
      <MoneyFlowSankeyChart
        data={{
          nodes: [
            { id: 'income', label: 'Income', kind: 'Income' },
            { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
            { id: 'savings', label: 'Savings', kind: 'Savings' },
            { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
            { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' },
          ],
          links: [
            { source: 'income', target: 'expenses', value: 950 },
            { source: 'income', target: 'savings', value: 50 },
            { source: 'expenses', target: 'free_spending', value: 950 },
            { source: 'free_spending', target: 'food_and_drink', value: 950 },
          ],
          currency: 'USD',
          summary: {
            income: 1000,
            expenses: 950,
            covered: 950,
            deficit: 0,
            surplus: 50,
            coverage_ratio: 1,
          },
        }}
      />
    );

    const savingsNode = screen.getByTestId('sankey-node-savings');
    expect(savingsNode.querySelector('text:first-of-type')).toHaveTextContent('Savings');
    expect(savingsNode.querySelector('text:nth-of-type(2)')).toHaveTextContent('$50.00');
    expect(screen.queryByText('5.3%')).toBeNull();
  });

  it('places the larger hub label above and the smaller below', async () => {
    mockNodeHeight = 40;

    render(
      <MoneyFlowSankeyChart
        data={{
          nodes: [
            { id: 'savings', label: 'Savings', kind: 'Savings' },
            { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
            { id: 'income', label: 'Income', kind: 'Income' },
            { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
            { id: 'fixed_expenses', label: 'Fixed Expenses', kind: 'FixedExpenses' },
            { id: 'category_travel', label: 'TRAVEL', kind: 'Category' },
            { id: 'category_bills', label: 'BILLS', kind: 'Category' },
          ],
          links: [
            { source: 'income', target: 'expenses', value: 800 },
            { source: 'income', target: 'savings', value: 200 },
            { source: 'expenses', target: 'free_spending', value: 500 },
            { source: 'expenses', target: 'fixed_expenses', value: 300 },
            { source: 'free_spending', target: 'category_travel', value: 500 },
            { source: 'fixed_expenses', target: 'category_bills', value: 300 },
          ],
          currency: 'USD',
          summary: {
            income: 1000,
            expenses: 800,
            covered: 800,
            deficit: 0,
            surplus: 200,
            coverage_ratio: 1,
          },
        }}
      />
    );

    expect(await screen.findByTestId('sankey-node-savings')).toBeVisible();

    const savingsNode = screen.getByTestId('sankey-node-savings');
    const expensesNode = screen.getByTestId('sankey-node-expenses');
    const freeSpendingNode = screen.getByTestId('sankey-node-free_spending');
    const fixedExpensesNode = screen.getByTestId('sankey-node-fixed_expenses');

    expect(
      Number(savingsNode.querySelector('text:first-of-type')?.getAttribute('y'))
    ).toBeGreaterThan(
      Number(savingsNode.querySelector('rect')?.getAttribute('y')) +
        Number(savingsNode.querySelector('rect')?.getAttribute('height'))
    );
    expect(
      Number(expensesNode.querySelector('text:first-of-type')?.getAttribute('y'))
    ).toBeLessThan(Number(expensesNode.querySelector('rect')?.getAttribute('y')));
    expect(
      Number(freeSpendingNode.querySelector('text:first-of-type')?.getAttribute('y'))
    ).toBeLessThan(Number(freeSpendingNode.querySelector('rect')?.getAttribute('y')));
    expect(
      Number(fixedExpensesNode.querySelector('text:first-of-type')?.getAttribute('y'))
    ).toBeGreaterThan(
      Number(fixedExpensesNode.querySelector('rect')?.getAttribute('y')) +
        Number(fixedExpensesNode.querySelector('rect')?.getAttribute('height'))
    );
  });

  it('uses dark theme tokens for node and link colors', async () => {
    const darkColors = getThemeColors('dark');
    const accentIndexByName = buildCategoryAccentIndex(['food_and_drink']);
    const categoryTheme = getTagThemeForCategory('food_and_drink', accentIndexByName);
    const categoryColor = categoryTheme.ringHex;
    const categoryLabelColor = getCategoryLabelHex(categoryTheme, 'dark');
    mockUseTheme.mockReturnValue({
      preference: 'dark',
      mode: 'dark',
      setPreference: mock(() => {}),
      setMode: mock(() => {}),
      toggle: mock(() => {}),
      colors: darkColors,
    });

    render(
      <MoneyFlowSankeyChart
        data={{
          nodes: [
            { id: 'income', label: 'Income', kind: 'Income' },
            { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
            { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
            { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' },
          ],
          links: [
            { source: 'income', target: 'expenses', value: 500 },
            { source: 'expenses', target: 'free_spending', value: 500 },
            { source: 'free_spending', target: 'food_and_drink', value: 500 },
          ],
          currency: 'USD',
          summary: {
            income: 500,
            expenses: 500,
            covered: 500,
            deficit: 0,
            surplus: 0,
            coverage_ratio: 1,
          },
        }}
        accentIndexByName={accentIndexByName}
      />
    );

    expect(screen.getByTestId('sankey-node-income').querySelector('rect')).toHaveAttribute(
      'fill',
      darkColors.semantic.cash
    );
    expect(screen.getByTestId('sankey-node-expenses').querySelector('rect')).toHaveAttribute(
      'fill',
      darkColors.semantic.credit
    );
    expect(screen.getByTestId('sankey-node-free_spending').querySelector('rect')).toHaveAttribute(
      'fill',
      darkColors.semantic.loan
    );
    expect(screen.getByTestId('sankey-node-food_and_drink').querySelector('rect')).toHaveAttribute(
      'fill',
      categoryColor
    );
    expect(screen.getByTestId('sankey-node-food_and_drink').querySelector('text')).toHaveAttribute(
      'fill',
      categoryLabelColor
    );
    expect(screen.getByTestId('sankey-link-1')).toHaveAttribute('stroke', darkColors.semantic.loan);
    expect(screen.getByTestId('sankey-link-2')).toHaveAttribute('stroke', categoryColor);
  });

  it('shows the category name without the free spending section prefix in the tooltip', () => {
    render(
      <SankeyTooltipContent
        active
        label="FREE SPENDING - GENERAL MERCHANDISE"
        payload={[
          {
            name: 'FREE SPENDING - GENERAL MERCHANDISE',
            value: 700,
            payload: {
              source: {
                id: 'free_spending',
                label: 'Free Spending',
                name: 'Free Spending',
                kind: 'FreeSpending',
              },
              target: {
                id: 'category_general_merchandise',
                label: 'GENERAL_MERCHANDISE',
                name: 'GENERAL MERCHANDISE',
                kind: 'Category',
              },
              value: 700,
              percentOfExpenses: 46.7,
              percentContext: 'freeSpending',
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Merchandise')).toBeVisible();
    expect(screen.getByText('46.7% of free spending')).toBeVisible();
  });

  it('falls back to the tooltip label when the payload is not a resolved node', () => {
    render(
      <SankeyTooltipContent
        active
        label="FREE SPENDING - GENERAL MERCHANDISE"
        payload={[
          {
            name: 'FREE SPENDING - GENERAL MERCHANDISE',
            value: 700,
            payload: {
              source: 3,
              target: 5,
              value: 700,
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Merchandise')).toBeVisible();
  });

  it('shows the percentage line in the tooltip', () => {
    render(
      <SankeyTooltipContent
        active
        label="EXPENSES - TRAVEL"
        payload={[
          {
            name: 'EXPENSES - TRAVEL',
            value: 700,
            payload: {
              id: 'category_travel',
              label: 'EXPENSES - TRAVEL',
              name: 'EXPENSES - TRAVEL',
              kind: 'Category',
              percentOfExpenses: 46.7,
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Travel')).toBeVisible();
    expect(screen.getByText('$700.00')).toBeVisible();
    expect(screen.getByText('46.7% of expenses')).toBeVisible();
    expect(screen.getByText('Travel')).toHaveClass('font-label');
    expect(screen.getByText('$700.00')).toHaveClass('font-card-title');
    expect(screen.getByText('46.7% of expenses')).toHaveClass('font-caption');
  });

  it('shows savings tooltip percent as a share of income', () => {
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

    render(
      <SankeyTooltipContent
        active
        label="SAVINGS"
        chartData={sankeyResponseToChartData(response)}
        summary={{
          income: 2500,
          expenses: 507.78,
          covered: 507.78,
          deficit: 0,
          surplus: 1992.22,
          fixedExpenses: 0,
          freeSpending: 0,
        }}
        payload={[
          {
            name: 'SAVINGS',
            value: 1992.22,
            payload: {
              value: 1992.22,
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Savings')).toBeVisible();
    expect(screen.getByText('$1,992.22')).toBeVisible();
    expect(screen.getByText('79.7% of income')).toBeVisible();
  });

  it('shows income tooltip percent from chart data without custom payload fields', () => {
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

    render(
      <SankeyTooltipContent
        active
        label="INCOME"
        chartData={sankeyResponseToChartData(response)}
        summary={{
          income: 2500,
          expenses: 507.78,
          covered: 507.78,
          deficit: 0,
          surplus: 1992.22,
          fixedExpenses: 0,
          freeSpending: 0,
        }}
        payload={[
          {
            name: 'INCOME',
            value: 2500,
            payload: {
              value: 2500,
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Income')).toBeVisible();
    expect(screen.getByText('$2,500.00')).toBeVisible();
    expect(screen.getByText('100% of expenses')).toBeVisible();
  });

  it('shows free spending tooltip percent as a share of expenses when the payload is underspecified', () => {
    const response: SankeyResponse = {
      nodes: [
        { id: 'income', label: 'Income', kind: 'Income' },
        { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
        { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
        { id: 'category_travel', label: 'TRAVEL', kind: 'Category' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 2624.29 },
        { source: 'expenses', target: 'free_spending', value: 1970.08 },
        { source: 'free_spending', target: 'category_travel', value: 1970.08 },
      ],
      currency: 'USD',
      summary: {
        income: 2624.29,
        expenses: 2736.23,
        covered: 2624.29,
        deficit: 111.94,
        surplus: 0,
        coverage_ratio: 0.959090169905967,
      },
    };

    render(
      <SankeyTooltipContent
        active
        label="FREE SPENDING"
        chartData={sankeyResponseToChartData(response)}
        summary={{
          income: 2624.29,
          expenses: 2736.23,
          covered: 2624.29,
          deficit: 111.94,
          surplus: 0,
          fixedExpenses: 0,
          freeSpending: 1970.08,
        }}
        payload={[
          {
            name: 'FREE SPENDING',
            value: 1970.08,
            payload: {
              label: 'FREE SPENDING',
              name: 'FREE SPENDING',
              value: 1970.08,
              kind: 'Expenses',
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Free Spending')).toBeVisible();
    expect(screen.getByText('$1,970.08')).toBeVisible();
    expect(screen.getByText('72% of expenses')).toBeVisible();
  });

  it('shows fixed expenses tooltip percent as a share of expenses when the payload is underspecified', () => {
    const response: SankeyResponse = {
      nodes: [
        { id: 'income', label: 'Income', kind: 'Income' },
        { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
        { id: 'fixed_expenses', label: 'Fixed Expenses', kind: 'FixedExpenses' },
        { id: 'category_bills', label: 'BILLS', kind: 'Category' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 2624.29 },
        { source: 'expenses', target: 'fixed_expenses', value: 766.15 },
        { source: 'fixed_expenses', target: 'category_bills', value: 766.15 },
      ],
      currency: 'USD',
      summary: {
        income: 2624.29,
        expenses: 2736.23,
        covered: 2624.29,
        deficit: 111.94,
        surplus: 0,
        coverage_ratio: 0.959090169905967,
      },
    };

    render(
      <SankeyTooltipContent
        active
        label="FIXED EXPENSES"
        chartData={sankeyResponseToChartData(response)}
        summary={{
          income: 2624.29,
          expenses: 2736.23,
          covered: 2624.29,
          deficit: 111.94,
          surplus: 0,
          fixedExpenses: 766.15,
          freeSpending: 0,
        }}
        payload={[
          {
            name: 'FIXED EXPENSES',
            value: 766.15,
            payload: {
              label: 'FIXED EXPENSES',
              name: 'FIXED EXPENSES',
              value: 766.15,
              kind: 'Expenses',
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Fixed Expenses')).toBeVisible();
    expect(screen.getByText('$766.15')).toBeVisible();
    expect(screen.getByText('28% of expenses')).toBeVisible();
  });

  it('does not show the expenses hub label for income tooltips', () => {
    render(
      <SankeyTooltipContent
        active
        label="INCOME - EXPENSES"
        payload={[
          {
            name: 'INCOME - EXPENSES',
            value: 500,
            payload: {
              source: {
                id: 'income',
                label: 'INCOME - EXPENSES',
                name: 'INCOME - EXPENSES',
                kind: 'Income',
              },
              target: {
                id: 'expenses',
                label: 'Expenses',
                name: 'Expenses',
                kind: 'Expenses',
              },
              sourceId: 'income',
              targetId: 'expenses',
              value: 500,
              percentOfExpenses: 100,
              percentContext: 'income',
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Income')).toBeVisible();
    expect(screen.getByText('$500.00')).toBeVisible();
    expect(screen.getByText('100% of income')).toBeVisible();
  });

  it('does not show the expenses hub label for debt tooltips', () => {
    render(
      <SankeyTooltipContent
        active
        label="DEBT - EXPENSES"
        payload={[
          {
            name: 'DEBT - EXPENSES',
            value: 250,
            payload: {
              source: {
                id: 'debt',
                label: 'DEBT - EXPENSES',
                name: 'DEBT - EXPENSES',
                kind: 'Deficit',
              },
              target: {
                id: 'expenses',
                label: 'Expenses',
                name: 'Expenses',
                kind: 'Expenses',
              },
              sourceId: 'debt',
              targetId: 'expenses',
              value: 250,
              percentOfExpenses: 25,
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Debt')).toBeVisible();
    expect(screen.getByText('$250.00')).toBeVisible();
    expect(screen.getByText('25% of expenses')).toBeVisible();
  });

  it('derives the tooltip percent from chart data when the payload omits it', () => {
    const response: SankeyResponse = {
      nodes: [
        { id: 'income', label: 'Income', kind: 'Income' },
        { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
        { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
        { id: 'category_travel', label: 'TRAVEL', kind: 'Category' },
        { id: 'category_food_and_drink', label: 'FOOD_AND_DRINK', kind: 'Category' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 1500 },
        { source: 'expenses', target: 'free_spending', value: 1500 },
        { source: 'free_spending', target: 'category_travel', value: 700 },
        { source: 'free_spending', target: 'category_food_and_drink', value: 800 },
      ],
      currency: 'USD',
      summary: {
        income: 2500,
        expenses: 1500,
        covered: 1500,
        deficit: 0,
        surplus: 1000,
        coverage_ratio: 1,
      },
    };
    const chartData = sankeyResponseToChartData(response);

    render(
      <SankeyTooltipContent
        active
        label="TRAVEL"
        chartData={chartData}
        summary={{
          income: 2500,
          expenses: 1500,
          covered: 1500,
          deficit: 0,
          surplus: 1000,
          fixedExpenses: 0,
          freeSpending: 1500,
        }}
        payload={[
          {
            name: 'TRAVEL',
            value: 700,
            payload: {
              id: 'category_travel',
              label: 'TRAVEL',
              name: 'TRAVEL',
              kind: 'Category',
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Travel')).toBeVisible();
    expect(screen.getByText('$700.00')).toBeVisible();
    expect(screen.getByText('46.7% of free spending')).toBeVisible();
  });

  it('derives fixed expense category tooltip percent from fixed expenses when metadata is missing', () => {
    const response: SankeyResponse = {
      nodes: [
        { id: 'income', label: 'Income', kind: 'Income' },
        { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
        { id: 'fixed_expenses', label: 'Fixed Expenses', kind: 'FixedExpenses' },
        { id: 'category_bills', label: 'BILLS', kind: 'Category' },
        { id: 'category_services', label: 'SERVICES', kind: 'Category' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 1500 },
        { source: 'expenses', target: 'fixed_expenses', value: 800 },
        { source: 'fixed_expenses', target: 'category_bills', value: 600 },
        { source: 'fixed_expenses', target: 'category_services', value: 200 },
      ],
      currency: 'USD',
      summary: {
        income: 1500,
        expenses: 1500,
        covered: 1500,
        deficit: 0,
        surplus: 0,
        coverage_ratio: 1,
      },
    };

    render(
      <SankeyTooltipContent
        active
        label="BILLS"
        chartData={sankeyResponseToChartData(response)}
        summary={{
          income: 1500,
          expenses: 1500,
          covered: 1500,
          deficit: 0,
          surplus: 0,
          fixedExpenses: 800,
          freeSpending: 0,
        }}
        payload={[
          {
            name: 'BILLS',
            value: 600,
            payload: {
              label: 'BILLS',
              name: 'BILLS',
              kind: 'Expenses',
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Bills')).toBeVisible();
    expect(screen.getByText('$600.00')).toBeVisible();
    expect(screen.getByText('75% of fixed expenses')).toBeVisible();
  });

  it('prefers the category label over an ambiguous parent id in tooltip payloads', () => {
    const response: SankeyResponse = {
      nodes: [
        { id: 'income', label: 'Income', kind: 'Income' },
        { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
        { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
        { id: 'fixed_expenses', label: 'Fixed Expenses', kind: 'FixedExpenses' },
        { id: 'category_merchandise', label: 'MERCHANDISE', kind: 'Category' },
        { id: 'category_travel', label: 'TRAVEL', kind: 'Category' },
        { id: 'category_bills', label: 'BILLS', kind: 'Category' },
        { id: 'category_services', label: 'SERVICES', kind: 'Category' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 2624.29 },
        { source: 'expenses', target: 'free_spending', value: 1970.08 },
        { source: 'expenses', target: 'fixed_expenses', value: 766.15 },
        { source: 'free_spending', target: 'category_merchandise', value: 501.18 },
        { source: 'free_spending', target: 'category_travel', value: 1468.9 },
        { source: 'fixed_expenses', target: 'category_bills', value: 547.42 },
        { source: 'fixed_expenses', target: 'category_services', value: 218.73 },
      ],
      currency: 'USD',
      summary: {
        income: 2624.29,
        expenses: 2736.23,
        covered: 2624.29,
        deficit: 111.94,
        surplus: 0,
        coverage_ratio: 0.959090169905967,
      },
    };

    const chartData = sankeyResponseToChartData(response);

    render(
      <SankeyTooltipContent
        active
        label="MERCHANDISE"
        chartData={chartData}
        summary={{
          income: 2624.29,
          expenses: 2736.23,
          covered: 2624.29,
          deficit: 111.94,
          surplus: 0,
          fixedExpenses: 766.15,
          freeSpending: 1970.08,
        }}
        payload={[
          {
            name: 'MERCHANDISE',
            value: 501.18,
            payload: {
              id: 'free_spending',
              label: 'MERCHANDISE',
              name: 'MERCHANDISE',
              kind: 'Expenses',
              value: 501.18,
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Merchandise')).toBeVisible();
    expect(screen.getByText('$501.18')).toBeVisible();
    expect(screen.getByText('25.4% of free spending')).toBeVisible();
  });

  it('formats category labels from the category key instead of the prefixed node id', () => {
    render(
      <MoneyFlowSankeyChart
        data={{
          nodes: [
            { id: 'income', label: 'Income', kind: 'Income' },
            { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
            { id: 'free_spending', label: 'Free Spending', kind: 'FreeSpending' },
            { id: 'category_travel', label: 'TRAVEL', kind: 'Category' },
          ],
          links: [
            { source: 'income', target: 'expenses', value: 1222.51 },
            { source: 'expenses', target: 'free_spending', value: 1222.51 },
            { source: 'free_spending', target: 'category_travel', value: 1222.51 },
          ],
          currency: 'USD',
          summary: {
            income: 1222.51,
            expenses: 1222.51,
            covered: 1222.51,
            deficit: 0,
            surplus: 0,
            coverage_ratio: 1,
          },
        }}
      />
    );

    expect(screen.getByText('Travel')).toBeVisible();
    expect(screen.getByTestId('sankey-node-category_travel').querySelector('text')).toHaveClass(
      'font-label'
    );
    expect(screen.queryByText(/Category Travel/i)).toBeNull();
  });

  it('renders an empty state when the response has no category nodes', () => {
    render(
      <MoneyFlowSankeyChart
        data={{
          nodes: [
            { id: 'income', label: 'Income', kind: 'Income' },
            { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
          ],
          links: [{ source: 'income', target: 'expenses', value: 300 }],
          currency: 'USD',
          summary: {
            income: 300,
            expenses: 300,
            covered: 300,
            deficit: 0,
            surplus: 0,
            coverage_ratio: 1,
          },
        }}
      />
    );

    expect(screen.getByText('No money flow yet')).toBeVisible();
    expect(screen.getByText('No category spending was found for this range.')).toBeVisible();
  });
});
