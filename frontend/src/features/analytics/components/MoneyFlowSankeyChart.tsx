import { BarChart3 } from 'lucide-react';
import { useMemo } from 'react';
import type { SankeyLinkProps, SankeyNodeProps, TooltipContentProps } from 'recharts';
import { Sankey, Tooltip } from 'recharts';
import type { SankeyResponse } from '@/types/api';
import { Alert, cn, EmptyState } from '@/ui/primitives';
import { sankeyChart, text as uiTextRecipes } from '@/ui/recipes';
import { getCategoryLabelHex, type ThemeMode } from '@/ui/tokens';
import { formatCategoryName, getTagThemeForCategory } from '@/utils/categories';
import type { DateRangeKey } from '@/utils/dateRanges';
import { fmtUSD } from '@/utils/format';
import { useTheme } from '../../../context/ThemeContext';
import { useCategories } from '../../transactions/hooks/useCategories';
import {
  resolveSankeyLayoutMetrics,
  type SankeyChartData,
  type SankeyChartLink,
  type SankeyChartNode,
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
  containerSize?: { width: number; height: number };
};

type MoneyFlowSankeyChartContentProps = {
  data: SankeyResponse | null;
  accentIndexByName: ReadonlyMap<string, number>;
  className?: string;
  containerSize?: { width: number; height: number };
  loading?: boolean;
  error?: string | null;
};

