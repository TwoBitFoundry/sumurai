import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useTransactions } from '../features/transactions/hooks/useTransactions'
import TransactionsFilters from '../features/transactions/components/TransactionsFilters'
import TransactionsTable from '../features/transactions/components/TransactionsTable'
import { fmtUSD } from '../utils/format'
import { ReceiptText, TrendingUp, AlertTriangle, RefreshCcw } from 'lucide-react'

const TransactionsPage: React.FC = () => {
  const {
    isLoading,
    error,
    transactions,
    categories,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    currentPage,
    setCurrentPage,
    pageItems,
    totalItems,
    totalPages,
  } = useTransactions({ pageSize: 8 })

  const recurringScrollRef = useRef<HTMLDivElement>(null)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)
  const largestScrollRef = useRef<HTMLDivElement>(null)
  const [showLargestLeftFade, setShowLargestLeftFade] = useState(false)
  const [showLargestRightFade, setShowLargestRightFade] = useState(false)

  const stats = useMemo(() => {
    const totalCount = transactions.length
    const totalSpent = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0)

    const avgTransaction = totalCount > 0 ? totalSpent / totalCount : 0

    const largestTransaction = transactions.length > 0
      ? transactions.reduce((max, t) => Math.abs(t.amount) > Math.abs(max.amount) ? t : max, transactions[0])
      : null

    const merchantCounts = new Map<string, number>()
    transactions.forEach(t => {
      const merchant = t.merchant || t.name
      merchantCounts.set(merchant, (merchantCounts.get(merchant) || 0) + 1)
    })
    const recurringCount = Array.from(merchantCounts.values()).filter(count => count >= 3).length

    const recurringMerchants = Array.from(merchantCounts.entries())
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, _]) => name)

    const categoryCounts = new Map<string, number>()
    transactions.forEach(t => {
      const cat = t.category?.name || 'Uncategorized'
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1)
    })

    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name, _]) => name)

    const categoryDriver = topCategories.length > 0
      ? topCategories.length === 1
        ? `Mostly ${topCategories[0]}`
        : `Mostly ${topCategories[0]} & ${topCategories[1]}`
      : null

    return {
      totalCount,
      totalSpent,
      avgTransaction,
      largestTransaction,
      recurringCount,
      recurringMerchants,
      categoryDriver,
    }
  }, [transactions])

  const checkRecurringScroll = () => {
    const el = recurringScrollRef.current
    if (!el) return

    setShowLeftFade(el.scrollLeft > 0)
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }

  const checkLargestScroll = () => {
    const el = largestScrollRef.current
    if (!el) return

    setShowLargestLeftFade(el.scrollLeft > 0)
    setShowLargestRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }

  useEffect(() => {
    checkRecurringScroll()
    window.addEventListener('resize', checkRecurringScroll)
    return () => window.removeEventListener('resize', checkRecurringScroll)
  }, [stats.recurringMerchants])

  useEffect(() => {
    checkLargestScroll()
    window.addEventListener('resize', checkLargestScroll)
    return () => window.removeEventListener('resize', checkLargestScroll)
  }, [stats.largestTransaction])

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/35 bg-white/24 p-6 shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)] backdrop-blur-[28px] backdrop-saturate-[150%] transition-colors duration-500 ease-out dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)] sm:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-[1px] rounded-[2.5rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)] dark:ring-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.48)]" />
          <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-b from-white/72 via-white/28 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <span className="inline-flex items-center justify-center rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-600 shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)] dark:bg-[#1e293b]/75 dark:text-slate-200">
                Transaction History
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 transition-colors duration-300 ease-out dark:text-white md:text-4xl">
                  Review every dollar across accounts
                </h1>
                <p className="text-base leading-relaxed text-slate-600 transition-colors duration-300 ease-out dark:text-slate-300">
                  Search and filter transactions across all connected accounts.
                </p>
              </div>
            </div>

          </div>

          {error && (
            <div className="rounded-2xl border border-red-200/70 bg-red-50/80 px-5 py-3 shadow-sm dark:border-red-700/60 dark:bg-red-900/25">
              <div className="text-sm font-medium text-red-600 dark:text-red-300">Error: {error}</div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="group relative overflow-hidden rounded-2xl border border-sky-300 bg-white/80 p-4 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.55)] transition-all duration-300 hover:-translate-y-[2px] hover:border-sky-400 dark:border-sky-600 dark:bg-[#111a2f]/70 dark:hover:border-sky-500">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#38bdf8]/25 via-[#0ea5e9]/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="pointer-events-none absolute inset-[2px] rounded-[calc(1rem-2px)] ring-1 ring-[#93c5fd]/40 opacity-70" />
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                  <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Total shown</div>
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">
                  {stats.totalCount} {stats.totalCount === 1 ? 'item' : 'items'}
                </div>
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-100 px-1.5 py-0.5 text-[0.7rem] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                    {fmtUSD(stats.totalSpent)}
                  </span>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-emerald-300 bg-white/80 p-4 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.55)] transition-all duration-300 hover:-translate-y-[2px] hover:border-emerald-400 dark:border-emerald-600 dark:bg-[#111a2f]/70 dark:hover:border-emerald-500">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#34d399]/28 via-[#10b981]/12 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="pointer-events-none absolute inset-[2px] rounded-[calc(1rem-2px)] ring-1 ring-[#34d399]/35 opacity-70" />
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Average size</div>
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">
                  {fmtUSD(stats.avgTransaction)}
                </div>
                {stats.categoryDriver && (
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.7rem] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {stats.categoryDriver}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-amber-300 bg-white/80 p-4 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.55)] transition-all duration-300 hover:-translate-y-[2px] hover:border-amber-400 dark:border-amber-600 dark:bg-[#111a2f]/80 dark:hover:border-amber-500">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#fbbf24]/28 via-[#f59e0b]/12 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="pointer-events-none absolute inset-[2px] rounded-[calc(1rem-2px)] ring-1 ring-[#fbbf24]/35 opacity-70" />
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Largest Size</div>
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">
                  {stats.largestTransaction ? fmtUSD(Math.abs(stats.largestTransaction.amount)) : '$0'}
                </div>
                {stats.largestTransaction && (
                  <div className="relative mt-1 overflow-hidden">
                    <div
                      ref={largestScrollRef}
                      onScroll={checkLargestScroll}
                      className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      <span className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        {stats.largestTransaction.merchant || stats.largestTransaction.name}
                      </span>
                    </div>
                    {showLargestLeftFade && (
                      <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-6 bg-gradient-to-r from-white/80 to-transparent transition-opacity duration-200 dark:from-[#111a2f]/80" />
                    )}
                    {showLargestRightFade && (
                      <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-6 bg-gradient-to-l from-white/80 to-transparent transition-opacity duration-200 dark:from-[#111a2f]/80" />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-violet-300 bg-white/80 p-4 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.55)] transition-all duration-300 hover:-translate-y-[2px] hover:border-violet-400 dark:border-violet-600 dark:bg-[#111a2f]/70 dark:hover:border-violet-500">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#a78bfa]/28 via-[#7c3aed]/12 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="pointer-events-none absolute inset-[2px] rounded-[calc(1rem-2px)] ring-1 ring-[#a78bfa]/35 opacity-70" />
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                  <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">Recurring</div>
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">
                  {stats.recurringCount} {stats.recurringCount === 1 ? 'merchant' : 'merchants'}
                </div>
                {stats.recurringMerchants.length > 0 && (
                  <div className="relative mt-1 overflow-hidden">
                    <div
                      ref={recurringScrollRef}
                      onScroll={checkRecurringScroll}
                      className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {stats.recurringMerchants.map((merchant, i) => (
                        <span
                          key={i}
                          className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-violet-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                        >
                          {merchant}
                        </span>
                      ))}
                    </div>
                    {showLeftFade && (
                      <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-6 bg-gradient-to-r from-white/80 to-transparent transition-opacity duration-200 dark:from-[#111a2f]/80" />
                    )}
                    {showRightFade && (
                      <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-6 bg-gradient-to-l from-white/80 to-transparent transition-opacity duration-200 dark:from-[#111a2f]/80" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/18 p-0 shadow-[0_40px_120px_-82px_rgba(15,23,42,0.75)] backdrop-blur-2xl backdrop-saturate-[150%] transition-colors duration-500 dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_42px_140px_-80px_rgba(2,6,23,0.85)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)] dark:ring-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.5)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/65 via-white/25 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
        </div>
        <div className="relative z-10">
          <div className="border-b border-slate-200/70 px-6 pb-4 pt-6 dark:border-slate-700/50">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <TransactionsFilters
                  search={search}
                  onSearch={setSearch}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  showSearch={false}
                  showCategories
                />
              </div>
              <div className="flex-shrink-0">
                <TransactionsFilters
                  search={search}
                  onSearch={setSearch}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  showSearch
                  showCategories={false}
                />
              </div>
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">Loading transactions...</div>
                <div className="text-sm text-slate-500 dark:text-slate-500">Fetching data from server</div>
              </div>
            </div>
          ) : (
            <TransactionsTable
              items={pageItems}
              total={totalItems}
              currentPage={currentPage}
              totalPages={totalPages}
              onPrev={() => setCurrentPage(Math.max(1, currentPage - 1))}
              onNext={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default TransactionsPage
