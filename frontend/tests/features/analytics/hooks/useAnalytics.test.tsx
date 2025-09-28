import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, beforeEach, afterEach } from 'vitest'
import { ReactNode } from 'react'
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter'
import { installFetchRoutes } from '@tests/utils/fetchRoutes'
import { ApiClient } from '@/services/ApiClient'

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
    ApiClient.setTestMaxRetries(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should pass account filter to analytics services when not all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>
    let lastRequestUrls: string[] = []

    installFetchRoutes({
      'GET /api/analytics/spending': (request) => {
        lastRequestUrls.push(request.url)
        return 1000
      },
      'GET /api/analytics/categories': (request) => {
        lastRequestUrls.push(request.url)
        return []
      },
      'GET /api/analytics/top-merchants': (request) => {
        lastRequestUrls.push(request.url)
        return []
      },
      'GET /api/analytics/monthly-totals': (request) => {
        lastRequestUrls.push(request.url)
        return []
      }
    })

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useAnalytics('current-month')
    }, { wrapper: TestWrapper })

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Clear tracked URLs and set specific accounts
    lastRequestUrls = []

    await act(async () => {
      accountFilterHook!.setSelectedAccountIds(['account1', 'account2'])
      accountFilterHook!.setAllAccountsSelected(false)
    })

    await waitFor(() => {
      expect(lastRequestUrls.some(url =>
        url.includes('account_ids[]=account1') && url.includes('account_ids[]=account2')
      )).toBe(true)
    })
  })

  it('should not pass account filter when all accounts selected', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>
    let lastRequestUrls: string[] = []

    installFetchRoutes({
      'GET /api/analytics/spending': (request) => {
        lastRequestUrls.push(request.url)
        return 1000
      },
      'GET /api/analytics/categories': (request) => {
        lastRequestUrls.push(request.url)
        return []
      },
      'GET /api/analytics/top-merchants': (request) => {
        lastRequestUrls.push(request.url)
        return []
      },
      'GET /api/analytics/monthly-totals': (request) => {
        lastRequestUrls.push(request.url)
        return []
      }
    })

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useAnalytics('current-month')
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Clear tracked URLs and ensure all accounts is selected
    lastRequestUrls = []

    await act(async () => {
      accountFilterHook!.selectAllAccounts()
    })

    await waitFor(() => {
      expect(lastRequestUrls.some(url => url.includes('account_ids'))).toBe(false)
    })
  })

  it('should refetch analytics when account filter changes', async () => {
    let accountFilterHook: ReturnType<typeof useAccountFilter>
    let requestCount = 0

    installFetchRoutes({
      'GET /api/analytics/spending': () => {
        requestCount++
        return 1000
      },
      'GET /api/analytics/categories': () => [],
      'GET /api/analytics/top-merchants': () => [],
      'GET /api/analytics/monthly-totals': () => []
    })

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useAnalytics('current-month')
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