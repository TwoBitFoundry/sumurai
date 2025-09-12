import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { useBalancesOverview } from './useBalancesOverview'
import { installFetchRoutes } from '../test/fetchRoutes'
import { ApiClient } from '../services/ApiClient'

describe('useBalancesOverview (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Disable retries for deterministic timing in tests
    ApiClient.setTestMaxRetries(0)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.clearAllMocks()
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
    installFetchRoutes({ 'GET /api/analytics/balances/overview': mock })

    const { result } = renderHook(() => useBalancesOverview())
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual(mock)
  })

  it('refetches when endDate changes (debounced)', async () => {
    let calls = 0
    installFetchRoutes({
      'GET /api/analytics/balances/overview': () => {
        calls += 1
        return {
          asOf: 'latest',
          overall: { cash: 1, credit: -1, loan: -1, investments: 1, positivesTotal: 2, negativesTotal: -2, net: 0, ratio: 1 },
          banks: [],
          mixedCurrency: false
        }
      }
    })

    // Controlled range state within the test component wrapper
    let end = '2024-01-01'
    const { result, rerender } = renderHook(({ endDate }) => useBalancesOverview({ endDate }, 10), { initialProps: { endDate: end } })

    await waitFor(() => { expect(result.current.loading).toBe(false) })
    expect(calls).toBe(1)

    // Change endDate -> should trigger debounced refetch
    end = '2024-02-01'
    rerender({ endDate: end })

    await waitFor(() => { expect(calls).toBe(2) })
  })

  it('returns error when API fails', async () => {
    installFetchRoutes({ 'GET /api/analytics/balances/overview': new Response('Boom', { status: 500 }) })

    const { result } = renderHook(() => useBalancesOverview())
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
    let toggle = false
    installFetchRoutes({
      'GET /api/analytics/balances/overview': () => (toggle ? mock2 : mock1)
    })

    const { result } = renderHook(() => useBalancesOverview())
    await waitFor(() => { expect(result.current.loading).toBe(false) })
    expect(result.current.data).toEqual(mock1)

    toggle = true
    await act(async () => { await result.current.refresh() })
    expect(result.current.data).toEqual(mock2)
  })
})

