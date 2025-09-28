import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, beforeEach, afterEach } from 'vitest'
import { ReactNode } from 'react'
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter'
import { AnalyticsService } from '@/services/AnalyticsService'
import { PlaidService } from '@/services/PlaidService'

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
    getStatus: vi.fn(),
  }
}))

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <AccountFilterProvider>
    {children}
  </AccountFilterProvider>
)

const mockPlaidAccounts = [
  {
    id: 'account1',
    name: 'Mock Checking',
    account_type: 'depository',
    balance_current: 1200,
    mask: '1111',
    plaid_connection_id: 'conn_1',
    institution_name: 'Mock Bank'
  },
  {
    id: 'account2',
    name: 'Mock Savings',
    account_type: 'depository',
    balance_current: 5400,
    mask: '2222',
    plaid_connection_id: 'conn_1',
    institution_name: 'Mock Bank'
  }
]

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(AnalyticsService.getSpendingTotal).mockResolvedValue(1000)
    vi.mocked(AnalyticsService.getCategorySpendingByDateRange).mockResolvedValue([])
    vi.mocked(AnalyticsService.getTopMerchantsByDateRange).mockResolvedValue([])
    vi.mocked(AnalyticsService.getMonthlyTotals).mockResolvedValue([])
    vi.mocked(PlaidService.getStatus).mockResolvedValue({
      is_connected: true,
      institution_name: 'First Platypus Bank',
      connection_id: 'conn_1',
    } as any)
    vi.mocked(PlaidService.getAccounts).mockResolvedValue(mockPlaidAccounts as any)
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

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2'])
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.refreshing).toBe(false)

    // Verify initial calls were made without account filter (all accounts)
    expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined)

    // Clear the mocks to track new calls
    vi.mocked(AnalyticsService.getSpendingTotal).mockClear()
    vi.mocked(AnalyticsService.getCategorySpendingByDateRange).mockClear()
    vi.mocked(AnalyticsService.getTopMerchantsByDateRange).mockClear()
    vi.mocked(AnalyticsService.getMonthlyTotals).mockClear()

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1'])
    })

    // Should refetch with account filter
    await waitFor(() => {
      expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledWith(expect.any(String), expect.any(String), ['account1'])
    })
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false)
    })
  })

  it('should not pass account filter when all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useAnalytics('current-month')
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2'])
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.refreshing).toBe(false)

    // Clear mocks, select subset, then reselect all
    vi.mocked(AnalyticsService.getSpendingTotal).mockClear()

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1'])
    })

    await waitFor(() => {
      expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledWith(expect.any(String), expect.any(String), ['account1'])
    })

    vi.mocked(AnalyticsService.getSpendingTotal).mockClear()

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds([...accountFilterHook!.allAccountIds])
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
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2'])
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const initialRequestCount = vi.mocked(AnalyticsService.getSpendingTotal).mock.calls.length

    expect(result.current.refreshing).toBe(false)

    // Change account filter
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1'])
    })

    // Should refetch and increase request count
    await waitFor(() => {
      expect(AnalyticsService.getSpendingTotal).toHaveBeenCalledTimes(initialRequestCount + 1)
    })
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false)
    })
  })

  it('exposes refreshing during in-flight background refetches', async () => {
    const totalsDeferred = createDeferred<number>()
    const categoriesDeferred = createDeferred<any[]>()
    const merchantsDeferred = createDeferred<any[]>()
    const monthlyDeferred = createDeferred<any[]>()

    vi.mocked(AnalyticsService.getSpendingTotal)
      .mockResolvedValueOnce(500)
      .mockReturnValueOnce(totalsDeferred.promise as any)
    vi.mocked(AnalyticsService.getCategorySpendingByDateRange)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(categoriesDeferred.promise as any)
    vi.mocked(AnalyticsService.getTopMerchantsByDateRange)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(merchantsDeferred.promise as any)
    vi.mocked(AnalyticsService.getMonthlyTotals)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(monthlyDeferred.promise as any)

    let accountFilterHook: ReturnType<typeof useAccountFilter>

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useAnalytics('current-month')
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false)
    })

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2'])
    })

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1'])
    })

    totalsDeferred.resolve(650)
    categoriesDeferred.resolve([{ name: 'Food', amount: 100 }] as any)
    merchantsDeferred.resolve([{ name: 'Store', amount: 50 }] as any)
    monthlyDeferred.resolve([])

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false)
    })
  })
})
