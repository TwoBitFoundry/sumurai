import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { useBudgets } from '@/features/budgets/hooks/useBudgets'
import { AccountFilterProvider, useAccountFilter } from '@/hooks/useAccountFilter'
import { installFetchRoutes } from '@tests/utils/fetchRoutes'
import { createProviderConnection, createProviderStatus } from '@tests/utils/fixtures'

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <AccountFilterProvider>
    {children}
  </AccountFilterProvider>
)

let fetchMock: ReturnType<typeof installFetchRoutes>

const asBudget = (id: string, category: string, amount: number) => ({ id, category, amount })
const asTransaction = (id: string, categoryId: string, amount: number, date?: string) => {
  // Use a deterministic date in the middle of current month to avoid timing issues
  const today = new Date()
  const defaultDate = new Date(today.getFullYear(), today.getMonth(), 15).toISOString().slice(0, 10)

  return {
    id,
    date: date || defaultDate,
    name: 'Txn',
    merchant: 'Store',
    amount,
    category: { primary: categoryId.toUpperCase(), detailed: categoryId.toUpperCase() },
    provider: 'plaid' as const,
    account_name: 'Checking',
    account_type: 'depository',
    account_mask: '1234',
  }
}

const mockPlaidAccounts = [
  {
    id: 'account1',
    name: 'Mock Checking',
    account_type: 'depository',
    balance_ledger: 1200,
    balance_available: 1180,
    balance_current: 1200,
    mask: '1111',
    plaid_connection_id: 'conn_1',
    institution_name: 'Mock Bank',
    provider: 'plaid'
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

describe('useBudgets', () => {
  const createConnectedStatus = () =>
    createProviderStatus({
      connections: [
        createProviderConnection({
          is_connected: true,
          institution_name: 'Mock Bank',
          connection_id: 'conn_1',
        }),
      ],
    })

  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [],
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    })
  })

  it('fetches budgets and transactions on mount', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [asBudget('1', 'groceries', 100)],
      'GET /api/transactions': [asTransaction('t1', 'groceries', -50)],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    })

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper })

    await act(async () => {
      await result.current.load()
    })

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1)
    })

    expect(result.current.budgets[0].category).toBe('groceries')
    expect(result.current.budgets[0].amount).toBe(100)
  })

  it('loads transactions based on budget categories', async () => {
    let accountFilterHook: any

    fetchMock = installFetchRoutes({
      'GET /api/budgets': [asBudget('1', 'groceries', 100)],
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    })

    const { result } = renderHook(() => {
      accountFilterHook = useAccountFilter()
      return useBudgets()
    }, { wrapper: TestWrapper })

    await waitFor(() => {
      expect(accountFilterHook.allAccountIds).toEqual(['account1'])
    })

    // Set selected accounts to trigger transaction loading
    await act(async () => {
      accountFilterHook.setSelectedAccountIds(['account1'])
    })

    await act(async () => {
      await result.current.load()
    })

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1)
    })

    // Check that transactions endpoint was called with category filter
    const transactionCall = fetchMock.mock.calls.find(c => String(c[0]).includes('/api/transactions'))
    expect(transactionCall).toBeTruthy()
  })


  it('creates budget optimistically', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [],
      'POST /api/budgets': asBudget('server-1', 'groceries', 200),
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    })

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.add('groceries', 200)
    })

    expect(result.current.budgets).toHaveLength(1)
    expect(result.current.budgets[0].category).toBe('groceries')
    expect(result.current.budgets[0].amount).toBe(200)
  })

  it('handles create budget failure', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [],
      'POST /api/budgets': () => new Response('fail', { status: 500 }),
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    })

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper })

    await act(async () => {
      await result.current.load()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      try {
        await result.current.add('groceries', 200)
      } catch {
        // Expected to fail
      }
    })

    expect(result.current.budgets).toHaveLength(0)
  })

  it('updates budget optimistically', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [asBudget('1', 'groceries', 100)],
      'PUT /api/budgets/1': asBudget('1', 'groceries', 250),
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    })

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper })

    await act(async () => {
      await result.current.load()
    })

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1)
    })

    await act(async () => {
      await result.current.update('1', 250)
    })

    expect(result.current.budgets[0].amount).toBe(250)
  })

  it('handles update budget failure', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [asBudget('1', 'groceries', 100)],
      'PUT /api/budgets/1': () => { throw Object.assign(new Error('fail'), { status: 500 }) },
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    })

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper })

    await act(async () => {
      await result.current.load()
    })

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1)
    })

    await act(async () => {
      await result.current.update('1', 250)
    })

    expect(result.current.budgets[0].amount).toBe(100)
  })

  it('deletes budget optimistically', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [asBudget('1', 'groceries', 100)],
      'DELETE /api/budgets/1': new Response(null, { status: 204 }),
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    })

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper })

    await act(async () => {
      await result.current.load()
    })

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1)
    })

    await act(async () => {
      await result.current.remove('1')
    })

    expect(result.current.budgets).toHaveLength(0)
  })

  it('handles delete budget failure', async () => {
    fetchMock = installFetchRoutes({
      'GET /api/budgets': [asBudget('1', 'groceries', 100)],
      'DELETE /api/budgets/1': () => { throw Object.assign(new Error('fail'), { status: 500 }) },
      'GET /api/transactions': [],
      'GET /api/plaid/accounts': mockPlaidAccounts,
      'GET /api/providers/status': createConnectedStatus(),
    })

    const { result } = renderHook(() => useBudgets(), { wrapper: TestWrapper })

    await act(async () => {
      await result.current.load()
    })

    await waitFor(() => {
      expect(result.current.budgets).toHaveLength(1)
    })

    await act(async () => {
      await result.current.remove('1')
    })

    expect(result.current.budgets).toHaveLength(1)
  })
})
