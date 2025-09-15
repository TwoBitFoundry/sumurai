import type { AnalyticsCategoryResponse, AnalyticsTopMerchantsResponse } from '../../../types/api'
import { formatCategoryName } from '../../../utils/categories'

export type DonutDatum = { name: string; value: number }

export function categoriesToDonut(categories: any[]): DonutDatum[] {
  const mapped = (categories || []).map((c: any) => {
    const rawName: string = (c.category ?? c.name ?? 'Unknown') as string
    const rawAmount: unknown = (c.amount ?? c.value ?? 0)
    const value = typeof rawAmount === 'string' ? Number(rawAmount) : Number(rawAmount || 0)
    return { name: formatCategoryName(rawName), value: Number.isFinite(value) ? value : 0 }
  })

  const positive = mapped.filter(d => d.value > 0)
  positive.sort((a, b) => b.value - a.value)
  return positive
}

export type MerchantItem = AnalyticsTopMerchantsResponse

export function normalizeMerchants(items: AnalyticsTopMerchantsResponse[]): MerchantItem[] {
  return (items || []).slice().sort((a, b) => Number(b.amount) - Number(a.amount))
}

export const getChartColorArray = (isDark: boolean) => [
  isDark ? '#38bdf8' : '#0ea5e9',
  isDark ? '#34d399' : '#10b981',
  isDark ? '#fbbf24' : '#f59e0b',
  isDark ? '#f87171' : '#ef4444',
  isDark ? '#a78bfa' : '#8b5cf6',
  isDark ? '#10b981' : '#059669',
]

export const getTooltipStyle = (isDark: boolean) => ({
  background: isDark ? '#1e293b' : '#ffffff',
  border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
  color: isDark ? '#f8fafc' : '#0f172a',
  borderRadius: '8px',
  boxShadow: isDark ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)' : '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
  fontSize: '14px',
  fontWeight: '500',
})
