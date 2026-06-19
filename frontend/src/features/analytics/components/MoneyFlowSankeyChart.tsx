import { AnimatePresence, motion } from 'framer-motion';
import { Waypoints } from 'lucide-react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import type { SankeyLinkProps, SankeyNodeProps, TooltipContentProps } from 'recharts';
import { Sankey, Tooltip } from 'recharts';
import type { SankeyResponse } from '@/types/api';
import { cn, EmptyState } from '@/ui/primitives';
import { sankeyChart, text as uiTextRecipes } from '@/ui/recipes';
import { getCategoryLabelHex, type ThemeMode } from '@/ui/tokens';
import { formatCategoryName, getTagThemeForCategory } from '@/utils/categories';
import type { DateRangeKey } from '@/utils/dateRanges';
import { fmtUSD } from '@/utils/format';
import { useTheme } from '../../../context/ThemeContext';
import { useCategories } from '../../transactions/hooks/useCategories';
import {
  resolveSankeyLayoutMetrics,
  resolveSankeyTooltipTarget,
  type SankeyChartData,
  type SankeyChartLink,
  type SankeyChartNode,
  type SankeyPercentContext,
  type SankeyTooltipTarget,
  sankeyResponseToChartData,
} from '../adapters/chartData';
import { useChartContainerSize } from '../hooks/useChartContainerSize';
import { useDebouncedChartRecalc } from '../hooks/useDebouncedChartRecalc';
import { useSankey } from '../hooks/useSankey';
import {
  SankeyAnimationProvider,
  useSankeyLinkPath,
  useSankeyLinkScalar,
  useSankeyNodeScalar,
} from '../hooks/useSankeyLayoutAnimation';
import { ChartTooltipShell, chartTooltipRechartsProps } from './ChartGlassTooltip';

type MoneyFlowSankeyChartProps = {
  dateRange?: DateRangeKey;
  data?: SankeyResponse | null;
  accentIndexByName?: ReadonlyMap<string, number>;
  className?: string;
  containerSize?: { width: number; height?: number };
};

type MoneyFlowSankeyChartContentProps = {
  data: SankeyResponse | null;
  accentIndexByName: ReadonlyMap<string, number>;
  className?: string;
  containerSize?: { width: number; height?: number };
  loading?: boolean;
  error?: string | null;
};

type RechartsSankeyLinkPayload = {
  target: number;
  source: number;
  value: number;
  sy: number;
  dy: number;
  ty: number;
};

type SankeyNodePayload = SankeyChartNode & {
  targetNodes: number[];
  targetLinks: number[];
  sourceNodes: number[];
  sourceLinks: number[];
  depth: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  value: number;
};

type SankeyLinkPayload = RechartsSankeyLinkPayload &
  SankeyChartLink & {
    source: SankeyNodePayload;
    target: SankeyNodePayload;
  };

type SankeyNodeLike = Pick<SankeyChartNode, 'id' | 'label' | 'name' | 'kind'>;
type SankeyHoverState = {
  target: SankeyTooltipTarget;
  x: number;
  y: number;
};

type SankeyHubLabelPlacement = 'top' | 'bottom';
type SankeyTooltipContentProps = Partial<TooltipContentProps<number, string>> & {
  summary?: SankeyTooltipSummary | null;
  chartData?: SankeyChartData | null;
  tooltipTarget?: SankeyTooltipTarget | null;
};

const defaultAccentIndexByName = new Map<string, number>();

