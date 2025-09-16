import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Budget } from '../../../types/api'
import { BudgetService } from '../../../services/BudgetService'
import { optimisticCreate } from '../../../utils/optimistic'

export interface UseBudgetsResult {
  isLoading: boolean
  error: string | null
  validationError: string | null
  budgets: Budget[]
  load: () => Promise<void>
  add: (category: string, amount: number) => Promise<void>
  update: (id: string, amount: number) => Promise<void>
  remove: (id: string) => Promise<void>
  categories: string[]
}

export function useBudgets(): UseBudgetsResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [budgets, setBudgets] = useState<Budget[]>([])

  const loadedRef = useRef(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (loadedRef.current && budgets.length > 0) return
      const list = await BudgetService.getBudgets()
      setBudgets(list)
      loadedRef.current = true
    } catch (e: any) {
      setBudgets([])
      const status = typeof e?.status === 'number' ? e.status : undefined
      if (status === 401) setError('You are not authenticated. Please log in again.')
      else setError('Failed to load budgets.')
    } finally {
      setIsLoading(false)
    }
  }, [budgets.length])

  const categories = useMemo(() => budgets.map(b => b.category).sort(), [budgets])

  const add = useCallback(async (category: string, amount: number) => {
    setValidationError(null)
    setError(null)
    const exists = budgets.some(b => (b.category || '').toLowerCase() === (category || '').toLowerCase())
    if (exists) {
      const msg = `A budget for "${category}" already exists.`
      setValidationError(msg)
      return Promise.reject(new Error(msg))
    }
    const temp: Budget = { id: generateId(), category, amount }
    try {
      await optimisticCreate(setBudgets, temp, () => BudgetService.createBudget({ category, amount }))
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : undefined
      const msg = status === 409
        ? `A budget for "${category}" already exists.`
        : status === 401
          ? 'You are not authenticated. Please log in again.'
          : 'Failed to create budget.'
      setError(msg)
      throw e
    }
  }, [budgets])

  const update = useCallback(async (id: string, amount: number) => {
    setError(null)
    const snapshot = budgets
    setBudgets(prev => prev.map(b => (b.id === id ? { ...b, amount } : b)))
    try {
      const updated = await BudgetService.updateBudget(id, { amount })
      setBudgets(prev => prev.map(b => (b.id === id ? updated : b)))
    } catch (e: any) {
      setBudgets(snapshot)
      const status = typeof e?.status === 'number' ? e.status : undefined
      const msg = status === 401
        ? 'You are not authenticated. Please log in again.'
        : 'Failed to update budget.'
      setError(msg)
    }
  }, [budgets])

  const remove = useCallback(async (id: string) => {
    setError(null)
    const snapshot = budgets
    setBudgets(prev => prev.filter(b => b.id !== id))
    try {
      await BudgetService.deleteBudget(id)
    } catch (e: any) {
      setBudgets(snapshot)
      const status = typeof e?.status === 'number' ? e.status : undefined
      const msg = status === 401
        ? 'You are not authenticated. Please log in again.'
        : 'Failed to delete budget.'
      setError(msg)
    }
  }, [budgets])

  return { isLoading, error, validationError, budgets, load, add, update, remove, categories }
}

function generateId(): string {
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto && (globalThis.crypto as any).randomUUID) {
    return (globalThis.crypto as any).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
