import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Card from '../components/ui/Card'
import BalancesOverview from '../components/BalancesOverview'
import { SpendingByCategoryChart } from '../features/analytics/components/SpendingByCategoryChart'
import { TopMerchantsList } from '../features/analytics/components/TopMerchantsList'
import { useAnalytics } from '../features/analytics/hooks/useAnalytics'
import { categoriesToDonut, getChartColorArray } from '../features/analytics/adapters/chartData'
import { fmtUSD } from '../utils/format'
import { computeDateRange, type DateRangeKey as DateRange } from '../utils/dateRanges'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { AnalyticsService } from '../services/AnalyticsService'

type Props = { dark: boolean }

const DashboardPage: React.FC<Props> = ({ dark }) => {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  // Default to past-year for richer data out of the box
  const [dateRange, setDateRange] = useState<DateRange>('past-year')
  const spendingOverviewRef = useRef<HTMLDivElement | null>(null)
  const balancesOverviewRef = useRef<HTMLDivElement | null>(null)
  const [showTimeBar, setShowTimeBar] = useState(false)

  const analytics = useAnalytics(dateRange)
  const byCat = useMemo(() => categoriesToDonut(analytics.categories), [analytics.categories])

  const [netSeries, setNetSeries] = useState<{ date: string; value: number }[]>([])
  const [netLoading, setNetLoading] = useState(false)
  const [netError, setNetError] = useState<string | null>(null)

  const loadNet = useCallback(async () => {
    const { start, end } = computeDateRange(dateRange)
    if (!start || !end) { setNetSeries([]); return }
    setNetLoading(true)
    setNetError(null)
    try {
      const series = await AnalyticsService.getNetWorthOverTime(start, end)
      setNetSeries(series || [])
    } catch (e: any) {
      setNetError(e?.message || 'Failed to load net worth')
    } finally {
      setNetLoading(false)
    }
  }, [dateRange])

  useEffect(() => { loadNet() }, [loadNet])

  useEffect(() => {
    const target = balancesOverviewRef.current
    if (!target) { setShowTimeBar(true); return }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      const fullyVisible = entry.intersectionRatio >= 1
      setShowTimeBar(!fullyVisible)
    }, { threshold: [0, 1] })
    observer.observe(target)
    const rect = target.getBoundingClientRect()
    const viewportH = window.innerHeight || document.documentElement.clientHeight
    const fullyVisibleNow = rect.top >= 0 && rect.bottom <= viewportH
    setShowTimeBar(!fullyVisibleNow)
    return () => observer.disconnect()
  }, [])

  const monthSpend = analytics.spendingTotal

  const netDotRenderer = useMemo(() => {
    const n = netSeries?.length || 0
    const fill = dark ? '#0b1220' : '#ffffff'
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
  }, [netSeries, dark])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Dashboard</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Overview of balances, spending, and recent trends.</p>
      </div>

      <div ref={balancesOverviewRef}>
        <BalancesOverview />
      </div>

      <div ref={spendingOverviewRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        <Card className="h-full">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-4 font-medium">Spending</div>
          {analytics.loading && (
            <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">Loading analytics...</div>
          )}
          <SpendingByCategoryChart
            dark={dark}
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
                      const color = getChartColorArray(dark)[idx % getChartColorArray(dark).length]
                      const isHovered = hoveredCategory === cat.name
                      return (
                        <div
                          key={`topcard-${cat.name}`}
                          className={`p-2 rounded-lg border transition-all ${
                            isHovered ? 'bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600' : 'border-slate-200 dark:border-slate-700'
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

        <Card className="h-full">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-3 font-medium">Top Merchants</div>
          <TopMerchantsList merchants={analytics.topMerchants} />
        </Card>

        <Card className="h-full">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-4 font-medium">Net Worth Over Time</div>
          {netLoading ? (
            <div className="h-40 rounded-xl bg-slate-100/60 dark:bg-slate-900/40 animate-pulse border border-slate-200/60 dark:border-slate-700/60" />
          ) : netError ? (
            <div className="text-sm text-rose-600 dark:text-rose-400">{netError}</div>
          ) : netSeries.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No data for this range.</div>
          ) : (
            <div className="w-full overflow-hidden" style={{ height: 'clamp(240px, 36vh, 28rem)' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="date" tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => fmtUSD(Number(v))} contentStyle={{ background: dark ? '#0b1220' : '#ffffff' }} />
                  <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#netGradient)" dot={netDotRenderer as any} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {showTimeBar && (
        <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center">
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
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === option.key
                    ? 'bg-primary-100 dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-700/60'
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

