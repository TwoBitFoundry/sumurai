import { renderHook, act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { useBudgets } from '@/features/budgets/hooks/useBudgets'
import { BudgetService } from '@/services/BudgetService'
import { TransactionService } from '@/services/TransactionService'

vi.mock('@/services/BudgetService', () => ({
  BudgetService: {
    getBudgets: vi.fn(),
    createBudget: vi.fn(),
    updateBudget: vi.fn(),
    deleteBudget: vi.fn(),
  }
}))

vi.mock('@/services/TransactionService', () => ({
  TransactionService: {
    getTransactions: vi.fn(),
  }
}))

const asBudget = (id: string, category: string, amount: number) => ({ id, category, amount })
const asTransaction = (id: string, categoryId: string, amount: number, date = '2024-02-10') => ({
  id,
  date,
  name: 'Txn',
  merchant: 'Store',
  amount,
  category: { id: categoryId, name: categoryId },
  account_name: 'Checking',
  account_type: 'depository',
  account_mask: '1234',
})

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useBudgets', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(BudgetService.getBudgets).mockResolvedValue([] as any)
    vi.mocked(TransactionService.getTransactions).mockResolvedValue([] as any)
  })

  it('loads budgets once, aggregates transactions, and exposes derived data', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([
      asBudget('1', 'groceries', 300),
      asBudget('2', 'entertainment', 150),
    ] as any)
    vi.mocked(TransactionService.getTransactions).mockResolvedValueOnce([
      asTransaction('t1', 'groceries', 120, '2024-02-05'),
      asTransaction('t2', 'entertainment', 60, '2024-02-12'),
      asTransaction('t3', 'groceries', 30, '2024-02-15'),
    ] as any)

    const { result } = renderHook(() => useBudgets())

    await act(async () => {
      result.current.setMonth(new Date(2024, 1, 1))
    })

    await act(async () => { await result.current.load() })

    const groceries = result.current.computedBudgets.find(b => b.category === 'groceries')
    const entertainment = result.current.computedBudgets.find(b => b.category === 'entertainment')

    expect(result.current.budgets).toHaveLength(2)
    expect(groceries?.spent).toBe(150)
    expect(entertainment?.percentage).toBeCloseTo(40)
    expect(result.current.categoryOptions).toEqual(['entertainment', 'groceries'])
    expect(result.current.usedCategories.has('groceries')).toBe(true)
    expect(result.current.usedCategories.has('entertainment')).toBe(true)
  })

  it('guards against duplicate budget loads but refetches transactions for month changes', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([asBudget('1', 'groceries', 100)] as any)

    const { result } = renderHook(() => useBudgets())

    await act(async () => {
      result.current.setMonth(new Date(2024, 1, 1))
    })

    await act(async () => { await result.current.load() })
    await act(async () => { await result.current.load() })

    expect(BudgetService.getBudgets).toHaveBeenCalledTimes(1)

    vi.mocked(TransactionService.getTransactions).mockClear()
    vi.mocked(TransactionService.getTransactions).mockResolvedValueOnce([] as any)

    await act(async () => {
      result.current.setMonth(new Date(2024, 2, 1))
    })

    await waitFor(() => {
      expect(TransactionService.getTransactions).toHaveBeenCalledTimes(1)
    })

    const args = vi.mocked(TransactionService.getTransactions).mock.calls[0][0]
    expect(args).toMatchObject({ startDate: '2024-03-01', endDate: '2024-03-31' })
  })

  it('toggles transactionsLoading while fetching transactions', async () => {
    const deferred = createDeferred<any[]>()
    vi.mocked(TransactionService.getTransactions).mockReturnValueOnce(deferred.promise as any)

    const { result } = renderHook(() => useBudgets())

    await act(async () => {
      result.current.setMonth(new Date(2024, 1, 1))
    })

    let loadPromise: Promise<void> | undefined
    await act(async () => {
      loadPromise = result.current.load()
    })

    await waitFor(() => {
      expect(result.current.transactionsLoading).toBe(true)
    })

    deferred.resolve([])

    await act(async () => {
      await loadPromise
    })

    expect(result.current.transactionsLoading).toBe(false)
  })

  it('optimistically creates a budget and reconciles on success', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([] as any)
    vi.mocked(BudgetService.createBudget).mockResolvedValueOnce(asBudget('server-1', 'groceries', 200) as any)

    const { result } = renderHook(() => useBudgets())
    await act(async () => {
      result.current.setMonth(new Date(2024, 1, 1))
    })
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.add('groceries', 200) })

    expect(result.current.budgets).toHaveLength(1)
    expect(result.current.budgets[0].id).toBe('server-1')
    expect(result.current.error).toBeNull()
  })

  it('rolls back optimistic create on failure', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([] as any)
    vi.mocked(BudgetService.createBudget).mockRejectedValueOnce(Object.assign(new Error('fail'), { status: 500 }))

    const { result } = renderHook(() => useBudgets())
    await act(async () => {
      result.current.setMonth(new Date(2024, 1, 1))
    })
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.add('groceries', 200).catch(() => {}) })

    expect(result.current.budgets).toHaveLength(0)
    expect(result.current.error).toBe('Failed to create budget.')
  })

  it('validates duplicate categories', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([asBudget('1', 'groceries', 100)] as any)

    const { result } = renderHook(() => useBudgets())
    await act(async () => {
      result.current.setMonth(new Date(2024, 1, 1))
    })
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.add('groceries', 200).catch(() => {}) })

    expect(BudgetService.createBudget).not.toHaveBeenCalled()
    expect(result.current.validationError).toBe('A budget for "groceries" already exists.')
  })

  it('optimistically updates and reconciles on success', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([asBudget('1', 'groceries', 100)] as any)
    vi.mocked(BudgetService.updateBudget).mockResolvedValueOnce(asBudget('1', 'groceries', 250) as any)

    const { result } = renderHook(() => useBudgets())
    await act(async () => {
      result.current.setMonth(new Date(2024, 1, 1))
    })
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.update('1', 250) })

    expect(result.current.budgets[0].amount).toBe(250)
    expect(result.current.error).toBeNull()
  })

  it('rolls back update on failure', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([asBudget('1', 'groceries', 100)] as any)
    vi.mocked(BudgetService.updateBudget).mockRejectedValueOnce(Object.assign(new Error('fail'), { status: 500 }))

    const { result } = renderHook(() => useBudgets())
    await act(async () => {
      result.current.setMonth(new Date(2024, 1, 1))
    })
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.update('1', 250).catch(() => {}) })

    expect(result.current.budgets[0].amount).toBe(100)
    expect(result.current.error).toBe('Failed to update budget.')
  })

  it('optimistically deletes and keeps empty on success', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([asBudget('1', 'groceries', 100)] as any)
    vi.mocked(BudgetService.deleteBudget).mockResolvedValueOnce(undefined as any)

    const { result } = renderHook(() => useBudgets())
    await act(async () => {
      result.current.setMonth(new Date(2024, 1, 1))
    })
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.remove('1') })

    expect(result.current.budgets).toHaveLength(0)
    expect(result.current.error).toBeNull()
  })

  it('rolls back delete on failure', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([asBudget('1', 'groceries', 100)] as any)
    vi.mocked(BudgetService.deleteBudget).mockRejectedValueOnce(Object.assign(new Error('fail'), { status: 500 }))

    const { result } = renderHook(() => useBudgets())
    await act(async () => {
      result.current.setMonth(new Date(2024, 1, 1))
    })
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.remove('1').catch(() => {}) })

    expect(result.current.budgets).toHaveLength(1)
    expect(result.current.error).toBe('Failed to delete budget.')
  })
})
