import { ApiClient } from './ApiClient'
import type {
  AnalyticsSpendingResponse,
  AnalyticsCategoryResponse,
  AnalyticsMonthlyTotalsResponse,
  AnalyticsTopMerchantsResponse,
} from '../types/api'
import type { BalancesOverview } from '../types/analytics'
import { appendAccountQueryParams } from '../utils/queryParams'

export class AnalyticsService {
  static async getCurrentMonthSpending(): Promise<AnalyticsSpendingResponse> {
    return ApiClient.get<AnalyticsSpendingResponse>('/analytics/spending/current-month')
  }

  static async getSpendingTotal(startDate?: string, endDate?: string, accountIds?: string[]): Promise<number> {
    let endpoint = '/analytics/spending'
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    appendAccountQueryParams(params, accountIds)
    const qs = params.toString()
    if (qs) endpoint += `?${qs}`
    // Backend returns a decimal as JSON number/string; ApiClient will parse JSON value.
    const result = await ApiClient.get<any>(endpoint)
    return typeof result === 'number' ? result : Number(result)
  }

  static async getCategorySpendingByDateRange(startDate?: string, endDate?: string, accountIds?: string[]): Promise<AnalyticsCategoryResponse[]> {
    let endpoint = '/analytics/categories'
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    appendAccountQueryParams(params, accountIds)
    const qs = params.toString()
    if (qs) endpoint += `?${qs}`
    return ApiClient.get<AnalyticsCategoryResponse[]>(endpoint)
  }

  static async getMonthlyTotals(months: number, accountIds?: string[]): Promise<AnalyticsMonthlyTotalsResponse[]> {
    let endpoint = `/analytics/monthly-totals?months=${months}`
    const params = new URLSearchParams(`months=${months}`)
    appendAccountQueryParams(params, accountIds)
    const qs = params.toString()
    if (qs) endpoint = `/analytics/monthly-totals?${qs}`
    return ApiClient.get<AnalyticsMonthlyTotalsResponse[]>(endpoint)
  }


  static async getTopMerchantsByDateRange(startDate?: string, endDate?: string, accountIds?: string[]): Promise<AnalyticsTopMerchantsResponse[]> {
    let endpoint = '/analytics/top-merchants'
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    appendAccountQueryParams(params, accountIds)
    const qs = params.toString()
    if (qs) endpoint += `?${qs}`
    return ApiClient.get<AnalyticsTopMerchantsResponse[]>(endpoint)
  }

  // --- Phase 5: Balances Overview (latest-only)
  static async getBalancesOverview(accountIds?: string[]): Promise<BalancesOverview> {
    let endpoint = '/analytics/balances/overview'
    const params = new URLSearchParams()
    appendAccountQueryParams(params, accountIds)
    const qs = params.toString()
    if (qs) endpoint += `?${qs}`
    return ApiClient.get<BalancesOverview>(endpoint)
  }

  // Net Worth Over Time (Depository ledger-based)
  static async getNetWorthOverTime(startDate: string, endDate: string, accountIds?: string[]): Promise<{ date: string; value: number }[]> {
    let endpoint = '/analytics/net-worth-over-time'
    const params = new URLSearchParams()
    params.append('start_date', startDate)
    params.append('end_date', endDate)
    appendAccountQueryParams(params, accountIds)
    endpoint += `?${params.toString()}`
    const result = await ApiClient.get<{ series: { date: string; value: number }[]; currency: string }>(endpoint)
    return result.series || []
  }
}

// --- Balances Overview helpers (Phase 0) ---
export function computeRatio(positivesTotal: number, negativesTotal: number): number | null {
  if (negativesTotal === 0) return null
  const denom = Math.max(1, Math.abs(negativesTotal))
  const ratio = positivesTotal / denom
  return Math.round(ratio * 100) / 100
}

// Phase 5 formatter used by UI
export function formatRatio(ratio: number | string | null): string {
  if (ratio === null || ratio === undefined) return '∞'
  const n = typeof ratio === 'string' ? Number(ratio) : ratio
  if (!isFinite(n)) return '∞'
  return n.toFixed(2)
}
