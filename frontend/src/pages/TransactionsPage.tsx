import React from 'react'
import Card from '../components/ui/Card'
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
  } = useTransactions({ pageSize: 10 })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Transactions</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Search, filter, and review all your transactions.</p>
        </div>
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

      <TransactionsFilters
        search={search}
        onSearch={setSearch}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        showSearch={false}
        showCategories
      />

      {error && (
        <Card className="border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
          <div className="text-sm text-red-600 dark:text-red-400 font-medium">Error</div>
          <div className="text-xs text-red-500 dark:text-red-300 mt-1">{error}</div>
        </Card>
      )}

      <Card>
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
      </Card>
    </div>
  )
}

export default TransactionsPage
