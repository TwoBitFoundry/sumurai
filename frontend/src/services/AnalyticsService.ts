import { ApiClient } from './ApiClient'
import type {
  AnalyticsSpendingResponse,
  AnalyticsCategoryResponse,
  AnalyticsMonthlyTotalsResponse,
  AnalyticsTopMerchantsResponse,
} from '../types/api'
import type { BalancesOverview } from '../types/analytics'


export class AnalyticsService {
  static async getCurrentMonthSpending(): Promise<AnalyticsSpendingResponse> {
    return ApiClient.get<AnalyticsSpendingResponse>('/analytics/spending/current-month')
  }

  static async getSpendingTotal(startDate?: string, endDate?: string): Promise<number> {
    let endpoint = '/analytics/spending'
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    const qs = params.toString()
    if (qs) endpoint += `?${qs}`
    // Backend returns a decimal as JSON number/string; ApiClient will parse JSON value.
    const result = await ApiClient.get<any>(endpoint)
    return typeof result === 'number' ? result : Number(result)
  }

  static async getCategorySpendingByDateRange(startDate?: string, endDate?: string): Promise<AnalyticsCategoryResponse[]> {
    let endpoint = '/analytics/categories'
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    const qs = params.toString()
    if (qs) endpoint += `?${qs}`
    return ApiClient.get<AnalyticsCategoryResponse[]>(endpoint)
  }

  static async getMonthlyTotals(months: number): Promise<AnalyticsMonthlyTotalsResponse[]> {
    return ApiClient.get<AnalyticsMonthlyTotalsResponse[]>(`/analytics/monthly-totals?months=${months}`)
  }


  static async getTopMerchantsByDateRange(startDate?: string, endDate?: string): Promise<AnalyticsTopMerchantsResponse[]> {
    let endpoint = '/analytics/top-merchants'
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    const qs = params.toString()
    if (qs) endpoint += `?${qs}`
    return ApiClient.get<AnalyticsTopMerchantsResponse[]>(endpoint)
  }

  // --- Phase 5: Balances Overview (latest-only)
  static async getBalancesOverview(): Promise<BalancesOverview> {
    return ApiClient.get<BalancesOverview>(`/analytics/balances/overview`)
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
