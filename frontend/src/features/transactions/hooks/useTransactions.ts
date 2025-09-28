import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TransactionService, type TransactionFilters } from '../../../services/TransactionService'
import type { Transaction } from '../../../types/api'
import { useAccountFilter } from '../../../hooks/useAccountFilter'

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

  const { selectedAccountIds, isAllAccountsSelected } = useAccountFilter()

  const debounceTimer = useRef<number | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const filters: TransactionFilters = {}
      if (dateRange) filters.dateRange = String(dateRange)
      if (!isAllAccountsSelected && selectedAccountIds.length > 0) {
        filters.accountIds = selectedAccountIds
      }
      const txns = await TransactionService.getTransactions(filters)
      setAll(txns)
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : undefined
      const msg = status === 401 ? 'You are not authenticated. Please log in again.' : 'Failed to load transactions.'
      setError(msg)
      setAll([])
    } finally {
      setIsLoading(false)
    }
  }, [dateRange, isAllAccountsSelected, selectedAccountIds])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedCategory, dateRange, isAllAccountsSelected, selectedAccountIds])

  const debouncedSearch = useDebounce(search, 300)

  const filtered = useMemo(() => {
    const s = debouncedSearch.trim().toLowerCase()
    let list = all
    if (s) {
      list = list.filter(t => {
        const name = (t.name || '').toLowerCase()
        const merchant = (t.merchant || '').toLowerCase()
        const cat = (t.category?.name || '').toLowerCase()
        return name.includes(s) || merchant.includes(s) || cat.includes(s)
      })
    }
    if (selectedCategory) {
      const catLower = selectedCategory.toLowerCase()
      list = list.filter(t => (t.category?.name || '').toLowerCase() === catLower)
    }
    return list
  }, [all, debouncedSearch, selectedCategory])

  const categories = useMemo(() => {
    const names = new Set<string>()
    for (const t of all) {
      const name = t.category?.name || 'Uncategorized'
      if (name) names.add(name)
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [all])

  const totalItems = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = (currentPage - 1) * pageSize
  const pageItems = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return sorted.slice(start, start + pageSize)
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

