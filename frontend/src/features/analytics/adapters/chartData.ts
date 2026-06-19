/**
 * Transforms analytics API results into chart-ready series.
 */

import { sankeyChartSizing } from '@/ui/recipes';
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

export type SankeyPercentContext =
  | 'expenseFunding'
  | 'income'
  | 'expenses'
  | 'fixedExpenses'
  | 'freeSpending';

export type SankeyChartNode = SankeyNode & {
  name: string;
  value: number;
  percentOfExpenses: number | null;
  percentContext: SankeyPercentContext | null;
};

export type SankeyChartLink = {
  source: number;
  target: number;
  sourceId: string;
  targetId: string;
  value: number;
  percentOfExpenses: number | null;
  percentContext: SankeyPercentContext | null;
};

export type SankeyChartData = {
  nodes: SankeyChartNode[];
  links: SankeyChartLink[];
};

export type SankeyLayoutMetrics = {
  height: number;
  nodePadding: number;
};

const SANKEY_MIN_HEIGHT = sankeyChartSizing.baseMinHeightPx * sankeyChartSizing.defaultScale;
const SANKEY_MAX_HEIGHT = sankeyChartSizing.baseMaxHeightPx * sankeyChartSizing.defaultScale;
const SANKEY_ROW_HEIGHT = 38 * sankeyChartSizing.defaultScale;
const SANKEY_HEIGHT_PADDING = 40 * sankeyChartSizing.defaultScale;
const SANKEY_MIN_NODE_PADDING = 6;
const SANKEY_MAX_NODE_PADDING = 14;

export function resolveSankeyLayoutMetrics(
  nodes: SankeyChartNode[],
  availableHeight?: number
): SankeyLayoutMetrics {
  const categoryCount = nodes.filter((node) => node.kind === 'Category').length;
  const hasSavings = nodes.some((node) => node.kind === 'Savings');
  const hasFixedExpenses = nodes.some((node) => node.kind === 'FixedExpenses');
  const hasFreeSpending = nodes.some((node) => node.kind === 'FreeSpending');
  const leftCount = nodes.filter(
    (node) => node.kind === 'Income' || node.kind === 'Deficit'
  ).length;
  const secondColumnCount = 1 + (hasSavings ? 1 : 0);
  const thirdColumnCount = (hasFixedExpenses ? 1 : 0) + (hasFreeSpending ? 1 : 0);
  const columnNodes = Math.max(leftCount, secondColumnCount, thirdColumnCount, categoryCount, 2);
  const naturalHeight = Math.max(
    SANKEY_MIN_HEIGHT,
    columnNodes * SANKEY_ROW_HEIGHT + SANKEY_HEIGHT_PADDING
  );
  const height =
    availableHeight != null && availableHeight > 0
      ? Math.max(SANKEY_MIN_HEIGHT, Math.floor(availableHeight))
      : Math.min(SANKEY_MAX_HEIGHT, naturalHeight);
  const innerHeight = height - 16;
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

type SankeySummaryTotals = {
  income: number;
  expenses: number;
  covered: number;
  deficit: number;
  surplus: number;
  fixedTotal: number;
  freeTotal: number;
};

const resolveSankeySummaryTotals = (response: SankeyResponse): SankeySummaryTotals => {
  const links = response.links ?? [];
  const fixedTotal = links
    .filter((link) => link.source === 'fixed_expenses')
    .reduce((sum, link) => sum + toNumericLinkValue(link.value), 0);
  const freeTotal = links
    .filter((link) => link.source === 'free_spending')
    .reduce((sum, link) => sum + toNumericLinkValue(link.value), 0);

  return {
    income: toNumericLinkValue(response.summary.income),
    expenses: toNumericLinkValue(response.summary.expenses),
    covered: toNumericLinkValue(response.summary.covered),
    deficit: toNumericLinkValue(response.summary.deficit),
    surplus: toNumericLinkValue(response.summary.surplus),
    fixedTotal,
    freeTotal,
  };
};

const sharePercent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : null);

const resolveNodePercent = (
  node: SankeyNode,
  response: SankeyResponse,
  totals: SankeySummaryTotals
): Pick<SankeyChartNode, 'percentOfExpenses' | 'percentContext'> => {
  switch (node.kind) {
    case 'Income':
      return {
        percentOfExpenses: sharePercent(totals.covered, totals.expenses),
        percentContext: 'expenseFunding',
      };
    case 'Deficit':
      return {
        percentOfExpenses: sharePercent(totals.deficit, totals.expenses),
        percentContext: 'expenseFunding',
      };
    case 'Expenses':
      return {
        percentOfExpenses: sharePercent(totals.covered, totals.income),
        percentContext: 'income',
      };
    case 'Savings':
      return {
        percentOfExpenses: sharePercent(totals.surplus, totals.income),
        percentContext: 'income',
      };
    case 'FixedExpenses':
      return {
        percentOfExpenses: sharePercent(totals.fixedTotal, totals.expenses),
        percentContext: 'expenses',
      };
    case 'FreeSpending':
      return {
        percentOfExpenses: sharePercent(totals.freeTotal, totals.expenses),
        percentContext: 'expenses',
      };
    case 'Category': {
      const nodeValue = resolveNodeValue(node, response);
      const parentLink = (response.links ?? []).find((link) => link.target === node.id);
      if (parentLink?.source === 'fixed_expenses') {
        return {
          percentOfExpenses: sharePercent(nodeValue, totals.fixedTotal),
          percentContext: 'fixedExpenses',
        };
      }
      if (parentLink?.source === 'free_spending') {
        return {
          percentOfExpenses: sharePercent(nodeValue, totals.freeTotal),
          percentContext: 'freeSpending',
        };
      }
      return { percentOfExpenses: null, percentContext: null };
    }
    default:
      return { percentOfExpenses: null, percentContext: null };
  }
};

