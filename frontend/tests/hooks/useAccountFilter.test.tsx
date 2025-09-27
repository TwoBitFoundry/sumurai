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
          official_name: 'Chase Premier Checking',
          type: 'depository',
          subtype: 'checking',
          balance: 1250.50,
          institution_name: 'Chase Bank'
        },
        {
          id: 'acc_2',
          name: 'Chase Savings',
          official_name: 'Chase Premier Savings',
          type: 'depository',
          subtype: 'savings',
          balance: 5000.00,
          institution_name: 'Chase Bank'
        },
        {
          id: 'acc_3',
          name: 'Wells Fargo Credit Card',
          official_name: 'Wells Fargo Platinum Card',
          type: 'credit',
          subtype: 'credit_card',
          balance: -350.75,
          institution_name: 'Wells Fargo'
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
          expect(result.current.accountsByBank).toHaveProperty('Chase Bank')
        })

        expect(result.current.accountsByBank).toHaveProperty('Chase Bank')
        expect(result.current.accountsByBank).toHaveProperty('Wells Fargo')
        expect(result.current.accountsByBank['Chase Bank']).toHaveLength(2)
        expect(result.current.accountsByBank['Wells Fargo']).toHaveLength(1)
      })

      it('Then it should support select all action', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        )

        const { result } = renderHook(() => useAccountFilter(), { wrapper })

        await waitFor(() => {
          expect(result.current.accountsByBank).toHaveProperty('Chase Bank')
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
          expect(result.current.accountsByBank).toHaveProperty('Chase Bank')
        })

        act(() => {
          result.current.toggleBank('Chase Bank')
        })

        expect(result.current.isAllAccountsSelected).toBe(false)
        expect(result.current.selectedAccountIds).toEqual(['acc_1', 'acc_2'])
      })

      it('Then it should support toggle individual account action', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <AccountFilterProvider>{children}</AccountFilterProvider>
        )

        const { result } = renderHook(() => useAccountFilter(), { wrapper })

        await waitFor(() => {
          expect(result.current.accountsByBank).toHaveProperty('Chase Bank')
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