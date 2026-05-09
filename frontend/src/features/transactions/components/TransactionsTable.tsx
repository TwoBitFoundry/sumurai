import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import { Receipt } from 'lucide-react';
import type React from 'react';
import { cn, EmptyState, PaginationButton, Pill } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';
import type { Transaction } from '../../../types/api';
import { formatCategoryName } from '../../../utils/categories';
import { fmtUSD } from '../../../utils/format';

interface Props {
  items: Transaction[];
  total: number;
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

const resolveCategoryName = (transaction: Transaction): string => {
  if (!transaction.category) {
    return 'Uncategorized';
  }
  return formatCategoryName(transaction.category.primary);
};

const tableHeader = [
  ...designTokens.surfaces.semantic.mutedChip,
  designTokens.text.body,
  'transition-colors duration-500',
] as const;

const tableFooter = [
  'border-t px-4 py-4 transition-colors duration-500',
  ...designTokens.borders.glass,
  ...designTokens.surfaces.semantic.card,
  ...designTokens.effects.semantic.glassShadow,
  'backdrop-blur-md',
  'backdrop-saturate-[150%]',
] as const;

const transactionRow = {
  shell: [
    'group relative border-b border-slate-200/70 transition-all duration-150 ease-out hover:-translate-y-[2px] hover:ring-2 hover:ring-sky-400/60',
    'dark:border-slate-700/50 dark:hover:ring-sky-400/50',
  ],
  odd: ['bg-slate-100', 'dark:bg-slate-700/20'],
  even: ['bg-white', 'dark:bg-transparent'],
} as const;

export const TransactionsTable: React.FC<Props> = ({
  items,
  total,
  currentPage,
  totalPages,
  onPrev,
  onNext,
}) => {
  const pageSize = items.length > 0 ? Math.ceil(total / totalPages) : 8;
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(total, currentPage * pageSize);
  return (
    <div className="overflow-hidden">
      {total === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions found"
          description="No transaction data available for the selected filters"
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className={cn('min-w-full', 'table-fixed')}>
              <thead className={cn(tableHeader)}>
                <tr className={cn('border-b', ...designTokens.borders.divider)}>
                  <th
                    className={cn(
                      'w-[15%]',
                      'whitespace-nowrap',
                      'px-4',
                      'py-3',
                      'text-left',
                      designTokens.typography.label
                    )}
                  >
                    Date
                  </th>
                  <th
                    className={cn(
                      'w-[30%]',
                      'px-4',
                      'py-3',
                      'text-left',
                      designTokens.typography.label
                    )}
                  >
                    Merchant
                  </th>
                  <th
                    className={cn(
                      'w-[15%]',
                      'whitespace-nowrap',
                      'px-4',
                      'py-3',
                      'text-right',
                      designTokens.typography.label
                    )}
                  >
                    Amount
                  </th>
                  <th
                    className={cn(
                      'w-[20%]',
                      'whitespace-nowrap',
                      'px-4',
                      'py-3',
                      'text-left',
                      designTokens.typography.label
                    )}
                  >
                    Account
                  </th>
                  <th
                    className={cn(
                      'w-[20%]',
                      'whitespace-nowrap',
                      'px-4',
                      'py-3',
                      'text-left',
                      designTokens.typography.label
                    )}
                  >
                    Category
                  </th>
                </tr>
              </thead>
              <AnimatePresence mode="wait" initial={false}>
                <motion.tbody
                  key={currentPage}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
                >
                  {items.map((r, i) => {
                    const catName = resolveCategoryName(r);
                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          transactionRow.shell,
                          i % 2 ? transactionRow.odd : transactionRow.even
                        )}
                      >
                        <td
                          className={cn(
                            'relative',
                            'whitespace-nowrap',
                            'px-4',
                            'py-3',
                            'align-middle',
                            designTokens.typography.body,
                            designTokens.text.primary,
                            'transition-colors',
                            'duration-500'
                          )}
                        >
                          {new Date(r.date).toLocaleDateString()}
                        </td>
                        <td
                          className={cn('truncate', 'px-4', 'py-3', 'align-middle')}
                          title={r.name || r.merchant || '-'}
                        >
                          <span
                            className={cn(
                              'block',
                              'truncate',
                              designTokens.typography.body,
                              designTokens.text.primary,
                              'transition-colors',
                              'duration-500'
                            )}
                          >
                            {r.name || r.merchant || '-'}
                          </span>
                        </td>
                        <td
                          className={cn(
                            'whitespace-nowrap',
                            'px-4',
                            'py-3',
                            'text-right',
                            'align-middle',
                            'tabular-nums',
                            designTokens.typography.body,
                            'transition-colors',
                            'duration-500',
                            r.amount > 0
                              ? designTokens.text.danger
                              : r.amount < 0
                                ? designTokens.text.success
                                : designTokens.text.muted
                          )}
                        >
                          {fmtUSD(r.amount)}
                        </td>
                        <td className={cn('whitespace-nowrap', 'px-4', 'py-3', 'align-middle')}>
                          <span
                            className={cn(
                              designTokens.typography.body,
                              designTokens.text.muted,
                              'transition-colors',
                              'duration-500'
                            )}
                          >
                            {r.account_name}
                            {r.account_mask && (
                              <span
                                className={cn(
                                  'ml-1',
                                  designTokens.text.subtle,
                                  'transition-colors',
                                  'duration-500'
                                )}
                              >
                                ••••{r.account_mask}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className={cn('whitespace-nowrap', 'px-4', 'py-3', 'align-middle')}>
                          <Pill
                            variant="category"
                            categoryName={catName}
                            className="transition-all duration-200 backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10"
                          >
                            {catName}
                          </Pill>
                        </td>
                      </tr>
                    );
                  })}
                </motion.tbody>
              </AnimatePresence>
            </table>
          </div>
          <div className={cn('flex', 'items-center', 'justify-between', tableFooter)}>
            <div
              className={cn(
                designTokens.typography.caption,
                designTokens.text.muted,
                'transition-colors',
                'duration-500'
              )}
            >
              Showing {from}-{to} of {total}
            </div>
            <div className={cn('flex', 'items-center', 'gap-3')}>
              <PaginationButton
                type="button"
                onClick={onPrev}
                disabled={currentPage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeftIcon className={cn('h-4', 'w-4')} />
              </PaginationButton>
              <div
                className={cn(
                  designTokens.typography.caption,
                  designTokens.text.muted,
                  'transition-colors',
                  'duration-500'
                )}
              >
                Page {currentPage} of {totalPages}
              </div>
              <PaginationButton
                type="button"
                onClick={onNext}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
              >
                <ChevronRightIcon className={cn('h-4', 'w-4')} />
              </PaginationButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionsTable;
