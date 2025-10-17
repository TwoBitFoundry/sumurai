import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TransactionService, type TransactionFilters } from '../../../services/TransactionService'
import type { Transaction } from '../../../types/api'
import { useAccountFilter } from '../../../hooks/useAccountFilter'
import { formatCategoryName } from '../../../utils/categories'
import { TransactionFilter, type FilterCriteria } from '../../../domain/TransactionFilter'

export type DateRangeKey = string | undefined

export interface UseTransactionsOptions {
  initialSearch?: string
  initialCategory?: string | null
  initialDateRange?: DateRangeKey
  pageSize?: number
}

export interface UseTransactionsResult {
  isLoading: boolean
  error: string | null
  transactions: Transaction[]
  categories: string[]
  search: string
  setSearch: (s: string) => void
  selectedCategory: string | null
  setSelectedCategory: (c: string | null) => void
  dateRange: DateRangeKey
  setDateRange: (r: DateRangeKey) => void
  // pagination
  currentPage: number
  setCurrentPage: (p: number) => void
  pageItems: Transaction[]
  totalItems: number
  totalPages: number
}

export function useTransactions(options: UseTransactionsOptions = {}): UseTransactionsResult {
  const { initialSearch = '', initialCategory = null, initialDateRange, pageSize = 10 } = options

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [all, setAll] = useState<Transaction[]>([])
  const [search, setSearch] = useState(initialSearch)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory)
  const [dateRange, setDateRange] = useState<DateRangeKey>(initialDateRange)
  const [currentPage, setCurrentPage] = useState(1)

  const { selectedAccountIds, isAllAccountsSelected, allAccountIds, loading: accountsLoading } = useAccountFilter()

  const load = useCallback(async () => {
    if (accountsLoading) {
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const filters: TransactionFilters = {}
      if (allAccountIds.length > 0 && selectedAccountIds.length === 0) {
        setAll([])
        return
      }
      if (dateRange) filters.dateRange = String(dateRange)
      if (!isAllAccountsSelected && selectedAccountIds.length > 0) {
        filters.accountIds = selectedAccountIds
      }
      const txns = await TransactionService.getTransactions(filters)
      setAll(txns)
    } catch (error: unknown) {
      const status = getStatus(error)
      const msg = status === 401 ? 'You are not authenticated. Please log in again.' : 'Failed to load transactions.'
      setError(msg)
      setAll([])
    } finally {
      setIsLoading(false)
    }
  }, [accountsLoading, dateRange, isAllAccountsSelected, selectedAccountIds, allAccountIds])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedCategory, dateRange, isAllAccountsSelected, selectedAccountIds, allAccountIds, accountsLoading])

  const debouncedSearch = useDebounce(search, 300)

  const resolveCategoryLabel = useCallback((t: Transaction) => {
    if (!t.category) {
      return 'Uncategorized'
    }
    return formatCategoryName(t.category.primary)
  }, [])

  const filtered = useMemo(() => {
    const criteria: FilterCriteria = {
      search: debouncedSearch.trim(),
      category: selectedCategory || undefined
    }
    return TransactionFilter.filter(all, criteria)
  }, [all, debouncedSearch, selectedCategory])

  const categories = useMemo(() => {
    const names = new Set<string>()
    for (const t of filtered) {
      const name = resolveCategoryLabel(t) || 'Uncategorized'
      if (name) names.add(name)
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [filtered, resolveCategoryLabel])

  useEffect(() => {
    if (selectedCategory && !categories.includes(selectedCategory)) {
      setSelectedCategory(null)
    }
  }, [categories, selectedCategory])

  const totalItems = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = (currentPage - 1) * pageSize
  const pageItems = useMemo(() => {
    return filtered.slice(start, start + pageSize)
  }, [filtered, start, pageSize])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  return {
    isLoading,
    error,
    transactions: filtered,
    categories,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    dateRange,
    setDateRange,
    currentPage,
    setCurrentPage,
    pageItems,
    totalItems,
    totalPages,
  }
}

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value)
  const timer = useRef<number | null>(null)
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setV(value), delay)
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [value, delay])
  return v
}

function getStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
  }
  return undefined
}