const resolveLinkPercent = (
  link: SankeyLink,
  totals: SankeySummaryTotals
): Pick<SankeyChartLink, 'percentOfExpenses' | 'percentContext'> => {
  const value = toNumericLinkValue(link.value);

  if (link.source === 'income' && link.target === 'expenses') {
    return {
      percentOfExpenses: sharePercent(value, totals.expenses),
      percentContext: 'expenses',
    };
  }
  if (link.source === 'income' && link.target === 'savings') {
    return {
      percentOfExpenses: sharePercent(value, totals.income),
      percentContext: 'income',
    };
  }
  if ((link.source === 'deficit' || link.source === 'debt') && link.target === 'expenses') {
    return {
      percentOfExpenses: sharePercent(value, totals.expenses),
      percentContext: 'expenseFunding',
    };
  }
  if (link.source === 'expenses' && link.target === 'fixed_expenses') {
    return {
      percentOfExpenses: sharePercent(value, totals.expenses),
      percentContext: 'expenses',
    };
  }
  if (link.source === 'expenses' && link.target === 'free_spending') {
    return {
      percentOfExpenses: sharePercent(value, totals.expenses),
      percentContext: 'expenses',
    };
  }
  if (link.source === 'fixed_expenses') {
    return {
      percentOfExpenses: sharePercent(value, totals.fixedTotal),
      percentContext: 'fixedExpenses',
    };
  }
  if (link.source === 'free_spending') {
    return {
      percentOfExpenses: sharePercent(value, totals.freeTotal),
      percentContext: 'freeSpending',
    };
  }

  return { percentOfExpenses: null, percentContext: null };
};

const resolveNodeValue = (node: SankeyNode, response: SankeyResponse) => {
  switch (node.kind) {
    case 'Income':
      return toNumericLinkValue(response.summary.income);
    case 'Expenses':
      return toNumericLinkValue(response.summary.expenses);
    case 'Deficit':
      return toNumericLinkValue(response.summary.deficit);
    case 'Savings':
      return toNumericLinkValue(response.summary.surplus);
    case 'FixedExpenses':
    case 'FreeSpending':
      return (response.links ?? [])
        .filter((link) => link.source === node.id)
        .reduce((sum, link) => sum + toNumericLinkValue(link.value), 0);
    case 'Category':
      return (response.links ?? [])
        .filter((link) => link.target === node.id)
        .reduce((sum, link) => sum + toNumericLinkValue(link.value), 0);
    default:
      return 0;
  }
};

export function sankeyResponseToChartData(response?: SankeyResponse | null): SankeyChartData {
  const sourceResponse = response ?? null;
  const totals =
    sourceResponse != null
      ? resolveSankeySummaryTotals(sourceResponse)
      : {
          income: 0,
          expenses: 0,
          covered: 0,
          deficit: 0,
          surplus: 0,
          fixedTotal: 0,
          freeTotal: 0,
        };
  const nodes = (response?.nodes ?? []).map((node) => ({
    ...node,
    name: node.label || formatCategoryName(node.id),
    value: sourceResponse != null ? resolveNodeValue(node, sourceResponse) : 0,
    ...(sourceResponse != null
      ? resolveNodePercent(node, sourceResponse, totals)
      : { percentOfExpenses: null, percentContext: null }),
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
        ...resolveLinkPercent(link, totals),
      };
    })
    .filter((link): link is SankeyChartLink => link != null);

  return {
    nodes,
    links,
  };
}

export type SankeyTooltipMetadata = {
  percentOfExpenses: number | null;
  percentContext: SankeyPercentContext | null;
  kind: SankeyChartNode['kind'] | null;
};

export type SankeyTooltipTarget =
  | {
      type: 'node';
      node: SankeyChartNode;
    }
  | {
      type: 'link';
      link: SankeyChartLink;
      sourceNode: SankeyChartNode;
      targetNode: SankeyChartNode;
    };

const normalizeSankeyTooltipKey = (value: string | null | undefined) =>
  value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';

