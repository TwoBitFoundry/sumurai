import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnalyticsService } from '../services/AnalyticsService'
import { useAccountFilter } from './useAccountFilter'
import type { BalancesOverview } from '../types/analytics'
import { useDebouncedValue } from './useDebouncedValue'

export type DateRange = { startDate?: string; endDate?: string }

export type UseBalancesOverview = {
  loading: boolean
  error: string | null
  data: BalancesOverview | null
  refresh: () => Promise<void>
}

/**
 * Fetches the latest Balances Overview and updates when the provided endDate changes (debounced).
 * Note: Backend is latest-only; date range is accepted for API symmetry and future extension.
 */
export function useBalancesOverview(range?: DateRange, debounceMs = 300): UseBalancesOverview {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<BalancesOverview | null>(null)

  const { selectedAccountIds, isAllAccountsSelected } = useAccountFilter()

  const endDate = range?.endDate
  const debouncedEnd = useDebouncedValue(endDate, debounceMs)
  const [lastTriggeredEnd, setLastTriggeredEnd] = useState<string | undefined>(debouncedEnd)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const accountIds = !isAllAccountsSelected && selectedAccountIds.length > 0 ? selectedAccountIds : undefined
      const result = await AnalyticsService.getBalancesOverview(accountIds)
      setData(result)
    } catch (e: any) {
      setError(e?.message || 'Failed to load balances overview')
    } finally {
      setLoading(false)
    }
  }, [isAllAccountsSelected, selectedAccountIds])

  // Fetch on mount
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refetch when debounced endDate changes (ignore initial mount)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!mounted) return
    if (debouncedEnd !== lastTriggeredEnd) {
      setLastTriggeredEnd(debouncedEnd)
      if (debouncedEnd !== undefined) {
        load()
      }
    }
  }, [debouncedEnd, lastTriggeredEnd, load, mounted])

  // Refetch when account filter changes
  useEffect(() => {
    if (!mounted) return
    load()
  }, [isAllAccountsSelected, selectedAccountIds, mounted, load])

  return useMemo(() => ({ loading, error, data, refresh: load }), [loading, error, data, load])
}
