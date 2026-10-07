import { CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Receipt } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { cn, EmptyState } from '@/ui/primitives';
import type { Transaction, UserCategory } from '../../../types/api';
import { formatDateOnly } from '../../../utils/dateOnly';
import { getDisplayAmount } from '../../../utils/transactionAmounts';
import { CategoryDropdown } from './CategoryDropdown';

interface Props {
  items: Transaction[];
  total: number;
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  duplicateCandidateIds: string[];
  onMarkDuplicate: (transactionId: string) => Promise<void>;
  userCategories: UserCategory[];
  onCategorySelect: (
    transactionId: string,
    categoryName: string,
    subcategoryName?: string
  ) => Promise<void>;
  onCategoryReset: (transactionId: string) => Promise<void>;
  onCategoryCreate: (transactionId: string, name: string, parentCategory?: string) => Promise<void>;
  onCategoryRule: (
    transactionId: string,
    pattern: string,
    categoryName: string,
    subcategoryName?: string
  ) => Promise<void>;
  onCategoryDelete: (categoryId: string) => Promise<void>;
  onOpenRulesModal?: () => void;
}

export const TransactionsTable: React.FC<Props> = ({
  items,
  total,
  currentPage,
  totalPages,
  onPrev,
  onNext,
  duplicateCandidateIds,
  onMarkDuplicate,
  userCategories,
  onCategorySelect,
  onCategoryReset,
  onCategoryCreate,
  onCategoryRule,
  onCategoryDelete,
  onOpenRulesModal,
}) => {
  const { format } = useCurrency();
  const [markingDuplicateId, setMarkingDuplicateId] = useState<string | null>(null);
  const duplicateCandidates = new Set(duplicateCandidateIds);

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
            <table className={cn('min-w-full', 'text-sm', 'table-fixed')}>
              <thead
                className={cn(
                  'bg-slate-200',
                  'text-slate-700',
                  'transition-colors',
                  'duration-500',
                  'dark:bg-slate-700',
                  'dark:text-slate-300'
                )}
              >
                <tr className={cn('border-b', 'border-slate-300', 'dark:border-slate-600')}>
                  <th
                    className={cn(
                      'w-[12%]',
                      'whitespace-nowrap',
                      'px-4',
                      'py-3',
                      'text-left',
                      'text-xs',
                      'font-semibold',
                      'uppercase',
                      'tracking-[0.18em]'
                    )}
                  >
                    Date
                  </th>
                  <th
                    className={cn(
                      'w-[22%]',
                      'px-4',
                      'py-3',
                      'text-left',
                      'text-xs',
                      'font-semibold',
                      'uppercase',
                      'tracking-[0.18em]'
                    )}
                  >
                    Merchant
                  </th>
                  <th
                    className={cn(
                      'w-[13%]',
                      'whitespace-nowrap',
                      'px-4',
                      'py-3',
                      'text-right',
                      'text-xs',
                      'font-semibold',
                      'uppercase',
                      'tracking-[0.18em]'
                    )}
                  >
                    Amount
                  </th>
                  <th
                    className={cn(
                      'w-[25%]',
                      'whitespace-nowrap',
                      'px-4',
                      'py-3',
                      'text-left',
                      'text-xs',
                      'font-semibold',
                      'uppercase',
                      'tracking-[0.18em]'
                    )}
                  >
                    Account
                  </th>
                  <th
                    className={cn(
                      'w-[28%]',
                      'whitespace-nowrap',
                      'px-4',
                      'py-3',
                      'text-left',
                      'text-xs',
                      'font-semibold',
                      'uppercase',
                      'tracking-[0.18em]'
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
                    const overrideType = r.custom_category
                      ? 'explicit'
                      : r.rule_category
                        ? 'rule'
                        : 'none';
                    const displayAmount = getDisplayAmount(r);
                    const isDuplicateCandidate = duplicateCandidates.has(r.id);
                    const isMarkingDuplicate = markingDuplicateId === r.id;
                    const markDuplicate = async () => {
                      setMarkingDuplicateId(r.id);
                      try {
                        await onMarkDuplicate(r.id);
                      } finally {
                        setMarkingDuplicateId(null);
                      }
                    };
                    return (
                      <tr
                        key={r.id}
                        data-pending={r.pending ? 'true' : undefined}
                        className={`group relative border-b border-slate-200/70 transition-all duration-150 ease-out hover:-translate-y-[2px] hover:ring-2 hover:ring-sky-400/60 dark:border-slate-700/50 dark:hover:ring-sky-400/50 ${
                          i % 2
                            ? 'bg-slate-100 dark:bg-slate-700/20'
                            : 'bg-white dark:bg-transparent'
                        }`}
                      >
                        <td
                          className={cn(
                            'relative',
                            'whitespace-nowrap',
                            'px-4',
                            'py-3',
                            'align-middle',
                            'text-slate-900',
                            'transition-colors',
                            'duration-500',
                            'dark:text-white'
                          )}
                          title={
                            r.pending
                              ? `Pending transaction (authorized: ${formatDateOnly(r.date)})`
                              : undefined
                          }
                        >
                          {formatDateOnly(r.date)}
                        </td>
                        <td
                          className={cn('max-w-0', 'px-4', 'py-3', 'align-middle')}
                          title={r.name || r.merchant || '-'}
                        >
                          <div className={cn('flex', 'min-w-0', 'items-center', 'gap-2')}>
                            <div
                              className={cn(
                                'min-w-0',
                                'flex-1',
                                'overflow-x-auto',
                                'whitespace-nowrap',
                                'py-0.5'
                              )}
                              style={{
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                              }}
                              onWheel={(e) => {
                                const el = e.currentTarget;
                                if (el.scrollWidth > el.clientWidth) {
                                  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                                    el.scrollLeft += e.deltaY;
                                  }
                                }
                              }}
                            >
                              <span
                                className={cn(
                                  'inline-block',
                                  'font-medium',
                                  'text-slate-900',
                                  'transition-colors',
                                  'duration-500',
                                  'dark:text-white'
                                )}
                              >
                                {r.name || r.merchant || '-'}
                              </span>
                            </div>
                            {r.pending && (
                              <span
                                className={cn(
                                  'inline-flex',
                                  'flex-shrink-0',
                                  'items-center',
                                  'gap-1',
                                  'rounded-full',
                                  'border',
                                  'border-amber-400/40',
                                  'bg-amber-100/90',
                                  'px-2',
                                  'py-0.5',
                                  'text-[0.65rem]',
                                  'font-semibold',
                                  'uppercase',
                                  'tracking-[0.16em]',
                                  'text-amber-800',
                                  'dark:border-amber-400/30',
                                  'dark:bg-amber-400/15',
                                  'dark:text-amber-200'
                                )}
                                title="Pending transaction"
                                data-testid="pending-badge"
                              >
                                <Clock className={cn('h-3', 'w-3')} />
                                Pending
                              </span>
                            )}
                            {isDuplicateCandidate && (
                              <span
                                className={cn(
                                  'flex-shrink-0',
                                  'rounded-full',
                                  'bg-amber-100',
                                  'px-2',
                                  'py-0.5',
                                  'text-[0.65rem]',
                                  'font-semibold',
                                  'uppercase',
                                  'tracking-[0.16em]',
                                  'text-amber-700',
                                  'dark:bg-amber-400/15',
                                  'dark:text-amber-200'
                                )}
                              >
                                Review
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums font-semibold transition-colors duration-500 ${
                            displayAmount > 0
                              ? 'text-green-600 dark:text-green-400'
                              : displayAmount < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {format(displayAmount)}
                        </td>
                        <td className={cn('whitespace-nowrap', 'px-4', 'py-3', 'align-middle')}>
                          <span
                            className={cn(
                              'text-xs',
                              'text-slate-600',
                              'transition-colors',
                              'duration-500',
                              'dark:text-slate-400'
                            )}
                          >
                            {r.account_name}
                            {r.account_mask && (
                              <span
                                className={cn(
                                  'ml-1',
                                  'text-slate-400',
                                  'transition-colors',
                                  'duration-500',
                                  'dark:text-slate-500'
                                )}
                              >
                                ••••{r.account_mask}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className={cn('whitespace-nowrap', 'px-4', 'py-3', 'align-middle')}>
                          <div className={cn('flex', 'items-center', 'gap-2')}>
                            <CategoryDropdown
                              currentCategory={r.category?.primary ?? 'OTHER'}
                              currentSubcategory={
                                r.category?.detailed ?? r.custom_subcategory ?? r.rule_subcategory
                              }
                              overrideType={overrideType}
                              merchantName={r.merchant || r.name}
                              userCategories={userCategories}
                              onSelect={(categoryName, subcategoryName) =>
                                onCategorySelect(r.id, categoryName, subcategoryName)
                              }
                              onReset={() => onCategoryReset(r.id)}
                              onCreateAndSelect={(name, parentCategory) =>
                                onCategoryCreate(r.id, name, parentCategory)
                              }
                              onCreateRule={(pattern, categoryName, subcategoryName) =>
                                onCategoryRule(r.id, pattern, categoryName, subcategoryName)
                              }
                              onDeleteCategory={onCategoryDelete}
                              onOpenRulesModal={onOpenRulesModal}
                            />
                            {isDuplicateCandidate && (
                              <button
                                type="button"
                                onClick={markDuplicate}
                                disabled={isMarkingDuplicate}
                                className={cn(
                                  'inline-flex',
                                  'h-8',
                                  'w-8',
                                  'flex-shrink-0',
                                  'items-center',
                                  'justify-center',
                                  'rounded-full',
                                  'border',
                                  'border-amber-200',
                                  'bg-amber-50',
                                  'text-amber-700',
                                  'transition-all',
                                  'duration-150',
                                  'hover:-translate-y-[1px]',
                                  'hover:bg-amber-100',
                                  'focus-visible:outline-none',
                                  'focus-visible:ring-2',
                                  'focus-visible:ring-amber-300',
                                  'disabled:cursor-wait',
                                  'disabled:opacity-60',
                                  'dark:border-amber-300/20',
                                  'dark:bg-amber-400/10',
                                  'dark:text-amber-200',
                                  'dark:hover:bg-amber-400/15'
                                )}
                                aria-label="Mark as duplicate"
                                title="Mark as duplicate"
                              >
                                <CheckCircleIcon className={cn('h-4', 'w-4')} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </motion.tbody>
              </AnimatePresence>
            </table>
          </div>
          <div
            className={cn(
              'flex',
              'items-center',
              'justify-between',
              'border-t',
              'border-slate-200/70',
              'bg-slate-50/50',
              'px-4',
              'py-4',
              'transition-colors',
              'duration-500',
              'dark:border-slate-700/50',
              'dark:bg-slate-800/30'
            )}
          >
            <div
              className={cn(
                'text-xs',
                'text-slate-600',
                'transition-colors',
                'duration-500',
                'dark:text-slate-400'
              )}
            >
              Showing {from}-{to} of {total}
            </div>
            <div className={cn('flex', 'items-center', 'gap-3')}>
              <button
                type="button"
                onClick={onPrev}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                className={cn(
                  'inline-flex',
                  'h-9',
                  'w-9',
                  'items-center',
                  'justify-center',
                  'rounded-full',
                  'border',
                  'border-white/50',
                  'bg-white/70',
                  'text-slate-600',
                  'shadow-[0_14px_38px_-28px_rgba(15,23,42,0.55)]',
                  'transition-all',
                  'duration-200',
                  'hover:-translate-y-[2px]',
                  'hover:bg-white/90',
                  'focus-visible:outline-none',
                  'focus-visible:ring-2',
                  'focus-visible:ring-sky-400/70',
                  'focus-visible:ring-offset-2',
                  'focus-visible:ring-offset-white',
                  'disabled:cursor-not-allowed',
                  'disabled:opacity-50',
                  'disabled:hover:translate-y-0',
                  'dark:border-white/10',
                  'dark:bg-[#1e293b]/70',
                  'dark:text-slate-200',
                  'dark:hover:bg-[#1e293b]/85',
                  'dark:focus-visible:ring-offset-[#0f172a]'
                )}
              >
                <ChevronLeftIcon className={cn('h-4', 'w-4')} />
              </button>
              <div
                className={cn(
                  'text-xs',
                  'text-slate-600',
                  'transition-colors',
                  'duration-500',
                  'dark:text-slate-400'
                )}
              >
                Page {currentPage} of {totalPages}
              </div>
              <button
                type="button"
                onClick={onNext}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className={cn(
                  'inline-flex',
                  'h-9',
                  'w-9',
                  'items-center',
                  'justify-center',
                  'rounded-full',
                  'border',
                  'border-white/50',
                  'bg-white/70',
                  'text-slate-600',
                  'shadow-[0_14px_38px_-28px_rgba(15,23,42,0.55)]',
                  'transition-all',
                  'duration-200',
                  'hover:-translate-y-[2px]',
                  'hover:bg-white/90',
                  'focus-visible:outline-none',
                  'focus-visible:ring-2',
                  'focus-visible:ring-sky-400/70',
                  'focus-visible:ring-offset-2',
                  'focus-visible:ring-offset-white',
                  'disabled:cursor-not-allowed',
                  'disabled:opacity-50',
                  'disabled:hover:translate-y-0',
                  'dark:border-white/10',
                  'dark:bg-[#1e293b]/70',
                  'dark:text-slate-200',
                  'dark:hover:bg-[#1e293b]/85',
                  'dark:focus-visible:ring-offset-[#0f172a]'
                )}
              >
                <ChevronRightIcon className={cn('h-4', 'w-4')} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionsTable;