function normalizeAmount(value: number | string | null | undefined) {
  const numeric = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatSankeyPercent(percent: number | null | undefined) {
  if (percent == null || !Number.isFinite(percent)) {
    return null;
  }

  const rounded = Math.round(percent * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatSankeyPercentLine(
  percent: number | null | undefined,
  context?: SankeyPercentContext | null
) {
  const value = formatSankeyPercent(percent);
  if (!value) {
    return null;
  }

  switch (context) {
    case 'income':
      return `${value} of income`;
    case 'fixedExpenses':
      return `${value} of fixed expenses`;
    case 'freeSpending':
      return `${value} of free spending`;
    default:
      return `${value} of expenses`;
  }
}

function resolveSankeyPercentContext(
  entry: SankeyNodePayload | SankeyLinkPayload
): SankeyPercentContext | null {
  if ('percentContext' in entry && entry.percentContext) {
    return entry.percentContext;
  }

  if (isSankeyLinkPayload(entry)) {
    if (entry.target.kind === 'Savings' || entry.targetId === 'savings') {
      return 'income';
    }
    if (entry.target.kind === 'Expenses' && entry.source.kind === 'Income') {
      return 'expenses';
    }
    if (entry.source.kind === 'Income' || entry.source.kind === 'Deficit') {
      return 'expenseFunding';
    }
    if (entry.source.kind === 'Expenses') {
      return 'expenses';
    }
    if (entry.source.kind === 'FixedExpenses') {
      return 'fixedExpenses';
    }
    if (entry.source.kind === 'FreeSpending') {
      return 'freeSpending';
    }
  }

  if (isSankeyNodePayload(entry)) {
    if (entry.kind === 'Savings' || entry.kind === 'Expenses') {
      return 'income';
    }
    return entry.percentContext ?? null;
  }

  return null;
}

type SankeyTooltipSummary = {
  income: number;
  expenses: number;
  covered: number;
  deficit: number;
  surplus: number;
  fixedExpenses: number;
  freeSpending: number;
};

function resolveTooltipPercentValue(
  entry: SankeyNodePayload | SankeyLinkPayload,
  value: number,
  summary: SankeyTooltipSummary,
  context: SankeyPercentContext | null,
  kind: SankeyChartNode['kind'] | null
) {
  if (entry.percentOfExpenses != null && Number.isFinite(entry.percentOfExpenses)) {
    return entry.percentOfExpenses;
  }

  switch (context) {
    case 'income':
      return summary.income > 0 ? (value / summary.income) * 100 : null;
    case 'fixedExpenses':
      return summary.fixedExpenses > 0 ? (value / summary.fixedExpenses) * 100 : null;
    case 'freeSpending':
      return summary.freeSpending > 0 ? (value / summary.freeSpending) * 100 : null;
    case 'expenseFunding':
    case 'expenses':
      return summary.expenses > 0 ? (value / summary.expenses) * 100 : null;
  }

  if (kind === 'Savings') {
    return summary.income > 0 ? (summary.surplus / summary.income) * 100 : null;
  }
  if (kind === 'Expenses') {
    return summary.income > 0 ? (summary.covered / summary.income) * 100 : null;
  }
  if (kind === 'Income') {
    return summary.expenses > 0 ? (summary.covered / summary.expenses) * 100 : null;
  }
  if (kind === 'Deficit') {
    return summary.expenses > 0 ? (summary.deficit / summary.expenses) * 100 : null;
  }
  if (kind === 'FixedExpenses') {
    return summary.expenses > 0 ? (summary.fixedExpenses / summary.expenses) * 100 : null;
  }
  if (kind === 'FreeSpending') {
    return summary.expenses > 0 ? (summary.freeSpending / summary.expenses) * 100 : null;
  }

  return null;
}

function resolveNodeFill(
  node: SankeyNodePayload,
  colors: ReturnType<typeof useTheme>['colors'],
  accentIndexByName: ReadonlyMap<string, number>
) {
  if (node.kind === 'Income') {
    return colors.semantic.cash;
  }
  if (node.kind === 'Expenses') {
    return colors.semantic.credit;
  }
  if (node.kind === 'Deficit') {
    return colors.semantic.credit;
  }
  if (node.kind === 'Savings') {
    return colors.semantic.investments;
  }
  if (node.kind === 'FixedExpenses' || node.kind === 'FreeSpending') {
    return colors.semantic.loan;
  }
  return getTagThemeForCategory(resolveSankeyCategoryKey(node), accentIndexByName).ringHex;
}

function formatSankeyTooltipLabel(label: string) {
  return label
    .replace(/^(?:expenses|fixed expenses|free spending)\s*[-–—:→]\s*/i, '')
    .replace(/^(?:expenses|fixed expenses|free spending)\s+→\s*/i, '')
    .replace(/\s*[-–—:→]\s*(?:expenses|fixed expenses|free spending)$/i, '')
    .trim();
}

function isSankeyCategoryNode(payload: Pick<SankeyNodeLike, 'id' | 'kind'>) {
  return payload.kind === 'Category' || (payload.id?.startsWith('category_') ?? false);
}

function isSankeyNodePayload(payload: unknown): payload is SankeyNodePayload {
  return (
    payload != null &&
    typeof payload === 'object' &&
    'kind' in payload &&
    typeof (payload as SankeyNodePayload).kind === 'string'
  );
}

function resolveSankeyCategoryKey(payload: SankeyNodeLike) {
  const raw =
    payload.label ?? payload.name ?? (payload.id ? payload.id.replace(/^category_/, '') : '');
  return formatSankeyTooltipLabel(raw);
}

function resolveNodeLabel(payload: SankeyNodeLike) {
  if (isSankeyCategoryNode(payload)) {
    return formatCategoryName(resolveSankeyCategoryKey(payload));
  }
  return payload.label ?? payload.name ?? formatCategoryName(payload.id ?? '');
}

function resolveTooltipLabel(entry: SankeyNodePayload | SankeyLinkPayload, fallback?: string) {
  if (isSankeyLinkPayload(entry)) {
    if (isSankeyCategoryNode(entry.target)) {
      return resolveNodeLabel(entry.target);
    }

    if (entry.target.kind === 'Expenses') {
      return formatCategoryName(formatSankeyTooltipLabel(resolveNodeLabel(entry.source)));
    }

    return `${resolveNodeLabel(entry.source)} → ${resolveNodeLabel(entry.target)}`;
  }

  if (isSankeyNodePayload(entry)) {
    const entryLabel = resolveNodeLabel(entry);
    return formatCategoryName(formatSankeyTooltipLabel(entryLabel || fallback || ''));
  }

  return formatCategoryName(formatSankeyTooltipLabel(fallback ?? ''));
}

function resolveTooltipTargetLabel(target: SankeyTooltipTarget) {
  if (target.type === 'link') {
    if (isSankeyCategoryNode(target.targetNode)) {
      return resolveNodeLabel(target.targetNode);
    }

    if (target.targetNode.kind === 'Expenses') {
      return formatCategoryName(formatSankeyTooltipLabel(resolveNodeLabel(target.sourceNode)));
    }

    return `${resolveNodeLabel(target.sourceNode)} → ${resolveNodeLabel(target.targetNode)}`;
  }

  return formatCategoryName(formatSankeyTooltipLabel(resolveNodeLabel(target.node)));
}

function resolveTooltipTargetContext(target: SankeyTooltipTarget) {
  return target.type === 'node' ? target.node.percentContext : target.link.percentContext;
}

function resolveTooltipTargetKind(target: SankeyTooltipTarget) {
  if (target.type === 'node') {
    return target.node.kind;
  }

  return target.link.percentContext === 'expenseFunding'
    ? target.sourceNode.kind
    : target.targetNode.kind;
}

function resolveTooltipTargetValue(target: SankeyTooltipTarget) {
  return target.type === 'node' ? target.node.value : target.link.value;
}

function resolveTooltipTargetPercent(target: SankeyTooltipTarget) {
  return target.type === 'node' ? target.node.percentOfExpenses : target.link.percentOfExpenses;
}

function resolveHubLabelPlacementById(nodes: SankeyChartNode[]) {
  const placements = new Map<string, SankeyHubLabelPlacement>();
  const pairs = [
    ['income', 'debt'],
    ['savings', 'expenses'],
    ['free_spending', 'fixed_expenses'],
  ] as const;

  for (const [firstId, secondId] of pairs) {
    const firstNode = nodes.find((node) => node.id === firstId);
    const secondNode = nodes.find((node) => node.id === secondId);

    if (firstNode && secondNode) {
      if (firstNode.value >= secondNode.value) {
        placements.set(firstNode.id, 'top');
        placements.set(secondNode.id, 'bottom');
      } else {
        placements.set(secondNode.id, 'top');
        placements.set(firstNode.id, 'bottom');
      }
      continue;
    }

    if (firstNode) {
      placements.set(firstNode.id, 'top');
    }
    if (secondNode) {
      placements.set(secondNode.id, 'top');
    }
  }

  return placements;
}

function resolveNodeLabelFill(
  payload: SankeyNodePayload,
  colors: ReturnType<typeof useTheme>['colors'],
  accentIndexByName: ReadonlyMap<string, number>,
  mode: ThemeMode
) {
  if (isSankeyCategoryNode(payload)) {
    return getCategoryLabelHex(
      getTagThemeForCategory(resolveSankeyCategoryKey(payload), accentIndexByName),
      mode
    );
  }
  return resolveNodeFill(payload, colors, accentIndexByName);
}

function resolveLinkStroke(
  link: SankeyLinkPayload,
  colors: ReturnType<typeof useTheme>['colors'],
  accentIndexByName: ReadonlyMap<string, number>
) {
  if (link.target.kind === 'Category') {
    return getTagThemeForCategory(resolveSankeyCategoryKey(link.target), accentIndexByName).ringHex;
  }
  if (link.target.kind === 'Savings') {
    return colors.semantic.investments;
  }
  if (link.target.kind === 'FixedExpenses' || link.target.kind === 'FreeSpending') {
    return colors.semantic.loan;
  }
  if (link.source.kind === 'Income') {
    return colors.semantic.cash;
  }
  if (link.source.kind === 'Deficit') {
    return colors.semantic.credit;
  }
  if (link.source.kind === 'Expenses') {
    return colors.semantic.credit;
  }
  if (link.source.kind === 'Savings') {
    return colors.semantic.investments;
  }
  return colors.semantic.credit;
}

function isSankeyLinkPayload(
  payload: SankeyNodePayload | SankeyLinkPayload | undefined
): payload is SankeyLinkPayload {
  return (
    payload != null &&
    'source' in payload &&
    'target' in payload &&
    typeof payload.source === 'object' &&
    typeof payload.target === 'object' &&
    'value' in payload
  );
}

function SankeyNodeGlowDefs() {
  return (
    <defs>
      <filter id={sankeyChart.nodeGlow.filterId} x="-100%" y="-30%" width="300%" height="160%">
        <feGaussianBlur in="SourceGraphic" stdDeviation={sankeyChart.nodeGlow.blurStdDeviation} />
      </filter>
    </defs>
  );
}

function SankeyNodeShape({
  x,
  y,
  width,
  height,
  value,
  payload,
  colors,
  mode,
  accentIndexByName,
  hubLabelPlacement,
  onHover,
  onLeave,
}: SankeyNodeProps & {
  value?: number;
  payload: SankeyNodePayload;
  colors: ReturnType<typeof useTheme>['colors'];
  mode: ThemeMode;
  accentIndexByName: ReadonlyMap<string, number>;
  hubLabelPlacement?: SankeyHubLabelPlacement;
  onHover?: (payload: SankeyNodePayload, event: ReactMouseEvent<SVGGElement>) => void;
  onLeave?: () => void;
}) {
  const nodeX = useSankeyNodeScalar(payload.id, 'x', x);
  const nodeY = useSankeyNodeScalar(payload.id, 'y', y);
  const nodeWidth = useSankeyNodeScalar(payload.id, 'width', width);
  const nodeHeight = useSankeyNodeScalar(payload.id, 'height', height);

  const fill = resolveNodeFill(payload, colors, accentIndexByName);
  const label = resolveNodeLabel(payload);
  const amount = fmtUSD(normalizeAmount(value ?? payload.value));
  const isFundingSourceNode = payload.kind === 'Income' || payload.kind === 'Deficit';
  const isHubKind =
    payload.kind === 'Savings' ||
    payload.kind === 'Expenses' ||
    payload.kind === 'FreeSpending' ||
    payload.kind === 'FixedExpenses';
  const effectiveHubLabelPlacement = hubLabelPlacement ?? (isHubKind ? 'top' : undefined);
  const isTopHub = effectiveHubLabelPlacement === 'top';
  const isBottomHub = effectiveHubLabelPlacement === 'bottom';
  const isHubNode = isHubKind;
  const showLabel = isHubNode || isFundingSourceNode || height >= 18;
  const showCategoryPercent =
    payload.kind === 'Category' && height >= 16 && payload.percentOfExpenses != null;
  const showSourcePercent =
    (payload.kind === 'Income' ||
      payload.kind === 'Deficit' ||
      payload.kind === 'Savings' ||
      payload.kind === 'Expenses' ||
      payload.kind === 'FreeSpending' ||
      payload.kind === 'FixedExpenses') &&
    payload.percentOfExpenses != null;
  const centerY = nodeY + nodeHeight / 2;
  const percentX = payload.kind === 'Category' ? nodeX + nodeWidth + 10 : nodeX - 10;
  const anchor = isHubNode ? 'middle' : payload.kind === 'Category' ? 'end' : 'start';
  const labelX = isHubNode
    ? nodeX + nodeWidth / 2
    : payload.kind === 'Category'
      ? nodeX - 10
      : nodeX + nodeWidth + 10;
  const labelY = isTopHub ? nodeY - 26 : isBottomHub ? nodeY + nodeHeight + 14 : centerY - 6;
  const valueY = isTopHub ? nodeY - 10 : isBottomHub ? nodeY + nodeHeight + 30 : centerY + 14;
  const percentTransform = `rotate(270 ${percentX} ${centerY})`;

  return (
    <g
      data-testid={`sankey-node-${payload.id}`}
      onMouseEnter={onHover ? (event) => onHover(payload, event) : undefined}
      onMouseMove={onHover ? (event) => onHover(payload, event) : undefined}
      onMouseLeave={onLeave}
    >
      <rect
        x={nodeX}
        y={nodeY}
        width={nodeWidth}
        height={nodeHeight}
        rx={8}
        ry={8}
        fill={fill}
        fillOpacity={sankeyChart.nodeGlow.opacity}
        filter={`url(#${sankeyChart.nodeGlow.filterId})`}
      />
      <rect
        x={nodeX}
        y={nodeY}
        width={nodeWidth}
        height={nodeHeight}
        rx={8}
        ry={8}
        fill={fill}
        stroke={fill}
        strokeOpacity={sankeyChart.nodeGlow.strokeOpacity}
      />
      {showLabel ? (
        <>
          <text
            x={labelX}
            y={labelY}
            textAnchor={anchor}
            fill={resolveNodeLabelFill(payload, colors, accentIndexByName, mode)}
            className={cn(...sankeyChart.nodeLabel)}
          >
            {label}
          </text>
          <text x={labelX} y={valueY} textAnchor={anchor} className={cn(...sankeyChart.nodeMeta)}>
            {amount}
          </text>
        </>
      ) : null}
      {showSourcePercent ? (
        <text
          x={percentX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={percentTransform}
          className={cn(...sankeyChart.nodePercent)}
        >
          {formatSankeyPercent(payload.percentOfExpenses)}
        </text>
      ) : null}
      {showCategoryPercent ? (
        <text
          x={percentX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={percentTransform}
          className={cn(...sankeyChart.nodePercent)}
        >
          {formatSankeyPercent(payload.percentOfExpenses)}
        </text>
      ) : null}
    </g>
  );
}

export function SankeyTooltipContent({
  active,
  payload,
  label,
  summary,
  chartData,
  tooltipTarget,
}: SankeyTooltipContentProps) {
  if (tooltipTarget) {
    const tooltipLabel = resolveTooltipTargetLabel(tooltipTarget);
    const tooltipValue = resolveTooltipTargetValue(tooltipTarget);
    const tooltipAmount = fmtUSD(tooltipValue);
    const tooltipPercent = formatSankeyPercentLine(
      resolveTooltipTargetPercent(tooltipTarget),
      resolveTooltipTargetContext(tooltipTarget)
    );

    return (
      <ChartTooltipShell className={cn('flex', 'min-w-0', 'flex-col', 'gap-1')}>
        <p className={cn(...sankeyChart.nodeLabel, uiTextRecipes.primary)}>{tooltipLabel}</p>
        <p className={cn(...sankeyChart.nodeMeta, 'whitespace-nowrap')}>{tooltipAmount}</p>
        {tooltipPercent ? (
          <p className={cn(...sankeyChart.nodePercent, 'whitespace-nowrap')}>{tooltipPercent}</p>
        ) : null}
      </ChartTooltipShell>
    );
  }

  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0]?.payload;
  if (!entry) {
    return null;
  }

  const tooltipName = String(label ?? payload[0]?.name ?? '');
  const resolvedTooltipTarget =
    chartData != null ? resolveSankeyTooltipTarget(chartData, entry, tooltipName) : null;
  const tooltipLabel = resolvedTooltipTarget
    ? resolveTooltipTargetLabel(resolvedTooltipTarget)
    : resolveTooltipLabel(entry, tooltipName);
  const tooltipValue = resolvedTooltipTarget
    ? resolveTooltipTargetValue(resolvedTooltipTarget)
    : normalizeAmount(payload[0]?.value ?? entry.value);
  const tooltipAmount = fmtUSD(tooltipValue);
  const tooltipPercentContext = resolvedTooltipTarget
    ? resolveTooltipTargetContext(resolvedTooltipTarget)
    : resolveSankeyPercentContext(entry);
  const tooltipKind = resolvedTooltipTarget
    ? resolveTooltipTargetKind(resolvedTooltipTarget)
    : isSankeyNodePayload(entry)
      ? entry.kind
      : null;
  const tooltipPercentValue = resolvedTooltipTarget
    ? resolveTooltipTargetPercent(resolvedTooltipTarget)
    : resolveTooltipPercentValue(
        entry,
        tooltipValue,
        summary ?? {
          income: 0,
          expenses: 0,
          covered: 0,
          deficit: 0,
          surplus: 0,
          fixedExpenses: 0,
          freeSpending: 0,
        },
        tooltipPercentContext,
        tooltipKind
      );
  const tooltipPercent = formatSankeyPercentLine(tooltipPercentValue, tooltipPercentContext);

  return (
    <ChartTooltipShell className={cn('flex', 'min-w-0', 'flex-col', 'gap-1')}>
      <p className={cn(...sankeyChart.nodeLabel, uiTextRecipes.primary)}>{tooltipLabel}</p>
      <p className={cn(...sankeyChart.nodeMeta, 'whitespace-nowrap')}>{tooltipAmount}</p>
      {tooltipPercent ? (
        <p className={cn(...sankeyChart.nodePercent, 'whitespace-nowrap')}>{tooltipPercent}</p>
      ) : null}
    </ChartTooltipShell>
  );
}

function SankeyLinkShape({
  sourceX,
  sourceY,
  sourceControlX,
  targetX,
  targetY,
  targetControlX,
  linkWidth,
  payload,
  index,
  colors,
  accentIndexByName,
  onHover,
  onLeave,
}: SankeyLinkProps & {
  payload: SankeyLinkPayload;
  colors: ReturnType<typeof useTheme>['colors'];
  accentIndexByName: ReadonlyMap<string, number>;
  onHover?: (payload: SankeyLinkPayload, event: ReactMouseEvent<SVGPathElement>) => void;
  onLeave?: () => void;
}) {
  const linkId = `${payload.sourceId}->${payload.targetId}`;
  const pathD = useSankeyLinkPath(linkId, {
    sourceX,
    sourceY,
    sourceControlX,
    targetX,
    targetY,
    targetControlX,
  });
  const linkStrokeWidth = useSankeyLinkScalar(linkId, 'linkWidth', linkWidth);
  const stroke = resolveLinkStroke(payload, colors, accentIndexByName);

  return (
    <path
      data-testid={`sankey-link-${index}`}
      d={pathD}
      fill="none"
      stroke={stroke}
      strokeOpacity={0.3}
      strokeWidth={linkStrokeWidth}
      onMouseEnter={onHover ? (event) => onHover(payload, event) : undefined}
      onMouseMove={onHover ? (event) => onHover(payload, event) : undefined}
      onMouseLeave={onLeave}
    />
  );
}

function MoneyFlowSankeyChartContent({
  data,
  accentIndexByName,
  className,
  containerSize,
  loading = false,
  error = null,
}: MoneyFlowSankeyChartContentProps) {
  const { colors, mode } = useTheme();
  const { ref: chartContainerRef, width: measuredWidth, remeasure } = useChartContainerSize();
  const chartData = useMemo<SankeyChartData>(() => sankeyResponseToChartData(data), [data]);
  const [hoverState, setHoverState] = useState<SankeyHoverState | null>(null);
  const hubLabelPlacementById = useMemo(
    () => resolveHubLabelPlacementById(chartData.nodes),
    [chartData.nodes]
  );
  const categoryNodes = chartData.nodes.filter((node) => node.kind === 'Category');
  const chartMargin = sankeyChart.margin;
  const layoutWidth = containerSize?.width ?? measuredWidth;
  const externalHeight = containerSize?.height;
  const naturalLayout = useMemo(
    () => resolveSankeyLayoutMetrics(chartData.nodes),
    [chartData.nodes]
  );
  const sankeyLayout = useMemo(
    () =>
      resolveSankeyLayoutMetrics(
        chartData.nodes,
        externalHeight && externalHeight > 0 ? externalHeight : undefined
      ),
    [chartData.nodes, externalHeight]
  );
  const chartHeight =
    externalHeight && externalHeight > 0 ? sankeyLayout.height : naturalLayout.height;
  const chartNodePadding =
    externalHeight && externalHeight > 0 ? sankeyLayout.nodePadding : naturalLayout.nodePadding;

  const isChart =
    !error && !(loading && !data) && categoryNodes.length > 0 && chartData.links.length > 0;
  const stateKey = error ? 'error' : loading && !data ? 'loading' : !isChart ? 'empty' : 'chart';

  const updateHoverState = useCallback(
    (target: SankeyTooltipTarget, event: ReactMouseEvent<SVGElement>) => {
      const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
      if (!bounds) {
        return;
      }

      setHoverState({
        target,
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    },
    []
  );

  const clearHoverState = useCallback(() => {
    setHoverState(null);
  }, []);

  const renderNode = useCallback(
    (props: SankeyNodeProps) => {
      const payload = props.payload as unknown as SankeyNodePayload;

      return (
        <SankeyNodeShape
          {...props}
          payload={payload}
          colors={colors}
          mode={mode}
          accentIndexByName={accentIndexByName}
          hubLabelPlacement={hubLabelPlacementById.get(payload.id)}
          onHover={(hoveredPayload, event) =>
            updateHoverState(
              {
                type: 'node',
                node: hoveredPayload,
              },
              event
            )
          }
          onLeave={clearHoverState}
        />
      );
    },
    [colors, mode, accentIndexByName, hubLabelPlacementById, updateHoverState, clearHoverState]
  );

  const renderLink = useCallback(
    (props: SankeyLinkProps) => (
      <SankeyLinkShape
        {...props}
        payload={props.payload as unknown as SankeyLinkPayload}
        colors={colors}
        accentIndexByName={accentIndexByName}
        onHover={(payload, event) =>
          updateHoverState(
            {
              type: 'link',
              link: payload,
              sourceNode: payload.source,
              targetNode: payload.target,
            },
            event
          )
        }
        onLeave={clearHoverState}
      />
    ),
    [colors, accentIndexByName, updateHoverState, clearHoverState]
  );

  useLayoutEffect(() => {
    if (stateKey !== 'chart') {
      return;
    }

    remeasure({ ignoreHidden: true });
    const frame = requestAnimationFrame(() => remeasure({ ignoreHidden: true }));
    return () => cancelAnimationFrame(frame);
  }, [stateKey, remeasure]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stateKey}
        className={cn(...(isChart ? sankeyChart.shell : sankeyChart.emptyState), className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {stateKey === 'error' && (
          <EmptyState
            icon={Waypoints}
            title="Money flow unavailable"
            description="Could not load data for this period."
          />
        )}
        {stateKey === 'loading' && (
          <EmptyState
            icon={Waypoints}
            title="Loading money flow"
            description="Fetching the selected window."
          />
        )}
        {stateKey === 'empty' && (
          <EmptyState
            icon={Waypoints}
            title="No money flow yet"
            description="No category spending was found for this range."
          />
        )}
        {stateKey === 'chart' && (
          <div
            ref={containerSize ? undefined : chartContainerRef}
            className={cn(...sankeyChart.viewport, 'relative')}
          >
            {layoutWidth > 0 && chartHeight > 0 ? (
              <SankeyAnimationProvider>
                <Sankey
                  key={`${layoutWidth}x${chartHeight}`}
                  width={layoutWidth}
                  height={chartHeight}
                  data={chartData}
                  nodePadding={chartNodePadding}
                  nodeWidth={14}
                  iterations={32}
                  margin={chartMargin}
                  align="left"
                  verticalAlign="justify"
                  node={renderNode}
                  link={renderLink}
                >
                  <SankeyNodeGlowDefs />
                  <Tooltip
                    cursor={false}
                    content={(props) => (
                      <SankeyTooltipContent
                        {...props}
                        chartData={chartData}
                        summary={{
                          income: normalizeAmount(data?.summary.income),
                          expenses: normalizeAmount(data?.summary.expenses),
                          covered: normalizeAmount(data?.summary.covered),
                          deficit: normalizeAmount(data?.summary.deficit),
                          surplus: normalizeAmount(data?.summary.surplus),
                          fixedExpenses: chartData.links
                            .filter(
                              (link) =>
                                link.sourceId === 'expenses' && link.targetId === 'fixed_expenses'
                            )
                            .reduce((sum, link) => sum + link.value, 0),
                          freeSpending: chartData.links
                            .filter(
                              (link) =>
                                link.sourceId === 'expenses' && link.targetId === 'free_spending'
                            )
                            .reduce((sum, link) => sum + link.value, 0),
                        }}
                      />
                    )}
                    {...chartTooltipRechartsProps}
                    wrapperStyle={{ display: 'none' }}
                  />
                </Sankey>
              </SankeyAnimationProvider>
            ) : null}
            {hoverState ? (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
                style={{
                  left: hoverState.x,
                  top: hoverState.y - 12,
                }}
              >
                <SankeyTooltipContent active tooltipTarget={hoverState.target} />
              </div>
            ) : null}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function MoneyFlowSankeyChartLive({
  dateRange = 'current-month',
  accentIndexByName,
  className,
  containerSize,
}: Omit<MoneyFlowSankeyChartProps, 'data'>) {
  const sankey = useSankey(dateRange);
  const { accentIndexByName: hookAccentIndexByName } = useCategories();
  const debouncedData = useDebouncedChartRecalc(sankey.data);

  return (
    <MoneyFlowSankeyChartContent
      data={debouncedData}
      accentIndexByName={accentIndexByName ?? hookAccentIndexByName ?? defaultAccentIndexByName}
      className={className}
      containerSize={containerSize}
      loading={sankey.loading}
      error={sankey.error}
    />
  );
}

export function MoneyFlowSankeyChart(props: MoneyFlowSankeyChartProps) {
  if (props.data !== undefined) {
    return (
      <MoneyFlowSankeyChartContent
        data={props.data}
        accentIndexByName={props.accentIndexByName ?? defaultAccentIndexByName}
        className={props.className}
        containerSize={props.containerSize}
      />
    );
  }

  return (
    <MoneyFlowSankeyChartLive
      dateRange={props.dateRange}
      accentIndexByName={props.accentIndexByName}
      className={props.className}
      containerSize={props.containerSize}
    />
  );
}

export default MoneyFlowSankeyChart;
