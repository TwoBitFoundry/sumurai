import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Budget, Transaction } from '../../../types/api'
import { BudgetService } from '../../../services/BudgetService'
import { TransactionService } from '../../../services/TransactionService'
import { useAccountFilter } from '../../../hooks/useAccountFilter'
import { optimisticCreate } from '../../../utils/optimistic'
import { BudgetCalculator } from '../../../domain/BudgetCalculator'

export interface BudgetProgressEntry extends Budget {
  spent: number
  percentage: number
}

export interface UseBudgetsResult {
  isLoading: boolean
  transactionsLoading: boolean
  error: string | null
  validationError: string | null
  budgets: Budget[]
  computedBudgets: BudgetProgressEntry[]
  load: () => Promise<void>
  add: (category: string, amount: number) => Promise<void>
  update: (id: string, amount: number) => Promise<void>
  remove: (id: string) => Promise<void>
  categories: string[]
  categoryOptions: string[]
  usedCategories: Set<string>
  month: Date
  monthLabel: string
  range: { start: string; end: string }
  setMonth: (month: Date) => void
  goToPreviousMonth: () => void
  goToNextMonth: () => void
  goToCurrentMonth: () => void
}

export function useBudgets(): UseBudgetsResult {
  const [isLoading, setIsLoading] = useState(false)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [month, setMonthState] = useState(() => normalizeMonth(new Date()))
  const [budgetsReady, setBudgetsReady] = useState(false)

  const { selectedAccountIds, isAllAccountsSelected, allAccountIds, loading: accountsLoading } = useAccountFilter()

  const loadedRef = useRef(false)
  const lastRangeRef = useRef<string | null>(null)
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }), [])

  const range = useMemo(() => getMonthRange(month), [month])
  const monthLabel = useMemo(() => monthFormatter.format(month), [month, monthFormatter])

  const loadTransactions = useCallback(async (start: string, end: string) => {
    const shouldFilter = selectedAccountIds.length > 0 && !isAllAccountsSelected
    const keySuffix = selectedAccountIds.length === 0 && allAccountIds.length > 0
      ? 'none'
      : shouldFilter
        ? selectedAccountIds.join(',')
        : 'all'

    const key = `${start}:${end}:${keySuffix}`
    lastRangeRef.current = key

    if (accountsLoading) {
      return
    }

    if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
      setTransactions([])
      return
    }

    const accountIds = shouldFilter ? selectedAccountIds : undefined
    setTransactionsLoading(true)
    try {
      const items = await TransactionService.getTransactions({ startDate: start, endDate: end, accountIds })
      setTransactions(items)
    } catch {
      setTransactions([])
    } finally {
      setTransactionsLoading(false)
    }
  }, [allAccountIds, isAllAccountsSelected, selectedAccountIds, accountsLoading])

  const load = useCallback(async () => {
    setError(null)
    setValidationError(null)

    let shouldFetchTransactions = true

    if (!loadedRef.current) {
      setIsLoading(true)
      try {
        const list = await BudgetService.getBudgets()
        setBudgets(list)
        loadedRef.current = true
        setBudgetsReady(true)
      } catch (error: unknown) {
        setBudgets([])
        loadedRef.current = false
        shouldFetchTransactions = false
        const status = extractStatus(error)
        if (status === 401) setError('You are not authenticated. Please log in again.')
        else setError('Failed to load budgets.')
      } finally {
        setIsLoading(false)
      }
    } else {
      setBudgetsReady(true)
    }

    if (shouldFetchTransactions) {
      await loadTransactions(range.start, range.end)
    }
  }, [loadTransactions, range.end, range.start])

  useEffect(() => {
    if (!budgetsReady) return
    const shouldFilter = selectedAccountIds.length > 0 && !isAllAccountsSelected
    const keySuffix = selectedAccountIds.length === 0 && allAccountIds.length > 0
      ? 'none'
      : shouldFilter
        ? selectedAccountIds.join(',')
        : 'all'

    const key = `${range.start}:${range.end}:${keySuffix}`
    if (key === lastRangeRef.current) return
    loadTransactions(range.start, range.end)
  }, [budgetsReady, loadTransactions, range.end, range.start, isAllAccountsSelected, selectedAccountIds, allAccountIds])

  const categories = useMemo(() => budgets.map(b => b.category).sort(), [budgets])

  const usedCategories = useMemo(() => new Set(budgets.map(b => b.category)), [budgets])

  const categoryOptions = useMemo(() => {
    const unique = new Set<string>()
    for (const txn of transactions) {
      const primary = txn.category?.primary || 'OTHER'
      unique.add(primary)
    }
    return Array.from(unique).sort()
  }, [transactions])

  const computedBudgets = useMemo(() => {
    return budgets.map<BudgetProgressEntry>(b => {
      const spent = BudgetCalculator.calculateSpent(transactions, b.category, range.start, range.end)
      const percentage = BudgetCalculator.calculatePercentage(b.amount, spent)
      return { ...b, spent, percentage }
    })
  }, [budgets, range.end, range.start, transactions])

  const setMonth = useCallback((value: Date) => {
    setMonthState(normalizeMonth(value))
  }, [])

  const goToPreviousMonth = useCallback(() => {
    setMonthState(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }, [])

  const goToNextMonth = useCallback(() => {
    setMonthState(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }, [])

  const goToCurrentMonth = useCallback(() => {
    setMonthState(normalizeMonth(new Date()))
  }, [])

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
    } catch (error: unknown) {
      const status = extractStatus(error)
      const msg = status === 409
        ? `A budget for "${category}" already exists.`
        : status === 401
          ? 'You are not authenticated. Please log in again.'
          : 'Failed to create budget.'
      setError(msg)
      throw error
    }
  }, [budgets])

  const update = useCallback(async (id: string, amount: number) => {
    setError(null)
    const snapshot = budgets
    setBudgets(prev => prev.map(b => (b.id === id ? { ...b, amount } : b)))
    try {
      const updated = await BudgetService.updateBudget(id, { amount })
      setBudgets(prev => prev.map(b => (b.id === id ? updated : b)))
    } catch (error: unknown) {
      setBudgets(snapshot)
      const status = extractStatus(error)
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
    } catch (error: unknown) {
      setBudgets(snapshot)
      const status = extractStatus(error)
      const msg = status === 401
        ? 'You are not authenticated. Please log in again.'
        : 'Failed to delete budget.'
      setError(msg)
    }
  }, [budgets])

  return {
    isLoading,
    transactionsLoading,
    error,
    validationError,
    budgets,
    computedBudgets,
    load,
    add,
    update,
    remove,
    categories,
    categoryOptions,
    usedCategories,
    month,
    monthLabel,
    range,
    setMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
  }
}

function normalizeMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getMonthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { start: fmt(start), end: fmt(end) }
}

function generateId(): string {
  if (typeof globalThis !== 'undefined') {
    const cryptoObj = (globalThis as { crypto?: Crypto }).crypto
    if (cryptoObj?.randomUUID) {
      return cryptoObj.randomUUID()
    }
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function extractStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
  }
  return undefined
}
