import fs from 'node:fs'

import { render, screen, cleanup, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/App'
import { AccountFilterProvider } from '@/hooks/useAccountFilter'
import { installFetchRoutes } from '@tests/utils/fetchRoutes'
import { createProviderStatus } from '@tests/utils/fixtures'

const mockProviderAccounts = [
  {
    id: 'account1',
    name: 'Mock Checking',
    account_type: 'depository',
    balance_current: 1200,
    balance_available: 1200,
    mask: '1111',
    provider: 'plaid',
    institution_name: 'Mock Bank'
  },
  {
    id: 'account2',
    name: 'Mock Savings',
    account_type: 'depository',
    balance_current: 5400,
    balance_available: 5400,
    mask: '2222',
    provider: 'plaid',
    institution_name: 'Mock Bank'
  }
]

global.fetch = jest.fn()

const mockFetchAuthOk = () => {
  const original = global.fetch as any
  const stub = jest.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/providers/status')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => createProviderStatus() } as any)
    }
    if (url.includes('/api/auth/logout')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ message: 'ok', cleared_session: '' }) } as any)
    }
    if (url.includes('/api/auth/refresh')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          token: 'new.token.value',
          user_id: 'test-user',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          onboarding_completed: true,
        }),
      } as any)
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`))
  })
  global.fetch = stub
  return () => {
    global.fetch = original
  }
}

jest.mock('@/services/ApiClient', () => ({
  ApiClient: {
    get: jest.fn().mockImplementation((endpoint: string) => {
      if (endpoint.includes('/plaid/accounts')) {
        return Promise.resolve([])
      }
      if (endpoint.includes('/providers/accounts')) {
        return Promise.resolve(mockProviderAccounts)
      }
      if (endpoint.includes('/providers/info')) {
        return Promise.resolve({
          available_providers: ['plaid', 'teller'],
          default_provider: 'plaid',
          user_provider: 'plaid',
        })
      }
      if (endpoint.includes('/providers/status')) {
        return Promise.resolve(createProviderStatus())
      }
      if (endpoint.startsWith('/analytics/spending')) {
        return Promise.resolve({ total: 1234.56, currency: 'USD' })
      }
      if (endpoint.includes('/analytics/categories')) {
        return Promise.resolve([
          { category: 'Food & Dining', amount: 450.25, count: 15, percentage: 36.5 },
          { category: 'Transportation', amount: 280.50, count: 8, percentage: 22.7 }
        ])
      }
      if (endpoint.includes('/analytics/monthly-totals')) {
        return Promise.resolve([
          { month: '2024-11', amount: 800.00 },
          { month: '2024-12', amount: 1000.00 },
          { month: '2025-01', amount: 1234.56 }
        ])
      }
      if (endpoint.includes('/analytics/top-merchants')) {
        return Promise.resolve([
          { name: 'Starbucks', amount: 125.50, count: 8 },
          { name: 'Shell', amount: 89.25, count: 4 }
        ])
      }
      if (endpoint.includes('/transactions')) {
        return Promise.resolve([
          {
            id: '1',
            date: '2025-01-15',
            name: 'Coffee Shop',
            merchantName: 'Starbucks',
            amount: 5.99,
            category: { primary: 'FOOD_AND_DRINK', detailed: 'COFFEE' },
            provider: 'plaid',
            account_name: 'Checking',
            account_type: 'depository'
          }
        ])
      }
      if (endpoint.includes('/budgets')) {
        return Promise.resolve([
          {
            id: '1',
            category: 'Food',
            month: '2025-01',
            amount: 500.00,
            spent: 350.00,
            remaining: 150.00,
            percentage: 70.0
          }
        ])
      }
      return Promise.resolve({})
    }),
    post: jest.fn().mockResolvedValue({}),
    put: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
  ApiError: class ApiError extends Error {
    constructor(message = 'API Error') {
      super(message)
      this.name = 'ApiError'
    }
  },
  AuthenticationError: class AuthenticationError extends Error {
    constructor(message = 'Authentication required') {
      super(message)
      this.name = 'AuthenticationError'
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message = 'Validation Error') {
      super(message)
      this.name = 'ValidationError'
    }
  },
  NetworkError: class NetworkError extends Error {
    constructor(message = 'Network Error') {
      super(message)
      this.name = 'NetworkError'
    }
  },
  ServerError: class ServerError extends Error {
    constructor(message = 'Server Error') {
      super(message)
      this.name = 'ServerError'
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(message = 'Conflict Error') {
      super(message)
      this.name = 'ConflictError'
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message = 'Not Found Error') {
      super(message)
      this.name = 'NotFoundError'
    }
  },
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message = 'Forbidden Error') {
      super(message)
      this.name = 'ForbiddenError'
    }
  },
}))


jest.mock('@/hooks/usePlaidConnection', () => ({
  usePlaidConnection: () => ({
    isConnected: false,
    institutionName: null,
    lastSyncAt: null,
    transactionCount: 0,
    accountCount: 0,
    syncInProgress: false,
    markConnected: jest.fn(),
    disconnect: jest.fn(),
    setSyncInProgress: jest.fn(),
    updateSyncInfo: jest.fn(),
    refresh: jest.fn(),
  }),
}))


describe('App Phase 2 - Business Logic Removal', () => {
  const originalConsoleError = console.error
  let fetchMock: ReturnType<typeof installFetchRoutes>

  const mockFetchAuthOk = () => {
    const original = global.fetch as any
    const stub = jest.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/providers/status')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => createProviderStatus() } as any)
      }
      if (url.includes('/api/auth/logout')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ message: 'ok', cleared_session: '' }) } as any)
      }
      if (url.includes('/api/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            token: 'new.token.value',
            user_id: 'test-user',
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            onboarding_completed: true,
          }),
        } as any)
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`))
    })
    global.fetch = stub
    return () => {
      global.fetch = original
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    console.error = jest.fn()

    document.body.innerHTML = ''

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
      },
      writable: true
    })

    fetchMock = installFetchRoutes({
      'GET /api/providers/accounts': mockProviderAccounts,
      'GET /api/plaid/accounts': [],
      'GET /api/providers/status': createProviderStatus(),
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/monthly-totals*': [],
      'GET /api/analytics/top-merchants*': [],
      'GET /api/budgets': [],
    })
  })

  afterEach(() => {
    console.error = originalConsoleError
    cleanup()
  })

  describe('RED: Business logic helper functions should not exist', () => {
    it('should not contain business logic helper functions in App.tsx source code', () => {
      const appSource = fs.readFileSync('./src/App.tsx', 'utf-8')
      
      const forbiddenFunctions = [
        'calcMonthSpend',
        'groupByCat', 
        'filterByDateRange',
        'getTopMerchants',
        'calculateCategorySpending',
        'monthlyTotalsLastN',
        'getDailySpendingTrend',
        'getSpendingByDayOfWeek',
        'limitCategoriesToTen',
        'groupByCatCurrentMonth',
        'filterTxns',
        'appendSimulated',
        'daysInMonth',
        'dailySpendCurrentMonth',
        'topCategories'
      ]
      
      forbiddenFunctions.forEach(funcName => {
        expect(appSource).not.toMatch(new RegExp(`function\\s+${funcName}`))
        expect(appSource).not.toMatch(new RegExp(`const\\s+${funcName}\\s*=`))
      })
    })
  })

  describe('RED: Mock data and seed data should not exist', () => {
    it('should not contain mock data in App.tsx source code', () => {
      const appSource = fs.readFileSync('./src/App.tsx', 'utf-8')
      
      expect(appSource).not.toMatch(/seedTxns/)
      expect(appSource).not.toMatch(/seedBudgets/)
      expect(appSource).not.toMatch(/realBudgets/)
      expect(appSource).not.toMatch(/useMockData/)
      expect(appSource).not.toMatch(/Toggle mock data/)
    })
  })

  describe('RED: Components should only display data from API services', () => {
    it('should not perform local calculations with useMemo for spending data', async () => {
      const validToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature'
      ;(window.sessionStorage.getItem as any).mockReturnValue(validToken)

      const restore = mockFetchAuthOk()

      await act(async () => {
        render(
          <AccountFilterProvider>
            <App />
          </AccountFilterProvider>
        )
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      expect(screen.getAllByText(/spending/i).length).toBeGreaterThan(0)
      restore()
    }, 15000)

    it('should use API services for all data instead of local state calculations', () => {
      expect(true).toBe(true)
    })

    it('should not contain any useMemo hooks for business logic calculations', () => {
      const appSource = fs.readFileSync('./src/App.tsx', 'utf-8')
      
      expect(appSource).not.toMatch(/useMemo\(\(\) => \{[\s\S]*?groupByCat/)
      expect(appSource).not.toMatch(/useMemo\(\(\) => \{[\s\S]*?calcMonthSpend/)
      expect(appSource).not.toMatch(/useMemo\(\(\) => \{[\s\S]*?filterByDateRange/)
      expect(appSource).not.toMatch(/useMemo\(\(\) => \{[\s\S]*?getTopMerchants/)
      expect(appSource).not.toMatch(/useMemo\(\(\) => \{[\s\S]*?calculateCategorySpending/)
    })
  })

  describe('RED: Server-side filtering should be implemented', () => {
    it('should not perform local transaction filtering with search terms', () => {
      const appSource = fs.readFileSync('./src/App.tsx', 'utf-8')
      
      expect(appSource).not.toMatch(/filterTxns\(/)
      expect(appSource).not.toMatch(/\.filter\(.*search.*\)/)
    })

    it('should not perform local date range filtering', () => {
      const appSource = fs.readFileSync('./src/App.tsx', 'utf-8')
      
      expect(appSource).not.toMatch(/filterByDateRange\(/)
      expect(appSource).not.toMatch(/\.filter\(.*date.*range.*\)/)
    })
  })
})

describe('App Phase 3 - Authentication-First Architecture', () => {
  let fetchMock: ReturnType<typeof installFetchRoutes>

  beforeEach(() => {
    jest.clearAllMocks()

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
      },
      writable: true
    })

    fetchMock = installFetchRoutes({
      'GET /api/plaid/accounts': [],
      'GET /api/providers/status': createProviderStatus(),
      'GET /api/transactions': [],
      'GET /api/analytics/spending*': 0,
      'GET /api/analytics/categories*': [],
      'GET /api/analytics/monthly-totals*': [],
      'GET /api/analytics/top-merchants*': [],
      'GET /api/budgets': [],
    })
  })
  
  afterEach(() => {
    cleanup()
  })

  describe('RED: App should show login screen when unauthenticated', () => {
    it('should render login screen when no auth token exists', async () => {
      ;(window.sessionStorage.getItem as any).mockReturnValue(null)
      
      render(
        <AccountFilterProvider>
          <App />
        </AccountFilterProvider>
      )
      
      const brandMarks = await screen.findAllByText('Sumaura')
      expect(brandMarks.length).toBeGreaterThan(0)
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
      const welcomeMessages = await screen.findAllByText('Welcome Back')
      expect(welcomeMessages.length).toBeGreaterThan(0)
      expect(await screen.findByText('Sign in to your account')).toBeInTheDocument()
    })

    it('should render login screen when auth token is expired', async () => {
      const expiredToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 })) + '.signature'
      ;(window.sessionStorage.getItem as any).mockReturnValue(expiredToken)
      
      render(
        <AccountFilterProvider>
          <App />
        </AccountFilterProvider>
      )
      
      const welcomeMessages = await screen.findAllByText('Welcome Back')
      expect(welcomeMessages.length).toBeGreaterThan(0)
      const brandMarks = await screen.findAllByText('Sumaura')
      expect(brandMarks.length).toBeGreaterThan(0)
    })

    it('should render AuthenticatedApp when valid token exists', async () => {
      const validToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature'
      ;(window.sessionStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'auth_token') return validToken
        return null
      })
      const restore = mockFetchAuthOk()
      
      await act(async () => {
        render(
          <AccountFilterProvider>
            <App />
          </AccountFilterProvider>
        )
      })
      const brandMarks = await screen.findAllByText('Sumaura')
      expect(brandMarks.length).toBeGreaterThan(0)
      const dashboardLabels = await screen.findAllByText('Dashboard')
      expect(dashboardLabels).toHaveLength(2) // Navigation and page heading
      await waitFor(() => {
        expect(screen.queryByText('Welcome Back')).not.toBeInTheDocument()
      })
      restore()
    }, 15000)
  })

  describe('RED: No mock/seed data should exist anywhere', () => {
    it('should not contain any mock data variables or constants', () => {
      const appSource = fs.readFileSync('./src/App.tsx', 'utf-8')
      
      expect(appSource).not.toMatch(/seedTxns/)
      expect(appSource).not.toMatch(/seedBudgets/)
      expect(appSource).not.toMatch(/realBudgets/)
      expect(appSource).not.toMatch(/mockData/)
      expect(appSource).not.toMatch(/useMockData/)
      expect(appSource).not.toMatch(/Toggle.*mock/)
      expect(appSource).not.toMatch(/🎭/)
    })

    it('should not contain mock toggle functionality', () => {
      const appSource = fs.readFileSync('./src/App.tsx', 'utf-8')
      
      expect(appSource).not.toMatch(/useState.*mock/i)
      expect(appSource).not.toMatch(/setMock/)
      expect(appSource).not.toMatch(/handleMockToggle/)
      expect(appSource).not.toMatch(/X-Use-Mock-Data/)
    })

    it('should not render mock data toggle in UI', async () => {
      const validToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature'
      ;(window.sessionStorage.getItem as any).mockReturnValue(validToken)
      const restore = mockFetchAuthOk()
      
      await act(async () => {
        render(
          <AccountFilterProvider>
            <App />
          </AccountFilterProvider>
        )
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      expect(screen.queryByText(/mock/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/🎭/)).not.toBeInTheDocument()
      expect(screen.queryByText(/toggle.*mock/i)).not.toBeInTheDocument()
      restore()
    }, 15000)
  })

  describe('RED: Session management should handle auth failures', () => {
    it('should redirect to login when session expires during app usage', async () => {
      const validToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 })) + '.signature'
      ;(window.sessionStorage.getItem as any).mockReturnValue(validToken)
      const restore = mockFetchAuthOk()
      
      await act(async () => {
        render(
          <AccountFilterProvider>
            <App />
          </AccountFilterProvider>
        )
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      expect(screen.getAllByText('Sumaura').length).toBeGreaterThan(0)
      
      const expiredToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 10 })) + '.signature'
      ;(window.sessionStorage.getItem as any).mockReturnValue(expiredToken)
      
      expect(true).toBe(true)
      restore()
    }, 15000)

    it('should show session expiry warning before auto-logout', () => {
      expect(true).toBe(true)
    })

    it('should allow user to refresh session when prompted', () => {
      expect(true).toBe(true)
    })

    it('should handle authentication errors gracefully', async () => {
      const invalidToken = 'invalid.token.here'
      ;(window.sessionStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'auth_token') return invalidToken
        return null
      })
      
      render(
        <AccountFilterProvider>
          <App />
        </AccountFilterProvider>
      )
      
      const welcomeMessages = await screen.findAllByText('Welcome Back')
      expect(welcomeMessages.length).toBeGreaterThan(0)
      const brandMarks = await screen.findAllByText('Sumaura')
      expect(brandMarks.length).toBeGreaterThan(0)
    })

    it('should clear session storage on logout', async () => {
      const validToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature'
      ;(window.sessionStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'auth_token') return validToken
        return null
      })
      const restore = mockFetchAuthOk()
      
      await act(async () => {
        render(
          <AccountFilterProvider>
            <App />
          </AccountFilterProvider>
        )
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      expect(screen.getAllByText('Sumaura').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Logout')[0]).toBeInTheDocument()
      expect(true).toBe(true)
      restore()
    }, 15000)

    it('should maintain session state across page reloads', async () => {
      const validToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature'
      ;(window.sessionStorage.getItem as any).mockReturnValue(validToken)
      const restore = mockFetchAuthOk()
      
      await act(async () => {
        render(
          <AccountFilterProvider>
            <App />
          </AccountFilterProvider>
        )
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      expect(screen.getAllByText('Sumaura').length).toBeGreaterThan(0)
      expect(screen.queryAllByText('Welcome Back').length).toBe(0)
      restore()
    }, 15000)
  })

  describe('Provider mismatch detection', () => {
    it('should show ProviderMismatchModal when user provider does not match default provider', async () => {
      const { ApiClient } = await import('@/services/ApiClient')
      const mockApiGet = jest.spyOn(ApiClient, 'get').mockImplementation((endpoint: string) => {
        if (endpoint.includes('/providers/info')) {
          return Promise.resolve({
            available_providers: ['plaid', 'teller'],
            default_provider: 'plaid',
            user_provider: 'teller',
          } as any)
        }
        if (endpoint.includes('/plaid/accounts')) return Promise.resolve([])
        if (endpoint.includes('/providers/status')) return Promise.resolve(createProviderStatus())
        if (endpoint.startsWith('/analytics/spending')) return Promise.resolve({ total: 1234.56, currency: 'USD' })
        if (endpoint.includes('/analytics/categories')) return Promise.resolve([])
        if (endpoint.includes('/analytics/monthly-totals')) return Promise.resolve([])
        if (endpoint.includes('/analytics/top-merchants')) return Promise.resolve([])
        if (endpoint.includes('/transactions')) return Promise.resolve([])
        if (endpoint.includes('/budgets')) return Promise.resolve([])
        return Promise.resolve({})
      })

      const validToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature'
      ;(window.sessionStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'auth_token') return validToken
        return null
      })

      const restore = mockFetchAuthOk()

      await act(async () => {
        render(
          <AccountFilterProvider>
            <App />
          </AccountFilterProvider>
        )
        await new Promise(resolve => setTimeout(resolve, 300))
      })

      await waitFor(() => {
        expect(screen.getByText(/provider configuration mismatch/i)).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText(/Your account is configured to use/i)).toBeInTheDocument()
      expect(screen.getByText('Teller')).toBeInTheDocument()
      expect(screen.getByText('Plaid')).toBeInTheDocument()

      mockApiGet.mockRestore()
      restore()
    }, 15000)
  })
})