const stripSankeyTooltipAffixes = (value: string | null | undefined) =>
  (value ?? '')
    .replace(/^(?:expenses|fixed expenses|free spending)\s*[-–—:→]\s*/i, '')
    .replace(/^(?:expenses|fixed expenses|free spending)\s+→\s*/i, '')
    .replace(/\s*[-–—:→]\s*(?:expenses|fixed expenses|free spending)$/i, '')
    .trim();

const findSankeyNodeByHint = (chartData: SankeyChartData, hint: string) => {
  const normalizedHints = [
    normalizeSankeyTooltipKey(hint),
    normalizeSankeyTooltipKey(stripSankeyTooltipAffixes(hint)),
  ].filter(Boolean);

  if (normalizedHints.length === 0) {
    return undefined;
  }

  const scored = chartData.nodes
    .map((node) => {
      const candidates = [node.id, node.name, node.label ?? '']
        .flatMap((candidate) => [
          normalizeSankeyTooltipKey(candidate.replace(/_/g, ' ')),
          normalizeSankeyTooltipKey(stripSankeyTooltipAffixes(candidate.replace(/_/g, ' '))),
        ])
        .filter(Boolean);

      let score = -1;
      let length = -1;

      for (const normalizedHint of normalizedHints) {
        for (const candidate of candidates) {
          if (candidate === normalizedHint) {
            score = Math.max(score, 4);
            length = Math.max(length, candidate.length);
            continue;
          }

          if (candidate.length > normalizedHint.length && candidate.includes(normalizedHint)) {
            score = Math.max(score, 3);
            length = Math.max(length, candidate.length);
            continue;
          }

          if (
            normalizedHint.length > candidate.length &&
            normalizedHint.includes(candidate) &&
            candidate.length > 4
          ) {
            score = Math.max(score, 2);
            length = Math.max(length, candidate.length);
          }
        }
      }

      return { node, score, length };
    })
    .filter((match) => match.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.length - left.length;
    });

  return scored[0]?.node;
};

const findSankeyLinkFromEntry = (chartData: SankeyChartData, entry: Record<string, unknown>) => {
  const sourceId =
    typeof entry.sourceId === 'string'
      ? entry.sourceId
      : entry.source != null &&
          typeof entry.source === 'object' &&
          'id' in entry.source &&
          typeof entry.source.id === 'string'
        ? entry.source.id
        : null;
  const targetId =
    typeof entry.targetId === 'string'
      ? entry.targetId
      : entry.target != null &&
          typeof entry.target === 'object' &&
          'id' in entry.target &&
          typeof entry.target.id === 'string'
        ? entry.target.id
        : null;

  if (sourceId && targetId) {
    return chartData.links.find((link) => link.sourceId === sourceId && link.targetId === targetId);
  }

  if (typeof entry.source === 'number' && typeof entry.target === 'number') {
    return chartData.links.find(
      (link) => link.source === entry.source && link.target === entry.target
    );
  }

  return undefined;
};

export function resolveSankeyTooltipMetadata(
  chartData: SankeyChartData,
  entry: unknown,
  tooltipName?: string | null
): SankeyTooltipMetadata | null {
  const target = resolveSankeyTooltipTarget(chartData, entry, tooltipName);
  if (!target) {
    return null;
  }

  if (target.type === 'node') {
    return {
      percentOfExpenses: target.node.percentOfExpenses,
      percentContext: target.node.percentContext,
      kind: target.node.kind,
    };
  }

  return {
    percentOfExpenses: target.link.percentOfExpenses,
    percentContext: target.link.percentContext,
    kind:
      target.link.percentContext === 'expenseFunding'
        ? target.sourceNode.kind
        : target.targetNode.kind,
  };
}

export function resolveSankeyTooltipTarget(
  chartData: SankeyChartData,
  entry: unknown,
  tooltipName?: string | null
): SankeyTooltipTarget | null {
  if (entry != null && typeof entry === 'object') {
    const record = entry as Record<string, unknown>;
    const link = findSankeyLinkFromEntry(chartData, record);
    if (link) {
      const sourceNode = chartData.nodes[link.source];
      const targetNode = chartData.nodes[link.target];
      if (sourceNode && targetNode) {
        return {
          type: 'link',
          link,
          sourceNode,
          targetNode,
        };
      }
    }

    const hintedNode = findSankeyNodeByHint(chartData, tooltipName ?? '');
    if (hintedNode) {
      return {
        type: 'node',
        node: hintedNode,
      };
    }

    if (typeof record.id === 'string') {
      const node = chartData.nodes.find((candidate) => candidate.id === record.id);
      if (node) {
        return {
          type: 'node',
          node,
        };
      }
    }

    if (typeof record.kind === 'string' && record.kind !== 'Category') {
      const node = chartData.nodes.find((candidate) => candidate.kind === record.kind);
      if (node) {
        return {
          type: 'node',
          node,
        };
      }
    }
  }

  const hintedNode = findSankeyNodeByHint(chartData, tooltipName ?? '');
  if (hintedNode) {
    return {
      type: 'node',
      node: hintedNode,
    };
  }

  return null;
}
