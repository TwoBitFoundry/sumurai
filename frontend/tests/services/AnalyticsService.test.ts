import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnalyticsService } from '@/services/AnalyticsService'
import { ApiClient } from '@/services/ApiClient'
import type { 
  AnalyticsCategoryResponse,
  AnalyticsMonthlyTotalsResponse,
  AnalyticsTopMerchantsResponse,
} from '@/types/api'

vi.mock('@/services/ApiClient')

describe('AnalyticsService (date-range endpoints)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSpendingTotal', () => {
    it('calls backend with start/end date for current month', async () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const start = new Date(y, m, 1).toISOString().slice(0,10);
      const end = new Date(y, m + 1, 0).toISOString().slice(0,10);
      vi.mocked(ApiClient.get).mockResolvedValue(1250.75)

      const result = await AnalyticsService.getSpendingTotal(start, end)

      expect(ApiClient.get).toHaveBeenCalledWith(`/analytics/spending?start_date=${start}&end_date=${end}`)
      expect(result).toBe(1250.75)
    })

    it('omits query params for all-time (no dates)', async () => {
      vi.mocked(ApiClient.get).mockResolvedValue(0)

      const result = await AnalyticsService.getSpendingTotal()

      expect(ApiClient.get).toHaveBeenCalledWith('/analytics/spending')
      expect(result).toBe(0)
    })

    it('serializes account_ids parameter when provided', async () => {
      const start = '2024-01-01';
      const end = '2024-01-31';
      const accountIds = ['acc_1', 'acc_2'];
      vi.mocked(ApiClient.get).mockResolvedValue(500.25)

      const result = await AnalyticsService.getSpendingTotal(start, end, accountIds)

      expect(ApiClient.get).toHaveBeenCalledWith(`/analytics/spending?start_date=${start}&end_date=${end}&account_ids%5B%5D=acc_1&account_ids%5B%5D=acc_2`)
      expect(result).toBe(500.25)
    })
  })

  describe('getCategorySpendingByDateRange', () => {
    it('calls backend with date range for categories', async () => {
      const start = '2024-01-01';
      const end = '2024-01-31';
      const mockCategories: AnalyticsCategoryResponse[] = [
        { category: 'Food & Dining', amount: 450.25, percentage: 36.02 },
        { category: 'Transportation', amount: 280.50, percentage: 22.44 },
      ]
      vi.mocked(ApiClient.get).mockResolvedValue(mockCategories)

      const result = await AnalyticsService.getCategorySpendingByDateRange(start, end)

      expect(ApiClient.get).toHaveBeenCalledWith(`/analytics/categories?start_date=${start}&end_date=${end}`)
      expect(result).toEqual(mockCategories)
    })

    it('omits query params when no dates are provided (all-time)', async () => {
      const mockCategories: AnalyticsCategoryResponse[] = []
      vi.mocked(ApiClient.get).mockResolvedValue(mockCategories)

      const result = await AnalyticsService.getCategorySpendingByDateRange()

      expect(ApiClient.get).toHaveBeenCalledWith('/analytics/categories')
      expect(result).toEqual(mockCategories)
    })

    it('serializes account_ids parameter when provided', async () => {
      const start = '2024-01-01';
      const end = '2024-01-31';
      const accountIds = ['acc_1', 'acc_2'];
      const mockCategories: AnalyticsCategoryResponse[] = [
        { category: 'Food & Dining', amount: 250.25, percentage: 50.05 }
      ]
      vi.mocked(ApiClient.get).mockResolvedValue(mockCategories)

      const result = await AnalyticsService.getCategorySpendingByDateRange(start, end, accountIds)

      expect(ApiClient.get).toHaveBeenCalledWith(`/analytics/categories?start_date=${start}&end_date=${end}&account_ids%5B%5D=acc_1&account_ids%5B%5D=acc_2`)
      expect(result).toEqual(mockCategories)
    })
  })

  // Removed daily spending endpoint and related UI

  describe('getMonthlyTotals', () => {
    it('should call backend for pre-calculated monthly totals', async () => {
      const mockMonthlyTotals: AnalyticsMonthlyTotalsResponse[] = [
        { month: '2024-01', amount: 1250.75 },
        { month: '2023-12', amount: 980.25 },
        { month: '2023-11', amount: 1100.00 }
      ]
      vi.mocked(ApiClient.get).mockResolvedValue(mockMonthlyTotals)

      const result = await AnalyticsService.getMonthlyTotals(3)

      expect(ApiClient.get).toHaveBeenCalledWith('/analytics/monthly-totals?months=3')
      expect(result).toEqual(mockMonthlyTotals)
    })

    it('should NOT perform any date calculations or processing', async () => {
      const backendTotals: AnalyticsMonthlyTotalsResponse[] = [
        { month: 'Dec 2023', amount: 500 },
        { month: '2024-01', amount: 1000 },
        { month: 'invalid-date', amount: 250 }
      ]
      vi.mocked(ApiClient.get).mockResolvedValue(backendTotals)

      const result = await AnalyticsService.getMonthlyTotals(6)

      expect(result).toEqual(backendTotals)
      expect(result[0].month).toBe('Dec 2023')
      expect(result[2].month).toBe('invalid-date')
    })
  })

  describe('getTopMerchantsByDateRange', () => {
    it('calls backend with date range for top merchants', async () => {
      const start = '2024-01-01';
      const end = '2024-01-31';
      const mockMerchants: AnalyticsTopMerchantsResponse[] = [
        { name: 'Starbucks', amount: 125.5, count: 8, percentage: 25.2 },
        { name: 'Shell', amount: 89.25, count: 4, percentage: 18.0 },
      ]
      vi.mocked(ApiClient.get).mockResolvedValue(mockMerchants)

      const result = await AnalyticsService.getTopMerchantsByDateRange(start, end)

      expect(ApiClient.get).toHaveBeenCalledWith(`/analytics/top-merchants?start_date=${start}&end_date=${end}`)
      expect(result).toEqual(mockMerchants)
    })
  })

  // Removed day-of-week spending endpoint and related UI

  describe('Pure Date Range API (no periods)', () => {
    it('should not have dateRangeToPeriod method', () => {
      expect((AnalyticsService as any).dateRangeToPeriod).toBeUndefined()
    })

    it('should call backend directly with date ranges for categories', async () => {
      const mockCategories: AnalyticsCategoryResponse[] = [
        { category: 'Food', amount: 100, percentage: 100 }
      ]
      vi.mocked(ApiClient.get).mockResolvedValue(mockCategories)

      const result = await AnalyticsService.getCategorySpendingByDateRange('2024-01-01', '2024-01-31')

      expect(ApiClient.get).toHaveBeenCalledWith('/analytics/categories?start_date=2024-01-01&end_date=2024-01-31')
      expect(result).toEqual(mockCategories)
    })

    it('should call backend directly with date ranges for merchants', async () => {
      const mockMerchants: AnalyticsTopMerchantsResponse[] = [
        { name: 'Store', amount: 100, count: 1, percentage: 100 }
      ]
      vi.mocked(ApiClient.get).mockResolvedValue(mockMerchants)

      const result = await AnalyticsService.getTopMerchantsByDateRange('2024-01-01', '2024-01-31')

      expect(ApiClient.get).toHaveBeenCalledWith('/analytics/top-merchants?start_date=2024-01-01&end_date=2024-01-31')
      expect(result).toEqual(mockMerchants)
    })

    // Day-of-week endpoint removed
  })
})
