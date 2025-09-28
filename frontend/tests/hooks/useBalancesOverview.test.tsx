import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { ReactNode } from 'react'
import { useBalancesOverview } from '@/hooks/useBalancesOverview'
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter'
import { AnalyticsService } from '@/services/AnalyticsService'

vi.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    getBalancesOverview: vi.fn(),
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

describe('useBalancesOverview (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(AnalyticsService.getBalancesOverview).mockResolvedValue({
      asOf: 'latest',
      overall: { cash: 100, credit: -50, loan: -25, investments: 200, positivesTotal: 300, negativesTotal: -75, net: 225, ratio: 4 },
      banks: [],
      mixedCurrency: false
    } as any)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('fetches on mount and exposes loading/data', async () => {
    const mock = {
      asOf: 'latest',
      overall: {
        cash: 100, credit: -50, loan: -25, investments: 200,
        positivesTotal: 300, negativesTotal: -75, net: 225, ratio: 4
      },
      banks: [],
      mixedCurrency: false
    }
    vi.mocked(AnalyticsService.getBalancesOverview).mockResolvedValueOnce(mock as any)

    const { result } = renderHook(() => useBalancesOverview(), { wrapper: TestWrapper })
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual(mock)
  })

  it('refetches when endDate changes (debounced)', async () => {
    // Controlled range state within the test component wrapper
    let end = '2024-01-01'
    const { result, rerender } = renderHook(({ endDate }) => useBalancesOverview({ endDate }, 10), { initialProps: { endDate: end }, wrapper: TestWrapper })

    await waitFor(() => { expect(result.current.loading).toBe(false) })
    const initialCalls = vi.mocked(AnalyticsService.getBalancesOverview).mock.calls.length

    // Change endDate -> should trigger debounced refetch
    end = '2024-02-01'
    rerender({ endDate: end })

    await waitFor(() => {
      expect(AnalyticsService.getBalancesOverview).toHaveBeenCalledTimes(initialCalls + 1)
    })
  })

  it('returns error when API fails', async () => {
    vi.mocked(AnalyticsService.getBalancesOverview).mockRejectedValueOnce(new Error('Boom'))

    const { result } = renderHook(() => useBalancesOverview(), { wrapper: TestWrapper })
    await waitFor(() => { expect(result.current.loading).toBe(false) })
    expect(result.current.error).toBeTruthy()
    expect(result.current.data).toBeNull()
  })

  it('supports manual refresh()', async () => {
    const mock1 = {
      asOf: 'latest', overall: { cash: 1, credit: -1, loan: -1, investments: 1, positivesTotal: 2, negativesTotal: -2, net: 0, ratio: 1 }, banks: [], mixedCurrency: false
    }
    const mock2 = {
      asOf: 'latest', overall: { cash: 2, credit: -1, loan: -1, investments: 1, positivesTotal: 3, negativesTotal: -2, net: 1, ratio: 1.5 }, banks: [], mixedCurrency: false
    }

    vi.mocked(AnalyticsService.getBalancesOverview)
      .mockResolvedValueOnce(mock1 as any)
      .mockResolvedValueOnce(mock2 as any)

    const { result } = renderHook(() => useBalancesOverview(), { wrapper: TestWrapper })
    await waitFor(() => { expect(result.current.loading).toBe(false) })
    expect(result.current.data).toEqual(mock1)

    await act(async () => { await result.current.refresh() })
    expect(result.current.data).toEqual(mock2)
  })

  it('should pass account filter to service when not all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useBalancesOverview()
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Verify initial call was made without account filter (all accounts)
    expect(AnalyticsService.getBalancesOverview).toHaveBeenCalledWith(undefined)

    // Clear the mock to track new calls
    vi.mocked(AnalyticsService.getBalancesOverview).mockClear()

    // Change account filter to specific accounts
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1', 'account2'])
      accountFilterHook!.setAllAccountsSelected(false)
    })

    // Should refetch with account filter
    await waitFor(() => {
      expect(AnalyticsService.getBalancesOverview).toHaveBeenCalledWith(['account1', 'account2'])
    })
  })

  it('should refetch when account filter changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useBalancesOverview()
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Get initial call count
    const initialCallCount = vi.mocked(AnalyticsService.getBalancesOverview).mock.calls.length

    // Change account filter
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1'])
      accountFilterHook!.setAllAccountsSelected(false)
    })

    // Should refetch and increase call count
    await waitFor(() => {
      expect(AnalyticsService.getBalancesOverview).toHaveBeenCalledTimes(initialCallCount + 1)
    })
  })
})
