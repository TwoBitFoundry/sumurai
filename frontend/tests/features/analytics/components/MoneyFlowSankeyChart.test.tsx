import { mock, spyOn } from 'bun:test';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { getThemeColors } from '@/ui/tokens';
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

  if (nodeKind === 'Surplus') {
    return sumLinks((link) => String(link.targetId ?? '') === nodeId);
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
        { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' },
        { id: 'surplus', label: 'Surplus', kind: 'Surplus' },
      ],
      links: [
        { source: 'income', target: 'expenses', value: 800 },
        { source: 'expenses', target: 'food_and_drink', value: 800 },
        { source: 'income', target: 'surplus', value: 200 },
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
    expect(screen.getByText('125%')).toBeVisible();
    expect(screen.getByText('25%')).toBeVisible();
    expect(screen.getAllByText('100%')).toHaveLength(2);
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
    expect(categoryPercentLabel).toHaveAttribute('transform', 'rotate(270 266 104)');
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
      '#8b5cf6'
    );
    expect(screen.getByTestId('sankey-node-food_and_drink').querySelector('rect')).toHaveAttribute(
      'fill',
      '#38bdf8'
    );
    expect(screen.getByTestId('sankey-node-surplus').querySelector('rect')).toHaveAttribute(
      'fill',
      '#06b6d4'
    );
    expect(screen.getByTestId('sankey-link-1')).toHaveAttribute('stroke', '#38bdf8');
    expect(mockSankey).toHaveBeenCalled();
  });

  it('hides the percent label when the node is too short', () => {
    mockNodeHeight = 16;

    render(
      <MoneyFlowSankeyChart
        data={{
          nodes: [
            { id: 'income', label: 'Income', kind: 'Income' },
            { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
            { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' },
          ],
          links: [
            { source: 'income', target: 'expenses', value: 500 },
            { source: 'expenses', target: 'food_and_drink', value: 500 },
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

    expect(screen.queryByText('100%')).toBeNull();
  });

  it('uses dark theme tokens for node and link colors', async () => {
    const darkColors = getThemeColors('dark');
    const accentIndexByName = buildCategoryAccentIndex(['food_and_drink']);
    const categoryColor = getTagThemeForCategory('food_and_drink', accentIndexByName).ringHex;
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
            { id: 'food_and_drink', label: 'Food & Drink', kind: 'Category' },
          ],
          links: [
            { source: 'income', target: 'expenses', value: 500 },
            { source: 'expenses', target: 'food_and_drink', value: 500 },
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
      darkColors.semantic.netWorth
    );
    expect(screen.getByTestId('sankey-node-food_and_drink').querySelector('rect')).toHaveAttribute(
      'fill',
      categoryColor
    );
    expect(screen.getByTestId('sankey-link-1')).toHaveAttribute('stroke', categoryColor);
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
            },
          } as never,
        ]}
      />
    );

    expect(screen.getByText('Income')).toBeVisible();
    expect(screen.getByText('$500.00')).toBeVisible();
    expect(screen.getByText('100% of expenses')).toBeVisible();
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

  it('derives the tooltip percent from the expense total when the payload omits it', () => {
    render(
      <SankeyTooltipContent
        active
        label="TRAVEL"
        expenseTotal={1500}
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
    expect(screen.getByText('46.7% of expenses')).toBeVisible();
  });

  it('formats category labels from the category key instead of the prefixed node id', () => {
    render(
      <MoneyFlowSankeyChart
        data={{
          nodes: [
            { id: 'income', label: 'Income', kind: 'Income' },
            { id: 'expenses', label: 'Expenses', kind: 'Expenses' },
            { id: 'category_travel', label: 'TRAVEL', kind: 'Category' },
          ],
          links: [
            { source: 'income', target: 'expenses', value: 1222.51 },
            { source: 'expenses', target: 'category_travel', value: 1222.51 },
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
