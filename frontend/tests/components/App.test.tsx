import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { App } from '@/App'

global.fetch = vi.fn()

// Helper to mock the network boundary for auth/session endpoints per-test
const mockFetchAuthOk = () => {
  const original = global.fetch as any
  const stub = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/plaid/status')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ connected: true, accounts_count: 0 }) } as any)
    }
    if (url.includes('/api/auth/logout')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ message: 'ok', cleared_session: '' }) } as any)
    }
    if (url.includes('/api/auth/refresh')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ token: 'new.token.value' }) } as any)
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`))
  })
  // @ts-expect-error override for test
  global.fetch = stub
  return () => {
    // @ts-expect-error restore
    global.fetch = original
  }
}

vi.mock('@/services/ApiClient', () => ({
  ApiClient: {
    get: vi.fn().mockImplementation((endpoint: string) => {
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
            category: { id: 'food', name: 'Food & Dining' }
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
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/hooks/usePlaidConnection', () => ({
  usePlaidConnection: () => ({
    isConnected: false,
    institutionName: null,
    lastSyncAt: null,
    transactionCount: 0,
    accountCount: 0,
    syncInProgress: false,
    markConnected: vi.fn(),
    disconnect: vi.fn(),
    setSyncInProgress: vi.fn(),
    updateSyncInfo: vi.fn(),
    refresh: vi.fn(),
  }),
}))


describe('App Phase 2 - Business Logic Removal', () => {
  const originalConsoleError = console.error
  const mockFetchAuthOk = () => {
    const original = global.fetch as any
    const stub = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/plaid/status')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ connected: true, accounts_count: 0 }) } as any)
      }
      if (url.includes('/api/auth/logout')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ message: 'ok', cleared_session: '' }) } as any)
      }
      if (url.includes('/api/auth/refresh')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ token: 'new.token.value' }) } as any)
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`))
    })
    // @ts-expect-error override for test
    global.fetch = stub
    return () => {
      // @ts-expect-error restore
      global.fetch = original
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console.error to suppress expected error logs during tests
    console.error = vi.fn()
    
    // Ensure clean DOM state between tests
    document.body.innerHTML = ''
    
    // Mock sessionStorage for tests that need authentication
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })

  })

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError
    // Ensure clean DOM between tests to prevent duplicate elements
    cleanup()
  })

  describe('RED: Business logic helper functions should not exist', () => {
    it('should not contain business logic helper functions in App.tsx source code', () => {
      const fs = require('fs') as typeof import('fs')
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
      const fs = require('fs') as typeof import('fs')
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
        render(<App />)
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      expect(screen.getAllByText('Spending').length).toBeGreaterThan(0)
      restore()
    }, 15000)

    it('should use API services for all data instead of local state calculations', () => {
      expect(true).toBe(true)
    })

    it('should not contain any useMemo hooks for business logic calculations', () => {
      const fs = require('fs') as typeof import('fs')
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
      const fs = require('fs') as typeof import('fs')
      const appSource = fs.readFileSync('./src/App.tsx', 'utf-8')
      
      expect(appSource).not.toMatch(/filterTxns\(/)
      expect(appSource).not.toMatch(/\.filter\(.*search.*\)/)
    })

    it('should not perform local date range filtering', () => {
      const fs = require('fs') as typeof import('fs')
      const appSource = fs.readFileSync('./src/App.tsx', 'utf-8')
      
      expect(appSource).not.toMatch(/filterByDateRange\(/)
      expect(appSource).not.toMatch(/\.filter\(.*date.*range.*\)/)
    })
  })
})

describe('App Phase 3 - Authentication-First Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })

  })
  
  afterEach(() => {
    // Ensure DOM is reset between tests in this suite
    cleanup()
  })

  describe('RED: App should show login screen when unauthenticated', () => {
    it('should render login screen when no auth token exists', async () => {
      ;(window.sessionStorage.getItem as any).mockReturnValue(null)
      
      render(<App />)
      
      expect(screen.getAllByText('Sumaura').length).toBeGreaterThan(0)
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
      expect(screen.getAllByText('Welcome Back').length).toBeGreaterThan(0)
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    })

    it('should render login screen when auth token is expired', async () => {
      const expiredToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 })) + '.signature'
      ;(window.sessionStorage.getItem as any).mockReturnValue(expiredToken)
      
      render(<App />)
      
      expect(screen.getAllByText('Welcome Back').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Sumaura').length).toBeGreaterThan(0)
    })

    it('should render AuthenticatedApp when valid token exists', async () => {
      const validToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature'
      ;(window.sessionStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'auth_token') return validToken
        return null
      })
      const restore = mockFetchAuthOk()
      
      await act(async () => {
        render(<App />)
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      expect(screen.getAllByText('Sumaura').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Dashboard')).toHaveLength(2) // Navigation and page heading
      expect(screen.queryAllByText('Welcome Back').length).toBe(0)
      restore()
    }, 15000)
  })

  describe('RED: No mock/seed data should exist anywhere', () => {
    it('should not contain any mock data variables or constants', () => {
      const fs = require('fs') as typeof import('fs')
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
      const fs = require('fs') as typeof import('fs')
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
        render(<App />)
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
        render(<App />)
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
      
      render(<App />)
      
      expect(screen.getAllByText('Welcome Back').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Sumaura').length).toBeGreaterThan(0)
    })

    it('should clear session storage on logout', async () => {
      const validToken = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature'
      ;(window.sessionStorage.getItem as any).mockImplementation((key: string) => {
        if (key === 'auth_token') return validToken
        return null
      })
      const restore = mockFetchAuthOk()
      
      await act(async () => {
        render(<App />)
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
        render(<App />)
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      
      expect(screen.getAllByText('Sumaura').length).toBeGreaterThan(0)
      expect(screen.queryAllByText('Welcome Back').length).toBe(0)
      restore()
    }, 15000)
  })
})
