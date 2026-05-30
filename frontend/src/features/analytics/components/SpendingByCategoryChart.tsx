import { BarChart3 } from 'lucide-react';
import type React from 'react';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { cn, EmptyState } from '@/ui/primitives';
import { text as uiTextRecipes } from '@/ui/recipes';
import { chart } from '@/ui/tokens';
import { useTheme } from '../../../context/ThemeContext';
import { fmtUSD } from '../../../utils/format';
import type { DonutDatum } from '../adapters/chartData';
import { useChartContainerSize } from '../hooks/useChartContainerSize';
import { useDebouncedChartRecalc } from '../hooks/useDebouncedChartRecalc';
import { ChartGlassTooltip, chartTooltipRechartsProps } from './ChartGlassTooltip';

type Props = {
  data: DonutDatum[];
  total: number;
  hoveredCategory: string | null;
  setHoveredCategory: (name: string | null) => void;
  animated?: boolean;
  className?: string;
};

type TooltipItem = { payload?: DonutDatum };

const tooltipFormatter = (
  value: number | string,
  _name: string,
  item: TooltipItem
): [string, string] => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return [fmtUSD(Number.isFinite(numericValue) ? numericValue : 0), item.payload?.name ?? ''];
};

export const SpendingByCategoryChart: React.FC<Props> = ({
  data,
  total,
  hoveredCategory,
  setHoveredCategory,
  animated = true,
  className,
}) => {
  const { mode } = useTheme();
  const debouncedData = useDebouncedChartRecalc(data);
  const debouncedTotal = useDebouncedChartRecalc(total);
  const { ref: chartContainerRef, width, height } = useChartContainerSize();
  const chartSize = Math.min(width, height);

  if (debouncedData.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No spending yet"
        description="Nothing to chart in this period."
      />
    );
  }

  const center = chartSize / 2;
  const outerRadius = Math.max(Math.floor(center) - 1, 0);
  const innerRadius = Math.round(outerRadius * 0.62);

  return (
    <div
      ref={chartContainerRef}
      className={cn('relative', 'mx-auto', 'aspect-square', 'w-full', 'min-w-0', className)}
    >
      {chartSize > 0 ? (
        <>
          <PieChart
            width={chartSize}
            height={chartSize}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            accessibilityLayer={false}
          >
            <Pie
              dataKey="value"
              data={debouncedData}
              cx={center}
              cy={center}
              outerRadius={outerRadius}
              innerRadius={innerRadius}
              stroke="none"
              paddingAngle={1}
              nameKey="name"
              isAnimationActive={animated}
              animationBegin={0}
              animationDuration={animated ? 800 : 0}
            >
              {debouncedData.map((cat, index) => {
                const palette = chart.series[mode];
                const color = cat.color ?? palette[index % palette.length];
                const isHovered = hoveredCategory === cat.name;
                return (
                  <Cell
                    key={`cell-${cat.name}`}
                    fill={color}
                    fillOpacity={hoveredCategory === null || isHovered ? 1 : 0.35}
                    onMouseEnter={() => setHoveredCategory(cat.name)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    onClick={() => setHoveredCategory(cat.name)}
                    style={{
                      filter: isHovered ? 'brightness(1.08) saturate(1.05)' : 'none',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                    }}
                  />
                );
              })}
            </Pie>
            <Tooltip
              content={(tooltipProps) => (
                <ChartGlassTooltip {...tooltipProps} formatter={tooltipFormatter} />
              )}
              {...chartTooltipRechartsProps}
            />
          </PieChart>
          <div
            className={cn(
              'absolute',
              'inset-0',
              'flex',
              'items-center',
              'justify-center',
              'pointer-events-none',
              'px-[22%]'
            )}
          >
            <div
              className={cn(
                'font-display',
                'font-bold',
                'leading-none',
                'tabular-nums',
                'text-center',
                'text-[clamp(0.875rem,4vw,1.5rem)]',
                uiTextRecipes.primary
              )}
            >
              {fmtUSD(debouncedTotal)}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default SpendingByCategoryChart;