type RechartsSankeyNodePayload = {
  dx: number;
  dy: number;
  name: string;
  value: number;
  x: number;
  y: number;
  depth: number;
  targetNodes: number[];
  targetLinks: number[];
  sourceNodes: number[];
  sourceLinks: number[];
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

function formatSankeyPercentLine(percent: number | null | undefined) {
  const value = formatSankeyPercent(percent);
  return value ? `${value} of expenses` : null;
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
  if (node.kind === 'FixedExpenses') {
    return colors.semantic.credit;
  }
  if (node.kind === 'FreeSpending') {
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

function isSankeyCategoryNode(payload: Pick<SankeyNodePayload, 'id' | 'kind'>) {
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

function resolveSankeyCategoryKey(
  payload: Pick<SankeyNodePayload, 'id' | 'label' | 'name' | 'kind'>
) {
  const raw =
    payload.label ?? payload.name ?? (payload.id ? payload.id.replace(/^category_/, '') : '');
  return formatSankeyTooltipLabel(raw);
}

function resolveNodeLabel(payload: SankeyNodePayload) {
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
  if (link.target.kind === 'FixedExpenses') {
    return colors.semantic.credit;
  }
  if (link.target.kind === 'FreeSpending') {
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
      <filter id={sankeyChart.nodeGlow.filterId} x="-100%" y="-100%" width="300%" height="300%">
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
}: SankeyNodeProps & {
  value?: number;
  payload: SankeyNodePayload;
  colors: ReturnType<typeof useTheme>['colors'];
  mode: ThemeMode;
  accentIndexByName: ReadonlyMap<string, number>;
}) {
  const nodeX = useSankeyNodeScalar(payload.id, 'x', x);
  const nodeY = useSankeyNodeScalar(payload.id, 'y', y);
  const nodeWidth = useSankeyNodeScalar(payload.id, 'width', width);
  const nodeHeight = useSankeyNodeScalar(payload.id, 'height', height);

  const fill = resolveNodeFill(payload, colors, accentIndexByName);
  const label = resolveNodeLabel(payload);
  const amount = fmtUSD(normalizeAmount(value ?? payload.value));
  const isTopHub = payload.kind === 'Expenses' || payload.kind === 'FreeSpending';
  const isBottomHub = payload.kind === 'Savings' || payload.kind === 'FixedExpenses';
  const isHubNode = isTopHub || isBottomHub;
  const showLabel = isHubNode || height >= 18;
  const showCategoryPercent =
    payload.kind === 'Category' && height >= 16 && payload.percentOfExpenses != null;
  const showSourcePercent =
    (payload.kind === 'Income' || payload.kind === 'Deficit') &&
    height >= 16 &&
    payload.percentOfExpenses != null;
  const showSavingsPercent =
    payload.kind === 'Savings' && height >= 16 && payload.percentOfExpenses != null;
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
  const savingsPercentY = nodeY + nodeHeight + 46;
  const percentTransform = `rotate(270 ${percentX} ${centerY})`;

  return (
    <g data-testid={`sankey-node-${payload.id}`}>
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
      {showSavingsPercent ? (
        <text
          x={labelX}
          y={savingsPercentY}
          textAnchor="middle"
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
  expenseTotal,
}: TooltipContentProps<number, string> & { expenseTotal?: number | null }) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0]?.payload;
  if (!entry) {
    return null;
  }

  const tooltipLabel = resolveTooltipLabel(entry, String(label ?? payload[0]?.name ?? ''));
  const tooltipAmount = fmtUSD(normalizeAmount(payload[0]?.value ?? entry.value));
  const tooltipPercentValue =
    entry.percentOfExpenses ??
    (expenseTotal != null && expenseTotal > 0
      ? (normalizeAmount(payload[0]?.value ?? entry.value) / expenseTotal) * 100
      : null);
  const tooltipPercent = formatSankeyPercent(tooltipPercentValue);

  return (
    <ChartTooltipShell className={cn('flex', 'min-w-0', 'flex-col', 'gap-1')}>
      <p className={cn(...sankeyChart.nodeLabel, uiTextRecipes.primary)}>{tooltipLabel}</p>
      <p className={cn(...sankeyChart.nodeMeta, 'whitespace-nowrap')}>{tooltipAmount}</p>
      {tooltipPercent ? (
        <p className={cn(...sankeyChart.nodePercent, 'whitespace-nowrap')}>
          {formatSankeyPercentLine(tooltipPercentValue)}
        </p>
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
}: SankeyLinkProps & {
  payload: SankeyLinkPayload;
  colors: ReturnType<typeof useTheme>['colors'];
  accentIndexByName: ReadonlyMap<string, number>;
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
  const {
    ref: chartContainerRef,
    width: measuredWidth,
    height: measuredHeight,
  } = useChartContainerSize();
  const chartData = useMemo<SankeyChartData>(() => sankeyResponseToChartData(data), [data]);
  const categoryNodes = chartData.nodes.filter((node) => node.kind === 'Category');
  const chartMargin = sankeyChart.margin;
  const layoutWidth = containerSize?.width ?? measuredWidth;
  const layoutHeight = containerSize?.height ?? measuredHeight;
  const naturalLayout = useMemo(
    () => resolveSankeyLayoutMetrics(chartData.nodes),
    [chartData.nodes]
  );
  const sankeyLayout = useMemo(
    () => resolveSankeyLayoutMetrics(chartData.nodes, layoutHeight > 0 ? layoutHeight : undefined),
    [chartData.nodes, layoutHeight]
  );
  const chartHeight = layoutHeight > 0 ? sankeyLayout.height : naturalLayout.height;
  const chartNodePadding = layoutHeight > 0 ? sankeyLayout.nodePadding : naturalLayout.nodePadding;

  if (error) {
    return (
      <Alert variant="error" title="Money flow unavailable" className={cn('w-full', className)}>
        {error}
      </Alert>
    );
  }

  if (loading && !data) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Loading money flow"
        description="Fetching the selected window."
        className={cn(...sankeyChart.emptyState, className)}
      />
    );
  }

  if (categoryNodes.length === 0 || chartData.links.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No money flow yet"
        description="No category spending was found for this range."
        className={cn(...sankeyChart.emptyState, className)}
      />
    );
  }

  return (
    <div className={cn(...sankeyChart.shell, className)}>
      <div
        ref={containerSize ? undefined : chartContainerRef}
        className={cn(...sankeyChart.viewport)}
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
              node={(props) => (
                <SankeyNodeShape
                  {...props}
                  payload={props.payload as unknown as SankeyNodePayload}
                  colors={colors}
                  mode={mode}
                  accentIndexByName={accentIndexByName}
                />
              )}
              link={(props) => (
                <SankeyLinkShape
                  {...props}
                  payload={props.payload as unknown as SankeyLinkPayload}
                  colors={colors}
                  accentIndexByName={accentIndexByName}
                />
              )}
            >
              <SankeyNodeGlowDefs />
              <Tooltip
                cursor={false}
                content={(props) => (
                  <SankeyTooltipContent
                    {...props}
                    expenseTotal={normalizeAmount(data?.summary.expenses)}
                  />
                )}
                {...chartTooltipRechartsProps}
              />
            </Sankey>
          </SankeyAnimationProvider>
        ) : null}
      </div>
    </div>
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
