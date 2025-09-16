import { renderHook, waitFor, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useNetWorthSeries } from './useNetWorthSeries'
import { AnalyticsService } from '../../../services/AnalyticsService'
import { computeDateRange, type DateRangeKey } from '../../../utils/dateRanges'

vi.mock('../../../services/AnalyticsService', () => ({
  AnalyticsService: {
    getNetWorthOverTime: vi.fn(),
  },
}))

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
    vi.resetAllMocks()
  })

  it('loads net worth series for the computed range', async () => {
    const series = [
      { date: '2024-04-01', value: 3400 },
      { date: '2024-04-02', value: 3500 },
    ]
    vi.mocked(AnalyticsService.getNetWorthOverTime).mockResolvedValueOnce(series as any)

    const { result } = renderHook(({ range }) => useNetWorthSeries(range), {
      initialProps: { range: 'current-month' as DateRangeKey },
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const { start, end } = computeDateRange('current-month')
    expect(AnalyticsService.getNetWorthOverTime).toHaveBeenCalledWith(start, end)
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
})
