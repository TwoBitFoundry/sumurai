import React from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { fmtUSD } from '../../../utils/format'
import { DonutDatum } from '../adapters/chartData'
import { useTheme } from '../../../context/ThemeContext'
import { cn } from '@/ui/primitives'

type Props = {
  data: DonutDatum[]
  total: number
  hoveredCategory: string | null
  setHoveredCategory: (name: string | null) => void
}

type TooltipItem = { payload?: DonutDatum }

const tooltipFormatter = (
  value: number | string,
  _name: string,
  item: TooltipItem
): [string, string] => {
  const numericValue = typeof value === 'number' ? value : Number(value)
  return [fmtUSD(Number.isFinite(numericValue) ? numericValue : 0), item.payload?.name ?? '']
}

export const SpendingByCategoryChart: React.FC<Props> = ({ data, total, hoveredCategory, setHoveredCategory }) => {
  const { mode, colors } = useTheme()
  return (
    <div className={cn('group', 'relative', 'flex', 'items-center', 'justify-center', 'py-2')}>
      <div className={cn('relative', 'w-[260px]', 'h-[260px]')}>
        {data.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="value"
                  data={data}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={70}
                  stroke="none"
                  paddingAngle={1}
                  nameKey="name"
                  isAnimationActive={true}
                  animationBegin={0}
                  animationDuration={800}
                >
                  {data.map((cat, index) => {
                    const color = colors.chart.primary[index % colors.chart.primary.length]
                    const isHovered = hoveredCategory === cat.name
                    return (
                      <Cell
                        key={`cell-${cat.name}`}
                        fill={color}
                        stroke={isHovered ? colors.chart.tooltipText : 'none'}
                        strokeWidth={isHovered ? 3 : 0}
                        onMouseEnter={() => setHoveredCategory(cat.name)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        style={{
                          filter: isHovered ? 'brightness(1.15) saturate(1.1)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      />
                    )
                  })}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: colors.chart.tooltipBg,
                    border: `1px solid ${colors.chart.tooltipBorder}`,
                    color: colors.chart.tooltipText,
                    borderRadius: '8px',
                    boxShadow: mode === 'dark' ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)' : '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                  itemStyle={{ color: colors.chart.tooltipText }}
                  labelStyle={{ color: colors.chart.tooltipText }}
                  formatter={tooltipFormatter}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className={cn('absolute', 'inset-0', 'flex', 'items-center', 'justify-center', 'pointer-events-none')}>
              <div className={cn('text-2xl', 'font-bold', 'text-slate-900', 'dark:text-slate-50', 'tracking-tight')}>{fmtUSD(total)}</div>
            </div>
          </>
        ) : (
          <div className={cn('flex', 'items-center', 'justify-center', 'h-full')}>
            <div className="text-center">
              <div className={cn('text-6xl', 'mb-2', 'opacity-30')}>📊</div>
              <div className={cn('text-lg', 'font-medium', 'text-slate-600', 'dark:text-slate-400', 'mb-1')}>No transactions found</div>
              <div className={cn('text-sm', 'text-slate-500', 'dark:text-slate-500')}>No transaction data available</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SpendingByCategoryChart
