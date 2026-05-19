import { BarChart3 } from 'lucide-react';
import type React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn, EmptyState } from '@/ui/primitives';
import { text as uiTextRecipes } from '@/ui/recipes';
import { useDebouncedChartRecalc } from '../hooks/useDebouncedChartRecalc';

const donutCenterTotalTypography = 'font-display text-2xl font-bold tracking-tight';

import { chart, getThemeColors } from '@/ui/tokens';
import { useTheme } from '../../../context/ThemeContext';
import { fmtUSD } from '../../../utils/format';
import type { DonutDatum } from '../adapters/chartData';
import { ChartGlassTooltip, chartTooltipRechartsProps } from './ChartGlassTooltip';

type Props = {
  data: DonutDatum[];
  total: number;
  hoveredCategory: string | null;
  setHoveredCategory: (name: string | null) => void;
  animated?: boolean;
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
}) => {
  const { mode } = useTheme();
  const colors = getThemeColors(mode);
  const debouncedData = useDebouncedChartRecalc(data);
  const debouncedTotal = useDebouncedChartRecalc(total);
  return (
    <div
      className={cn(
        'group',
        'relative',
        'flex',
        'flex-col',
        'items-stretch',
        'justify-center',
        'min-h-[210px]',
        'md:min-h-[280px]'
      )}
    >
      {debouncedData.length > 0 ? (
        <div
          className={cn(
            'relative',
            'aspect-square',
            'w-full',
            'max-w-[315px]',
            'md:max-w-[260px]',
            'min-w-0',
            'shrink-0',
            'self-center',
            'mx-auto'
          )}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                dataKey="value"
                data={debouncedData}
                cx="50%"
                cy="50%"
                outerRadius="80%"
                innerRadius="48%"
                stroke="none"
                paddingAngle={1}
                nameKey="name"
                isAnimationActive={animated}
                animationBegin={0}
                animationDuration={animated ? 800 : 0}
              >
                {debouncedData.map((cat, index) => {
                  const palette = chart.series[mode];
                  const color = palette[index % palette.length];
                  const isHovered = hoveredCategory === cat.name;
                  return (
                    <Cell
                      key={`cell-${cat.name}`}
                      fill={color}
                      stroke={
                        isHovered
                          ? mode === 'light'
                            ? colors.chart.dotFill
                            : colors.chart.tooltipText
                          : 'none'
                      }
                      strokeWidth={isHovered ? 3 : 0}
                      onMouseEnter={() => setHoveredCategory(cat.name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      style={{
                        filter: isHovered ? 'brightness(1.15) saturate(1.1)' : 'none',
                        cursor: 'pointer',
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
          </ResponsiveContainer>
          <div
            className={cn(
              'absolute',
              'inset-0',
              'flex',
              'items-center',
              'justify-center',
              'pointer-events-none'
            )}
          >
            <div className={cn(donutCenterTotalTypography, uiTextRecipes.primary)}>
              {fmtUSD(debouncedTotal)}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="No transactions found"
          description="No transaction data available"
        />
      )}
    </div>
  );
};

export default SpendingByCategoryChart;
