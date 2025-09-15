import React from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { fmtUSD } from '../../../utils/format'
import { DonutDatum, getChartColorArray, getTooltipStyle } from '../adapters/chartData'

type Props = {
  dark: boolean
  data: DonutDatum[]
  total: number
  hoveredCategory: string | null
  setHoveredCategory: (name: string | null) => void
}

export const SpendingByCategoryChart: React.FC<Props> = ({ dark, data, total, hoveredCategory, setHoveredCategory }) => {
  return (
    <div className="group relative flex items-center justify-center py-2">
      <div className="relative w-[260px] h-[260px]">
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
                    const color = getChartColorArray(dark)[index % getChartColorArray(dark).length]
                    const isHovered = hoveredCategory === cat.name
                    return (
                      <Cell
                        key={`cell-${cat.name}`}
                        fill={color}
                        stroke={isHovered ? (dark ? '#f8fafc' : '#1e293b') : 'none'}
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
                  contentStyle={getTooltipStyle(dark)}
                  itemStyle={{ color: dark ? '#ffffff' : '#0f172a' }}
                  labelStyle={{ color: dark ? '#ffffff' : '#0f172a' }}
                  formatter={(value: any, _name: any, props: any) => [fmtUSD(Number(value)), props?.payload?.name || '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">{fmtUSD(total)}</div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-6xl mb-2 opacity-30">📊</div>
              <div className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-1">No transactions found</div>
              <div className="text-sm text-slate-500 dark:text-slate-500">No transaction data available</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SpendingByCategoryChart

