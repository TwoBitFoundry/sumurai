import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnalyticsService } from '../../../services/AnalyticsService'
import { useAccountFilter } from '../../../hooks/useAccountFilter'
import type {
  AnalyticsCategoryResponse,
  AnalyticsTopMerchantsResponse,
  AnalyticsMonthlyTotalsResponse,
} from '../../../types/api'
import { computeDateRange, type DateRangeKey } from '../../../utils/dateRanges'

export type UseAnalyticsResult = {
  loading: boolean
  error: string | null
  spendingTotal: number
  categories: AnalyticsCategoryResponse[]
  topMerchants: AnalyticsTopMerchantsResponse[]
  monthlyTotals: AnalyticsMonthlyTotalsResponse[]
  start?: string
  end?: string
}

export function useAnalytics(range: DateRangeKey): UseAnalyticsResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [spendingTotal, setSpendingTotal] = useState(0)
  const [categories, setCategories] = useState<AnalyticsCategoryResponse[]>([])
  const [topMerchants, setTopMerchants] = useState<AnalyticsTopMerchantsResponse[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<AnalyticsMonthlyTotalsResponse[]>([])

  const { selectedAccountIds, isAllAccountsSelected } = useAccountFilter()

  const abortRef = useRef<AbortController | null>(null)

  const { start, end } = useMemo(() => computeDateRange(range), [range])

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    setError(null)
    try {
      const accountIds = !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined
      const [total, cats, merch, monthly] = await Promise.all([
        AnalyticsService.getSpendingTotal(start, end, accountIds),
        AnalyticsService.getCategorySpendingByDateRange(start, end, accountIds),
        AnalyticsService.getTopMerchantsByDateRange(start, end, accountIds),
        AnalyticsService.getMonthlyTotals(6, accountIds),
      ])
      if (ac.signal.aborted) return
      const totalNum = Number(total) || 0
      setSpendingTotal(totalNum)
      setCategories(Array.isArray(cats) ? cats : [])
      setTopMerchants(Array.isArray(merch) ? merch : [])
      setMonthlyTotals(Array.isArray(monthly) ? monthly : [])
    } catch (e: any) {
      if (!ac.signal.aborted) {
        setError(e?.message || 'Failed to load analytics')
      }
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [start, end, isAllAccountsSelected, selectedAccountIds])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  return { loading, error, spendingTotal, categories, topMerchants, monthlyTotals, start, end }
}
