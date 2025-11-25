import type { AnalyticsTopMerchantsResponse } from '../../../types/api'
import { formatCategoryName } from '../../../utils/categories'

export type DonutDatum = { name: string; value: number }

type CategoryDatum = {
  category?: string | null
  name?: string | null
  amount?: number | string | null
  value?: number | string | null
}

export function categoriesToDonut(categories: CategoryDatum[] = []): DonutDatum[] {
  const mapped = categories.map((c) => {
    const rawName: string = (c.category ?? c.name ?? 'Unknown') || 'Unknown'
    const rawAmount: number | string | null | undefined = c.amount ?? c.value ?? 0
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
