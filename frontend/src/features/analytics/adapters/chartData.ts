/**
 * Transforms analytics API results into chart-ready series.
 */

import type {
  AnalyticsTopMerchantsResponse,
  SankeyLink,
  SankeyNode,
  SankeyResponse,
} from '../../../types/api';
import { formatCategoryName, getTagThemeForCategory } from '../../../utils/categories';

export type DonutDatum = {
  name: string;
  categoryKey: string;
  value: number;
  color?: string;
};

type CategoryDatum = {
  category?: string | null;
  name?: string | null;
  amount?: number | string | null;
  value?: number | string | null;
};

export function categoriesToDonut(
  categories: CategoryDatum[] = [],
  accentIndexByName?: ReadonlyMap<string, number>
): DonutDatum[] {
  const mapped = categories.map((c) => {
    const rawName: string = (c.category ?? c.name ?? 'Unknown') || 'Unknown';
    const displayName = formatCategoryName(rawName);
    const rawAmount: number | string | null | undefined = c.amount ?? c.value ?? 0;
    const value = typeof rawAmount === 'string' ? Number(rawAmount) : Number(rawAmount || 0);
    const theme = getTagThemeForCategory(rawName, accentIndexByName);
    return {
      name: displayName,
      categoryKey: rawName,
      value: Number.isFinite(value) ? value : 0,
      color: theme.ringHex,
    };
  });

  const positive = mapped.filter((d) => d.value > 0);
  positive.sort((a, b) => b.value - a.value);
  return positive;
}

export type MerchantItem = AnalyticsTopMerchantsResponse;

export function normalizeMerchants(items: AnalyticsTopMerchantsResponse[]): MerchantItem[] {
  return (items || []).slice().sort((a, b) => Number(b.amount) - Number(a.amount));
}

export type SankeyChartNode = SankeyNode & {
  name: string;
  percentOfExpenses: number | null;
};

export type SankeyChartLink = {
  source: number;
  target: number;
  sourceId: string;
  targetId: string;
  value: number;
  percentOfExpenses: number | null;
};

export type SankeyChartData = {
  nodes: SankeyChartNode[];
  links: SankeyChartLink[];
};

export type SankeyLayoutMetrics = {
  height: number;
  nodePadding: number;
};

const SANKEY_MIN_HEIGHT = 280;
const SANKEY_MAX_HEIGHT = 560;
const SANKEY_ROW_HEIGHT = 38;
const SANKEY_HEIGHT_PADDING = 56;
const SANKEY_MIN_NODE_PADDING = 6;
const SANKEY_MAX_NODE_PADDING = 14;

export function resolveSankeyLayoutMetrics(
  nodes: SankeyChartNode[],
  availableHeight?: number
): SankeyLayoutMetrics {
  const categoryCount = nodes.filter((node) => node.kind === 'Category').length;
  const hasSurplus = nodes.some((node) => node.kind === 'Surplus');
  const leftCount = nodes.filter(
    (node) => node.kind === 'Income' || node.kind === 'Deficit'
  ).length;
  const rightCount = categoryCount + (hasSurplus ? 1 : 0);
  const columnNodes = Math.max(leftCount, rightCount, 2);
  const naturalHeight = Math.max(
    SANKEY_MIN_HEIGHT,
    columnNodes * SANKEY_ROW_HEIGHT + SANKEY_HEIGHT_PADDING
  );
  const height =
    availableHeight != null && availableHeight > 0
      ? Math.max(SANKEY_MIN_HEIGHT, Math.floor(availableHeight))
      : Math.min(SANKEY_MAX_HEIGHT, naturalHeight);
  const innerHeight = height - 24;
  const nodePadding =
    columnNodes <= 1
      ? 10
      : Math.max(
          SANKEY_MIN_NODE_PADDING,
          Math.min(
            SANKEY_MAX_NODE_PADDING,
            Math.floor((innerHeight - columnNodes * 12) / (columnNodes - 1))
          )
        );

  return { height, nodePadding };
}

const toNumericLinkValue = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const resolveNodeValue = (node: SankeyNode, response: SankeyResponse) => {
  switch (node.kind) {
    case 'Income':
      return toNumericLinkValue(response.summary.income);
    case 'Expenses':
      return toNumericLinkValue(response.summary.expenses);
    case 'Deficit':
      return toNumericLinkValue(response.summary.deficit);
    case 'Surplus':
      return toNumericLinkValue(response.summary.surplus);
    case 'Category':
      return (response.links ?? [])
        .filter((link) => link.target === node.id)
        .reduce((sum, link) => sum + toNumericLinkValue(link.value), 0);
    default:
      return 0;
  }
};

export function sankeyResponseToChartData(response?: SankeyResponse | null): SankeyChartData {
  const expenses = toNumericLinkValue(response?.summary?.expenses);
  const sourceResponse = response ?? null;
  const nodes = (response?.nodes ?? []).map((node) => ({
    ...node,
    name: node.label || formatCategoryName(node.id),
    percentOfExpenses:
      expenses > 0 && sourceResponse
        ? (resolveNodeValue(node, sourceResponse) / expenses) * 100
        : null,
  }));
  const indexById = new Map(nodes.map((node, index) => [node.id, index] as const));
  const links = (response?.links ?? [])
    .map((link) => {
      const source = indexById.get(link.source);
      const target = indexById.get(link.target);
      if (source == null || target == null) {
        return null;
      }
      const value = toNumericLinkValue(link.value);
      return {
        source,
        target,
        sourceId: link.source,
        targetId: link.target,
        value,
        percentOfExpenses: expenses > 0 ? (value / expenses) * 100 : null,
      };
    })
    .filter((link): link is SankeyChartLink => link != null);

  return {
    nodes,
    links,
  };
}
