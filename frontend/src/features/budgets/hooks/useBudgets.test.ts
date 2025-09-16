import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useBudgets } from './useBudgets'
import { BudgetService } from '../../../services/BudgetService'

vi.mock('../../../services/BudgetService', () => ({
  BudgetService: {
    getBudgets: vi.fn(),
    createBudget: vi.fn(),
    updateBudget: vi.fn(),
    deleteBudget: vi.fn(),
  }
}))

describe('useBudgets', () => {
  const asBudget = (id: string, category: string, amount: number) => ({ id, category, amount })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('loads budgets on load()', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValue([
      asBudget('1', 'groceries', 300),
      asBudget('2', 'entertainment', 150),
    ] as any)

    const { result } = renderHook(() => useBudgets())

    await act(async () => { await result.current.load() })

    expect(result.current.budgets).toHaveLength(2)
    expect(result.current.budgets[0].category).toBe('groceries')
    expect(result.current.error).toBeNull()
  })

  it('optimistically creates a budget and reconciles on success', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([] as any)
    vi.mocked(BudgetService.createBudget).mockResolvedValueOnce(asBudget('server-1', 'groceries', 200) as any)

    const { result } = renderHook(() => useBudgets())
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
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.add('groceries', 200).catch(() => {}) })

    expect(result.current.budgets).toHaveLength(0)
    expect(result.current.error).toBe('Failed to create budget.')
  })

  it('validates duplicate categories', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([asBudget('1', 'groceries', 100)] as any)

    const { result } = renderHook(() => useBudgets())
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.add('groceries', 200).catch(() => {}) })

    expect(BudgetService.createBudget).not.toHaveBeenCalled()
    expect(result.current.validationError).toBe('A budget for "groceries" already exists.')
  })

  it('optimistically updates and reconciles on success', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([asBudget('1', 'groceries', 100)] as any)
    vi.mocked(BudgetService.updateBudget).mockResolvedValueOnce(asBudget('1', 'groceries', 250) as any)

    const { result } = renderHook(() => useBudgets())
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.update('1', 250) })

    expect(result.current.budgets[0].amount).toBe(250)
    expect(result.current.error).toBeNull()
  })

  it('rolls back update on failure', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([asBudget('1', 'groceries', 100)] as any)
    vi.mocked(BudgetService.updateBudget).mockRejectedValueOnce(Object.assign(new Error('fail'), { status: 500 }))

    const { result } = renderHook(() => useBudgets())
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.update('1', 250).catch(() => {}) })

    expect(result.current.budgets[0].amount).toBe(100)
    expect(result.current.error).toBe('Failed to update budget.')
  })

  it('optimistically deletes and keeps empty on success', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([asBudget('1', 'groceries', 100)] as any)
    vi.mocked(BudgetService.deleteBudget).mockResolvedValueOnce(undefined as any)

    const { result } = renderHook(() => useBudgets())
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.remove('1') })

    expect(result.current.budgets).toHaveLength(0)
    expect(result.current.error).toBeNull()
  })

  it('rolls back delete on failure', async () => {
    vi.mocked(BudgetService.getBudgets).mockResolvedValueOnce([asBudget('1', 'groceries', 100)] as any)
    vi.mocked(BudgetService.deleteBudget).mockRejectedValueOnce(Object.assign(new Error('fail'), { status: 500 }))

    const { result } = renderHook(() => useBudgets())
    await act(async () => { await result.current.load() })

    await act(async () => { await result.current.remove('1').catch(() => {}) })

    expect(result.current.budgets).toHaveLength(1)
    expect(result.current.error).toBe('Failed to delete budget.')
  })
})

