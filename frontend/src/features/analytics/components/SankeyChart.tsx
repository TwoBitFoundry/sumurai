'use client';

import type React from 'react';
import { useMemo, useState } from 'react';
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import type { SankeyLinkData, SankeyNodeData } from '../../../domain/SankeyCalculator';
import { useCurrency } from '../../../hooks/useCurrency';

interface SankeyChartProps {
  nodes: SankeyNodeData[];
  links: SankeyLinkData[];
  height?: number;
}

export const SankeyChart: React.FC<SankeyChartProps> = ({ nodes, links, height }) => {
  const { format } = useCurrency();
  const [hoveredLinkIdx, setHoveredLinkIdx] = useState<number | null>(null);
  const [hoveredNodeIdx, setHoveredNodeIdx] = useState<number | null>(null);

  const hasSubcategories = useMemo(
    () => nodes.some((n) => n.categoryType === 'subcategory'),
    [nodes]
  );

  // Dynamic height calculation so many categories/subcategories don't collide
  const computedHeight = useMemo(() => {
    if (height) return height;
    const subCount = nodes.filter((n) => n.categoryType === 'subcategory').length;
    const catCount = nodes.filter((n) => n.categoryType === 'outflow').length;
    const inflowCount = nodes.filter(
      (n) => n.categoryType === 'inflow' || n.categoryType === 'deficit'
    ).length;
    const maxLayerNodes = Math.max(subCount, catCount, inflowCount, 8);
    return Math.max(540, Math.min(1050, maxLayerNodes * 34));
  }, [height, nodes]);

  const rechartsData = useMemo(() => {
    return {
      nodes: nodes.map((n) => ({
        ...n,
      })),
      links: links.map((l) => ({
        ...l,
      })),
    };
  }, [nodes, links]);

  // Custom Node Renderer
  const renderCustomNode = (nodeProps: any) => {
    const { x, y, width, height: nodeHeight, index, payload } = nodeProps;
    if (x === undefined || y === undefined || !payload) return null;

    const isHovered = hoveredNodeIdx === index;
    const isAnyHovered = hoveredNodeIdx !== null || hoveredLinkIdx !== null;
    const color = payload.color || '#0ea5e9';
    const amount = payload.amount || 0;
    const formattedName = payload.formattedName || payload.name || '';
    const categoryType = payload.categoryType;

    const effectiveHeight = Math.max(8, nodeHeight || 8);
    const centerY = y + effectiveHeight / 2;

    let textX: number;
    let textY = centerY;
    let textAnchor: 'start' | 'end' | 'middle';

    if (categoryType === 'inflow' || categoryType === 'deficit') {
      textX = x - 8;
      textAnchor = 'end';
    } else if (categoryType === 'hub') {
      if (y >= 20) {
        textX = x + width / 2;
        textY = y - 10;
        textAnchor = 'middle';
      } else {
        textX = x + width + 8;
        textAnchor = 'start';
      }
    } else if (categoryType === 'outflow') {
      if (hasSubcategories) {
        textX = x - 8;
        textAnchor = 'end';
      } else {
        textX = x + width + 8;
        textAnchor = 'start';
      }
    } else {
      textX = x + width + 8;
      textAnchor = 'start';
    }

    const opacity = isAnyHovered ? (isHovered ? 1 : 0.45) : 0.95;

    return (
      <g
        key={`sankey-node-${index}`}
        className="transition-opacity duration-200 cursor-pointer select-none"
        onMouseEnter={() => setHoveredNodeIdx(index)}
        onMouseLeave={() => setHoveredNodeIdx(null)}
      >
        {/* Node bar */}
        <rect
          x={x}
          y={y}
          width={width}
          height={effectiveHeight}
          rx={4}
          fill={color}
          fillOpacity={opacity}
          stroke={isHovered ? '#ffffff' : color}
          strokeWidth={isHovered ? 2 : 1}
          className="transition-all duration-150"
        />

        {/* Node label with amount right next to it */}
        <text
          x={textX}
          y={textY}
          textAnchor={textAnchor}
          dominantBaseline="central"
          className="text-[0.72rem] select-none transition-colors"
          style={{ pointerEvents: 'none' }}
        >
          <tspan className="font-semibold fill-slate-800 dark:fill-slate-100">
            {formattedName}
          </tspan>
          <tspan className="font-medium fill-slate-500 dark:fill-slate-400">
            {' · '}
            {format(amount)}
          </tspan>
        </text>
      </g>
    );
  };

  // Custom Link Renderer
  const renderCustomLink = (linkProps: any) => {
    const {
      sourceX,
      targetX,
      sourceY,
      targetY,
      sourceControlX,
      targetControlX,
      linkWidth,
      index,
      payload,
    } = linkProps;

    if (sourceX === undefined || targetX === undefined) return null;

    const isHovered = hoveredLinkIdx === index;
    const isConnectedNode =
      hoveredNodeIdx !== null &&
      payload &&
      (payload.source?.index === hoveredNodeIdx || payload.target?.index === hoveredNodeIdx);

    const isAnyHovered = hoveredLinkIdx !== null || hoveredNodeIdx !== null;
    const highlight = isHovered || isConnectedNode;

    const opacity = isAnyHovered ? (highlight ? 0.75 : 0.15) : 0.38;

    const sourceColor = payload?.source?.color || '#0ea5e9';
    const targetColor = payload?.target?.color || '#10b981';

    const pathD = `
      M${sourceX},${sourceY}
      C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
    `;

    return (
      <g key={`sankey-link-${index}`}>
        <defs>
          <linearGradient
            id={`link-grad-${index}`}
            gradientUnits="userSpaceOnUse"
            x1={sourceX}
            y1={sourceY}
            x2={targetX}
            y2={targetY}
          >
            <stop offset="0%" stopColor={sourceColor} />
            <stop offset="100%" stopColor={targetColor} />
          </linearGradient>
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke={`url(#link-grad-${index})`}
          strokeWidth={Math.max(2, linkWidth || 2)}
          strokeOpacity={opacity}
          className="transition-all duration-200 cursor-pointer"
          onMouseEnter={() => setHoveredLinkIdx(index)}
          onMouseLeave={() => setHoveredLinkIdx(null)}
        />
      </g>
    );
  };

  return (
    <div className="w-full relative overflow-x-auto py-2">
      <div
        style={{
          minWidth: hasSubcategories ? '920px' : '760px',
          width: '100%',
          height: computedHeight,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={rechartsData}
            nodeWidth={14}
            nodePadding={hasSubcategories ? 18 : 22}
            margin={{
              top: 28,
              right: hasSubcategories ? 220 : 180,
              bottom: 24,
              left: 150,
            }}
            linkCurvature={0.5}
            iterations={0}
            node={renderCustomNode}
            link={renderCustomLink}
          >
            <Tooltip
              content={({ payload }) => {
                if (!payload || !payload.length) return null;
                const data = payload[0].payload as any;
                if (!data) return null;

                // If hovered on Link
                if (data.source && data.target) {
                  const sourceName = data.source.formattedName || data.source.name;
                  const targetName = data.target.formattedName || data.target.name;
                  const value = data.value || 0;
                  return (
                    <div className="rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-md px-3.5 py-2.5 shadow-xl text-xs dark:border-slate-700/80 dark:bg-slate-900/95 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                        <span>{sourceName}</span>
                        <span className="text-slate-400">→</span>
                        <span>{targetName}</span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 font-bold text-sm">
                        {format(value)}
                      </div>
                    </div>
                  );
                }

                // If hovered on Node
                const name = data.formattedName || data.name || '';
                const amount = data.amount || data.value || 0;
                const pct = data.percentage;

                return (
                  <div className="rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-md px-3.5 py-2.5 shadow-xl text-xs dark:border-slate-700/80 dark:bg-slate-900/95 space-y-1">
                    <div className="font-semibold text-slate-900 dark:text-white">{name}</div>
                    <div className="text-slate-600 dark:text-slate-300 font-bold text-sm">
                      {format(amount)}
                    </div>
                    {pct !== undefined && (
                      <div className="text-[0.7rem] text-slate-500 dark:text-slate-400">
                        {pct}% of {data.categoryType === 'inflow' ? 'Total Income' : 'Category'}
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
