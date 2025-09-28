import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { ReactNode } from 'react'
import { useBalancesOverview } from '@/hooks/useBalancesOverview'
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter'
import { AnalyticsService } from '@/services/AnalyticsService'
import { PlaidService } from '@/services/PlaidService'

vi.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    getBalancesOverview: vi.fn(),
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

describe('useBalancesOverview (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(AnalyticsService.getBalancesOverview).mockResolvedValue({
      asOf: 'latest',
      overall: { cash: 100, credit: -50, loan: -25, investments: 200, positivesTotal: 300, negativesTotal: -75, net: 225, ratio: 4 },
      banks: [],
      mixedCurrency: false
    } as any)
    vi.mocked(PlaidService.getStatus).mockResolvedValue({
      is_connected: true,
      institution_name: 'First Platypus Bank',
      connection_id: 'conn_1',
    } as any)
    vi.mocked(PlaidService.getAccounts).mockResolvedValue(mockPlaidAccounts as any)
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
      expect(result.current.refreshing).toBe(false)
    })
    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual(mock)
  })

  it('refetches when endDate changes (debounced)', async () => {
    // Controlled range state within the test component wrapper
    let end = '2024-01-01'
    const { result, rerender } = renderHook(({ endDate }) => useBalancesOverview({ endDate }, 10), { initialProps: { endDate: end }, wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.refreshing).toBe(false)
    })
    const initialCalls = vi.mocked(AnalyticsService.getBalancesOverview).mock.calls.length

    // Change endDate -> should trigger debounced refetch
    end = '2024-02-01'
    rerender({ endDate: end })

    await waitFor(() => {
      expect(AnalyticsService.getBalancesOverview).toHaveBeenCalledTimes(initialCalls + 1)
    })
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false)
    })
  })

  it('returns error when API fails', async () => {
    vi.mocked(AnalyticsService.getBalancesOverview).mockRejectedValueOnce(new Error('Boom'))

    const { result } = renderHook(() => useBalancesOverview(), { wrapper: TestWrapper })
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.refreshing).toBe(false)
    })
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
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.refreshing).toBe(false)
    })
    expect(result.current.data).toEqual(mock1)

    await act(async () => { await result.current.refresh() })
    expect(result.current.data).toEqual(mock2)
    expect(result.current.refreshing).toBe(false)
  })

  it('should pass account filter to service when not all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useBalancesOverview()
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.refreshing).toBe(false)
    })

    // Verify initial call was made without account filter (all accounts)
    expect(AnalyticsService.getBalancesOverview).toHaveBeenCalledWith(undefined)

    // Clear the mock to track new calls
    vi.mocked(AnalyticsService.getBalancesOverview).mockClear()

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2'])
    })

    // Change account filter to specific accounts
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1'])
    })

    // Should refetch with account filter
    await waitFor(() => {
      expect(AnalyticsService.getBalancesOverview).toHaveBeenCalledWith(['account1'])
    })
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false)
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
      expect(result.current.refreshing).toBe(false)
    })

    // Get initial call count
    const initialCallCount = vi.mocked(AnalyticsService.getBalancesOverview).mock.calls.length

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2'])
    })

    // Change account filter
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1'])
    })

    // Should refetch and increase call count
    await waitFor(() => {
      expect(AnalyticsService.getBalancesOverview).toHaveBeenCalledTimes(initialCallCount + 1)
    })
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false)
    })
  })

  it('exposes refreshing while background refetch is pending', async () => {
    const deferred = createDeferred<any>()

    vi.mocked(AnalyticsService.getBalancesOverview)
      .mockResolvedValueOnce({
        asOf: 'latest',
        overall: { cash: 1, credit: -1, loan: -1, investments: 1, positivesTotal: 2, negativesTotal: -2, net: 0, ratio: 1 },
        banks: [],
        mixedCurrency: false,
      } as any)
      .mockReturnValueOnce(deferred.promise as any)

    let accountFilterHook: ReturnType<typeof useAccountFilter>

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useBalancesOverview()
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.refreshing).toBe(false)
    })

    await waitFor(() => {
      expect(accountFilterHook!.allAccountIds).toEqual(['account1', 'account2'])
    })

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1'])
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.refreshing).toBe(true)
    })

    deferred.resolve({
      asOf: 'latest',
      overall: { cash: 2, credit: -2, loan: -1, investments: 2, positivesTotal: 4, negativesTotal: -3, net: 1, ratio: 1.5 },
      banks: [],
      mixedCurrency: false,
    } as any)

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false)
      expect(result.current.data?.overall?.cash).toBe(2)
    })
  })
})
