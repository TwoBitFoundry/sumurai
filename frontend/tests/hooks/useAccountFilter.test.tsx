import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup, act, waitFor } from '@testing-library/react'
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter'
import { installFetchRoutes } from '@tests/utils/fetchRoutes'

describe('AccountFilterProvider', () => {
  let fetchMock: ReturnType<typeof installFetchRoutes>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    fetchMock = installFetchRoutes({
      'GET /api/plaid/accounts': [
        {
          id: 'acc_1',
          name: 'Chase Checking',
          account_type: 'depository',
          balance_current: 1250.50,
          mask: '0000'
        },
        {
          id: 'acc_2',
          name: 'Chase Savings',
          account_type: 'depository',
          balance_current: 5000.00,
          mask: '1111'
        },
        {
          id: 'acc_3',
          name: 'Wells Fargo Credit Card',
          account_type: 'credit',
          balance_current: -350.75,
          mask: '2222'
        }
      ]
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Given the provider is initialized', () => {
    describe('When no custom selection is made', () => {
      it('Then it should default to "All accounts" selection', () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        )

        const { result } = renderHook(() => useAccountFilter(), { wrapper })

        expect(result.current.isAllAccountsSelected).toBe(true)
        expect(result.current.selectedAccountIds).toEqual([])
      })
    })

    describe('When checking current selection state', () => {
      it('Then it should expose current selection state', () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        )

        const { result } = renderHook(() => useAccountFilter(), { wrapper })

        expect(result.current.isAllAccountsSelected).toBeDefined()
        expect(result.current.selectedAccountIds).toBeDefined()
        expect(Array.isArray(result.current.selectedAccountIds)).toBe(true)
      })
    })

    describe('When account metadata is available', () => {
      it('Then it should expose grouped account metadata by bank', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        )

        const { result } = renderHook(() => useAccountFilter(), { wrapper })

        await waitFor(() => {
          expect(result.current.accountsByBank).toHaveProperty('Bank')
        })

        expect(result.current.accountsByBank).toHaveProperty('Bank')
        expect(result.current.accountsByBank['Bank']).toHaveLength(3)
      })

      it('Then it should support select all action', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        )

        const { result } = renderHook(() => useAccountFilter(), { wrapper })

        await waitFor(() => {
          expect(result.current.accountsByBank).toHaveProperty('Bank')
        })

        act(() => {
          result.current.selectAllAccounts()
        })

        expect(result.current.isAllAccountsSelected).toBe(true)
        expect(result.current.selectedAccountIds).toEqual([])
      })

      it('Then it should support toggle bank action', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        )

        const { result } = renderHook(() => useAccountFilter(), { wrapper })

        await waitFor(() => {
          expect(result.current.accountsByBank).toHaveProperty('Bank')
        })

        act(() => {
          result.current.toggleBank('Bank')
        })

        expect(result.current.isAllAccountsSelected).toBe(false)
        expect(result.current.selectedAccountIds).toEqual(['acc_1', 'acc_2', 'acc_3'])
      })

      it('Then it should support toggle individual account action', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        )

        const { result } = renderHook(() => useAccountFilter(), { wrapper })

        await waitFor(() => {
          expect(result.current.accountsByBank).toHaveProperty('Bank')
        })

        act(() => {
          result.current.toggleAccount('acc_1')
        })

        expect(result.current.isAllAccountsSelected).toBe(false)
        expect(result.current.selectedAccountIds).toEqual(['acc_1'])
      })
    })
  })
})