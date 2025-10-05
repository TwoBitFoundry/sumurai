import React from 'react'
import { useTransactions } from '../features/transactions/hooks/useTransactions'
import TransactionsFilters from '../features/transactions/components/TransactionsFilters'
import TransactionsTable from '../features/transactions/components/TransactionsTable'

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
