import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, beforeEach, afterEach } from 'vitest'
import { ReactNode } from 'react'
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter'
import { AnalyticsService } from '@/services/AnalyticsService'

vi.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    getSpendingTotal: vi.fn(),
    getCategorySpendingByDateRange: vi.fn(),
    getTopMerchantsByDateRange: vi.fn(),
    getMonthlyTotals: vi.fn(),
  }
}))

vi.mock('@/services/PlaidService', () => ({
  PlaidService: {
    getAccounts: vi.fn(),
  }
}))

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <AccountFilterProvider>
    {children}
  </AccountFilterProvider>
)

describe('useAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(AnalyticsService.getSpendingTotal).mockResolvedValue(1000)
    vi.mocked(AnalyticsService.getCategorySpendingByDateRange).mockResolvedValue([])
    vi.mocked(AnalyticsService.getTopMerchantsByDateRange).mockResolvedValue([])
    vi.mocked(AnalyticsService.getMonthlyTotals).mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should pass account filter to analytics services when not all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useAnalytics('current-month')
    }, { wrapper: TestWrapper })

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Verify initial calls were made without account filter (all accounts)
    expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined)

    // Clear the mocks to track new calls
    vi.mocked(AnalyticsService.getSpendingTotal).mockClear()
    vi.mocked(AnalyticsService.getCategorySpendingByDateRange).mockClear()
    vi.mocked(AnalyticsService.getTopMerchantsByDateRange).mockClear()
    vi.mocked(AnalyticsService.getMonthlyTotals).mockClear()

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1', 'account2'])
      accountFilterHook!.setAllAccountsSelected(false)
    })

    // Should refetch with account filter
    await waitFor(() => {
      expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledWith(expect.any(String), expect.any(String), ['account1', 'account2'])
    })
  })

  it('should not pass account filter when all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useAnalytics('current-month')
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Clear mocks and ensure all accounts is selected
    vi.mocked(AnalyticsService.getSpendingTotal).mockClear()

    await act(async () => {
      accountFilterHook!.selectAllAccounts()
    })

    await waitFor(() => {
      expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined)
    })
  })

  it('should refetch analytics when account filter changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useAnalytics('current-month')
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const initialRequestCount = vi.mocked(AnalyticsService.getSpendingTotal).mock.calls.length

    // Change account filter
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1'])
      accountFilterHook!.setAllAccountsSelected(false)
    })

    // Should refetch and increase request count
    await waitFor(() => {
      expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledTimes(initialRequestCount + 1)
    })
  })
})