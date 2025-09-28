import { renderHook, waitFor, act, cleanup } from '@testing-library/react'
import { vi, beforeEach, afterEach } from 'vitest'
import { ReactNode } from 'react'
import { useNetWorthSeries } from '@/features/analytics/hooks/useNetWorthSeries'
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter'
import { installFetchRoutes } from '@tests/utils/fetchRoutes'
import { ApiClient } from '@/services/ApiClient'
import { computeDateRange, type DateRangeKey } from '@/utils/dateRanges'

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

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useNetWorthSeries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ApiClient.setTestMaxRetries(0)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('loads net worth series for the computed range', async () => {
    const series = [
      { date: '2024-04-01', value: 3400 },
      { date: '2024-04-02', value: 3500 },
    ]

    installFetchRoutes({
      'GET /api/analytics/net-worth-over-time': { series, currency: 'USD' }
    })

    const { result } = renderHook(({ range }) => useNetWorthSeries(range), {
      initialProps: { range: 'current-month' as DateRangeKey },
      wrapper: TestWrapper
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.series).toEqual(series)
    expect(result.current.error).toBeNull()
  })

  it('responds to range changes and ignores aborted results', async () => {
    const first = createDeferred<{ date: string; value: number }[]>()
    const second = createDeferred<{ date: string; value: number }[]>()
    vi.mocked(AnalyticsService.getNetWorthOverTime)
      .mockReturnValueOnce(first.promise as any)
      .mockReturnValueOnce(second.promise as any)

    const { result, rerender } = renderHook(({ range }) => useNetWorthSeries(range), {
      initialProps: { range: 'past-2-months' as DateRangeKey },
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(true)
    })

    rerender({ range: 'past-3-months' as DateRangeKey })

    await waitFor(() => {
      expect(AnalyticsService.getNetWorthOverTime).toHaveBeenCalledTimes(2)
    })

    await act(async () => {
      first.resolve([
        { date: '2024-03-01', value: 1000 },
      ])
    })

    await act(async () => {
      second.resolve([
        { date: '2024-02-01', value: 1200 },
      ])
    })

    await waitFor(() => {
      expect(result.current.series).toEqual([{ date: '2024-02-01', value: 1200 }])
    })
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('handles service errors and exposes message', async () => {
    const error = Object.assign(new Error('boom'), { status: 500 })
    vi.mocked(AnalyticsService.getNetWorthOverTime).mockRejectedValueOnce(error)

    const { result } = renderHook(({ range }) => useNetWorthSeries(range), {
      initialProps: { range: 'past-year' as DateRangeKey },
    })

    await waitFor(() => {
      expect(result.current.error).toBe('boom')
    })

    expect(result.current.series).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('should pass account filter to service when not all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>
    let lastRequestUrl: string | undefined

    installFetchRoutes({
      'GET /api/analytics/net-worth-over-time': (request) => {
        lastRequestUrl = request.url
        return { series: [{ date: '2024-04-01', value: 3400 }], currency: 'USD' }
      }
    })

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useNetWorthSeries('current-month')
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Set specific accounts
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1', 'account2'])
      accountFilterHook!.setAllAccountsSelected(false)
    })

    await waitFor(() => {
      expect(lastRequestUrl).toContain('account_ids[]=account1')
      expect(lastRequestUrl).toContain('account_ids[]=account2')
    })
  })

  it('should refetch when account filter changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>
    let requestCount = 0

    installFetchRoutes({
      'GET /api/analytics/net-worth-over-time': () => {
        requestCount++
        return { series: [{ date: '2024-04-01', value: 3400 }], currency: 'USD' }
      }
    })

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useNetWorthSeries('current-month')
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const initialRequestCount = requestCount

    // Change account filter
    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1'])
      accountFilterHook!.setAllAccountsSelected(false)
    })

    // Should refetch with new filter
    await waitFor(() => {
      expect(requestCount).toBeGreaterThan(initialRequestCount)
    })
  })
})
