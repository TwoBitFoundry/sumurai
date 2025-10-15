import React, { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import Card from '../components/ui/Card'
import BalancesOverview from '../components/BalancesOverview'
import { SpendingByCategoryChart } from '../features/analytics/components/SpendingByCategoryChart'
import { TopMerchantsList } from '../features/analytics/components/TopMerchantsList'
import { useAnalytics } from '../features/analytics/hooks/useAnalytics'
import { useNetWorthSeries } from '../features/analytics/hooks/useNetWorthSeries'
import { categoriesToDonut } from '../features/analytics/adapters/chartData'
import { fmtUSD } from '../utils/format'
import { type DateRangeKey as DateRange } from '../utils/dateRanges'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useTheme } from '../context/ThemeContext'

const DashboardPage: React.FC = () => {
  const { mode, colors } = useTheme()
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  // Default to past-year for richer data out of the box
  const [dateRange, setDateRange] = useState<DateRange>('past-year')
  const spendingOverviewRef = useRef<HTMLDivElement | null>(null)
  const balancesOverviewRef = useRef<HTMLDivElement | null>(null)
  const [showTimeBar, setShowTimeBar] = useState(false)
  const [timeBarBottom, setTimeBarBottom] = useState(24)

  const analytics = useAnalytics(dateRange)
  const analyticsLoading = analytics.loading
  const analyticsRefreshing = analytics.refreshing
  const byCat = useMemo(() => categoriesToDonut(analytics.categories), [analytics.categories])
  const netWorth = useNetWorthSeries(dateRange)
  const netSeries = netWorth.series
  const netLoading = netWorth.loading
  const netRefreshing = netWorth.refreshing
  const netError = netWorth.error

  useEffect(() => {
    const target = balancesOverviewRef.current
    if (!target) { setShowTimeBar(false); return }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      setShowTimeBar(entry.intersectionRatio < 0.5)
    }, { threshold: [0, 0.5, 1] })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const footer = typeof document !== 'undefined' ? document.querySelector('footer') : null
    if (!footer) {
      setTimeBarBottom(24)
      return
    }

    const footerVisibleRef = { current: false }
    const computeBottom = (visible: boolean) => {
      const height = footer.getBoundingClientRect().height || 0
      return visible ? Math.max(24, height + 16) : 24
    }

    const handleResize = () => {
      setTimeBarBottom(computeBottom(footerVisibleRef.current))
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        footerVisibleRef.current = entry.isIntersecting && entry.intersectionRatio > 0
        setTimeBarBottom(computeBottom(footerVisibleRef.current))
      },
      { threshold: [0, 0.25, 0.5, 1] }
    )

    observer.observe(footer)
    setTimeBarBottom(computeBottom(footerVisibleRef.current))
    window.addEventListener('resize', handleResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const monthSpend = analytics.spendingTotal

  const netDotRenderer = useMemo(() => {
    const n = netSeries?.length || 0
    const fill = colors.chart.dotFill
    const stroke = '#10b981'
    if (!n) return () => null as any
    const changeIdx: number[] = []
    for (let i = 1; i < n; i++) {
      const prev = Number(netSeries[i - 1]?.value ?? 0)
      const curr = Number(netSeries[i]?.value ?? 0)
      if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue
      if (curr !== prev) changeIdx.push(i)
    }
    const maxDots = 30
    const selected = new Set<number>()
    if (changeIdx.length > 0) {
      const stride = Math.max(1, Math.ceil(changeIdx.length / maxDots))
      for (let k = 0; k < changeIdx.length; k += stride) selected.add(changeIdx[k])
      selected.add(changeIdx[changeIdx.length - 1])
    }
    return (props: any) => {
      const { index, cx, cy } = props || {}
      if (index == null || cx == null || cy == null) return null
      if (!selected.has(index)) return null
      return <circle cx={cx} cy={cy} r={3} stroke={stroke} strokeWidth={1} fill={fill} />
    }
  }, [netSeries, colors.chart.dotFill])

  const netYAxisDomain = useMemo(() => {
    if (!netSeries || netSeries.length === 0) return null
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const point of netSeries) {
      const value = Number(point?.value)
      if (!Number.isFinite(value)) continue
      if (value < min) min = value
      if (value > max) max = value
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null
    if (min === max) {
      const padding = Math.max(Math.abs(max) * 0.1, 500)
      return [max - padding, max + padding]
    }
    const span = Math.abs(max - min)
    const padding = Math.max(span * 0.08, 500)
    return [min - padding, max + padding]
  }, [netSeries])

  return (
    <div className="space-y-8">
      <div ref={balancesOverviewRef}>
        <BalancesOverview />
      </div>

      <div ref={spendingOverviewRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        <Card className="h-full">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Spending Over Time</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">Breakdown by category</p>
            </div>
            {!analyticsLoading && analyticsRefreshing && (
              <RefreshCcw
                aria-label="Refreshing analytics"
                className="h-4 w-4 text-slate-500 dark:text-slate-400 animate-spin"
              />
            )}
          </div>
          {analyticsLoading && (
            <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">Loading analytics...</div>
          )}
          <SpendingByCategoryChart
            data={byCat}
            total={monthSpend}
            hoveredCategory={hoveredCategory}
            setHoveredCategory={setHoveredCategory}
          />
          <div className="mt-4">
            {(() => {
              const categories = byCat
              if (!categories || categories.length === 0) return null
              const categorySum = categories.reduce((sum, c) => sum + (Number.isFinite(c.value) ? c.value : 0), 0)
              const top = categories.slice(0, 4)
              return (
                <div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">Top Categories</div>
                  <div className="grid grid-cols-2 gap-2">
                    {top.map((cat, idx) => {
                      const percentage = categorySum > 0 ? ((cat.value / categorySum) * 100).toFixed(1) : '0.0'
                      const color = colors.chart.primary[idx % colors.chart.primary.length]
                      const isHovered = hoveredCategory === cat.name
                      return (
                        <div
                          key={`topcard-${cat.name}`}
                          className={`p-2 rounded-lg border transition-all duration-300 ${
                            isHovered ? 'bg-slate-50 dark:bg-slate-700/40 border-[#93c5fd] dark:border-[#38bdf8] -translate-y-[2px]' : 'border-slate-200 dark:border-slate-700'
                          }`}
                          onMouseEnter={() => setHoveredCategory(cat.name)}
                          onMouseLeave={() => setHoveredCategory(null)}
                        >
                          <div className="flex items-center gap-2 min-w-0 mb-1">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{cat.name}</span>
                          </div>
                          <div className="flex items-baseline justify-between">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{fmtUSD(cat.value)}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{percentage}%</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        </Card>

        <Card className="h-full flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Top Merchants Over Time</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">Highest spending locations</p>
            </div>
            {!analyticsLoading && analyticsRefreshing && (
              <RefreshCcw
                aria-label="Refreshing analytics"
                className="h-4 w-4 text-slate-500 dark:text-slate-400 animate-spin"
              />
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <TopMerchantsList
              merchants={analytics.topMerchants}
              className="h-full overflow-y-auto pr-1"
            />
          </div>
        </Card>

        <Card className="h-full flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Net Worth Over Time</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">Historical asset growth</p>
            </div>
            {!netLoading && netRefreshing && (
              <RefreshCcw
                aria-label="Refreshing net worth"
                className="h-4 w-4 text-slate-500 dark:text-slate-400 animate-spin"
              />
            )}
          </div>
          {netLoading ? (
            <div className="flex-1 min-h-[220px] rounded-xl bg-slate-100/60 dark:bg-slate-900/40 animate-pulse border border-slate-200/60 dark:border-slate-700/60" />
          ) : netError ? (
            <div className="flex-1 min-h-[220px] text-sm text-rose-600 dark:text-rose-400">{netError}</div>
          ) : netSeries.length === 0 ? (
            <div className="flex-1 min-h-[220px] text-sm text-slate-500 dark:text-slate-400">No data for this range.</div>
          ) : (
            <div className="flex-1 min-h-[240px] overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.chart.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: colors.chart.axis, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    tickFormatter={(value: string) => {
                      try {
                        if (!value) return ''
                        const first = netSeries[0]?.date
                        const last = netSeries[netSeries.length - 1]?.date
                        const d = new Date(value)
                        const spanDays = first && last
                          ? Math.max(1, Math.round((new Date(last).getTime() - new Date(first).getTime()) / 86400000))
                          : 0
                        if (!isFinite(d.getTime())) return value
                        if (spanDays && spanDays <= 92) {
                          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        }
                        const mm = d.toLocaleString('en-US', { month: 'short' })
                        const yy = d.toLocaleString('en-US', { year: '2-digit' })
                        return `${mm} ’${yy}`
                      } catch {
                        return value
                      }
                    }}
                  />
                  <YAxis
                    tick={{ fill: colors.chart.axis, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    domain={netYAxisDomain ?? ['auto', 'auto']}
                    tickFormatter={(v) => {
                      const n = Math.abs(Number(v))
                      const sign = Number(v) < 0 ? '-' : ''
                      if (n >= 1e9) return `${sign}$${(n / 1e9).toFixed(0)}b`
                      if (n >= 1e6) return `${sign}$${(n / 1e6).toFixed(0)}m`
                      if (n >= 1e3) return `${sign}$${(n / 1e3).toFixed(0)}k`
                      return `${sign}$${Number(n).toFixed(0)}`
                    }}
                  />
                  <Tooltip formatter={(v: any) => fmtUSD(Number(v))} contentStyle={{ background: colors.chart.tooltipBg }} />
                  <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#netGradient)" dot={netDotRenderer as any} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {showTimeBar && (
        <div
          className="fixed left-0 right-0 z-50 flex justify-center transition-[bottom] duration-300 ease-out"
          style={{ bottom: timeBarBottom }}
        >
          <div className="flex gap-2 px-3 py-2 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 shadow-xl backdrop-blur-md ring-1 ring-slate-200/60 dark:ring-slate-700/60">
            {[
              { key: 'current-month', label: 'Current Month' },
              { key: 'past-2-months', label: '2 Months' },
              { key: 'past-3-months', label: '3 Months' },
              { key: 'past-6-months', label: '6 Months' },
              { key: 'past-year', label: '1 Year' },
              { key: 'all-time', label: '5 Years' },
            ].map(option => (
              <button
                key={option.key}
                onClick={() => setDateRange(option.key as DateRange)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  dateRange === option.key
                    ? 'bg-primary-100 dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-700/60 hover:-translate-y-[1px]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
