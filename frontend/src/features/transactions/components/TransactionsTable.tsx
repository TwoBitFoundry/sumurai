import React from 'react'
import type { Transaction } from '../../../types/api'
import { fmtUSD } from '../../../utils/format'
import { getTagThemeForCategory } from '../../../utils/categories'
import { Th, Td } from '../../../components/ui/Table'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface Props {
  items: Transaction[]
  total: number
  currentPage: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

export const TransactionsTable: React.FC<Props> = ({ items, total, currentPage, totalPages, onPrev, onNext }) => {
  const pageSize = items.length > 0 ? Math.ceil(total / totalPages) : 8
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(total, currentPage * pageSize)
  return (
    <div className="p-0 overflow-hidden">
      {total === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="text-6xl mb-4 opacity-30">📋</div>
            <div className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">No transactions found</div>
            <div className="text-sm text-slate-500 dark:text-slate-500">No transaction data available</div>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm table-fixed">
            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
              <tr>
                <Th className="w-[15%] whitespace-nowrap">Date</Th>
                <Th className="w-[30%]">Merchant</Th>
                <Th className="w-[15%] text-right whitespace-nowrap">Amount</Th>
                <Th className="w-[20%] whitespace-nowrap">Account</Th>
                <Th className="w-[20%] whitespace-nowrap">Category</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((r, i) => (
                <tr key={r.id} className={`border-b border-slate-200 dark:border-slate-700 ${i % 2 ? 'bg-slate-50 dark:bg-slate-700/50' : ''}`}>
                  <Td className="whitespace-nowrap align-middle">{new Date(r.date).toLocaleDateString()}</Td>
                  <Td className="truncate align-middle" title={r.name || r.merchant || '-' }>
                    <span className="block truncate">{r.name || r.merchant || '-'}</span>
                  </Td>
                  <Td className={`text-right tabular-nums whitespace-nowrap font-medium align-middle ${r.amount > 0 ? 'text-red-600 dark:text-red-400' : r.amount < 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}`}>{fmtUSD(r.amount)}</Td>
                  <Td className="whitespace-nowrap align-middle">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {r.account_name}
                      {r.account_mask && (
                        <span className="text-slate-400 dark:text-slate-500 ml-1">••••{r.account_mask}</span>
                      )}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap align-middle">
                    {(() => {
                      const catName = r.category?.name || 'Uncategorized'
                      const theme = getTagThemeForCategory(catName)
                      return (
                        <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs ${theme.tag}`}>● {catName}</span>
                      )
                    })()}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="text-xs text-slate-600 dark:text-slate-400">Showing {from}-{to} of {total}</div>
            <div className="flex items-center gap-2">
              <button className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50" disabled={currentPage <= 1} onClick={onPrev} aria-label="Previous page">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <div className="text-xs text-slate-600 dark:text-slate-400">Page {currentPage} of {totalPages}</div>
              <button className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50" disabled={currentPage >= totalPages} onClick={onNext} aria-label="Next page">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default TransactionsTable

