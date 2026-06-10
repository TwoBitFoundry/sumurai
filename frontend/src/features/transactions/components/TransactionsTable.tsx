import { AnimatePresence, motion } from 'framer-motion';
import { Receipt } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { cn, EmptyState } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  text as uiTextRecipes,
  transactionsTable as uiTransactionsTableRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import type { Transaction } from '../../../types/api';
import { fmtUSD } from '../../../utils/format';
import InlineCategoryCell from './InlineCategoryCell';
import TransactionMerchantLabel from './TransactionMerchantLabel';
import { TransactionsMobileList } from './TransactionsMobileList';
import { transactionsRowRecipes } from './transactionsRowRecipes';

interface Props {
  items: Transaction[];
  total: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  isLoading?: boolean;
  bodyAnimationKey?: string;
}

const tableHeader = [
  ...uiTransactionsTableRecipes.chromeBar,
  uiTextRecipes.body,
  'transition-colors duration-500',
] as const;

const tableFooter = [...uiTransactionsTableRecipes.footer] as const;

const dateColumnClass = cn('w-[1%]', 'whitespace-nowrap', 'px-4', 'py-3');

const amountColumnClass = cn('whitespace-nowrap', 'px-4', 'py-3', 'text-right', 'tabular-nums');

function getWidestFormattedAmount(items: Transaction[]): string {
  if (items.length === 0) {
    return fmtUSD(0);
  }

  return items.reduce((widest, item) => {
    const label = fmtUSD(item.amount);
    return label.length > widest.length ? label : widest;
  }, fmtUSD(items[0]!.amount));
}

export { transactionsRowRecipes } from './transactionsRowRecipes';

export const TransactionsTable: React.FC<Props> = ({
  items,
  total,
  currentPage,
  totalPages,
  pageSize,
  isLoading = false,
  bodyAnimationKey,
}) => {
  const { isDesktop } = useViewportBreakpoint();
  const tbodyAnimationKey = bodyAnimationKey ?? String(currentPage);
  const visibleItems = items.slice(0, pageSize);
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(total, currentPage * pageSize);
  const showEmpty = total === 0 && !isLoading;
  const placeholderCount = Math.max(0, pageSize - visibleItems.length);
  const placeholderRows = useMemo(
    () =>
      Array.from({ length: placeholderCount }, (_, position) => ({
        id: `placeholder-${currentPage}-${position}`,
      })),
    [currentPage, placeholderCount]
  );

  const widestAmountLabel = useMemo(() => getWidestFormattedAmount(visibleItems), [visibleItems]);

  const paginationFooter = (
    <div className={cn('flex', 'items-center', 'justify-between', tableFooter)}>
      <div
        className={cn(
          uiTypographyRecipes.caption,
          uiTextRecipes.muted,
          'transition-colors',
          'duration-500'
        )}
      >
        Showing {from}-{to} of {total}
      </div>
      <div
        className={cn(
          uiTypographyRecipes.caption,
          uiTextRecipes.muted,
          'transition-colors',
          'duration-500'
        )}
      >
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );

  return (
    <div className="overflow-hidden">
      <div className="relative">
        {!isDesktop ? (
          <div className={cn('relative')} data-no-swipe>
            <TransactionsMobileList
              items={items}
              currentPage={currentPage}
              pageSize={pageSize}
              animationKey={tbodyAnimationKey}
            />
            {showEmpty ? (
              <div className={cn('absolute inset-0 flex items-center justify-center')}>
                <EmptyState
                  icon={Receipt}
                  title="No transactions found"
                  description="No transaction data available for the selected filters"
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className={cn('relative overflow-x-auto')} data-no-swipe>
            <table className={cn('min-w-full', 'table-fixed')}>
              <thead className={cn(tableHeader)}>
                <tr className={cn('border-b', ...uiBorderRecipes.divider)}>
                  <th className={cn(dateColumnClass, 'text-left', uiTypographyRecipes.label)}>
                    Date
                  </th>
                  <th
                    className={cn(
                      'w-[34%]',
                      'md:w-[30%]',
                      'px-4',
                      'py-3',
                      'text-left',
                      uiTypographyRecipes.label
                    )}
                  >
                    Merchant
                  </th>
                  <th className={cn('w-[1%]', amountColumnClass, uiTypographyRecipes.label)}>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'invisible',
                        'block',
                        'h-0',
                        'overflow-hidden',
                        'whitespace-nowrap',
                        'tabular-nums',
                        uiTypographyRecipes.body
                      )}
                    >
                      {widestAmountLabel}
                    </span>
                    Amount
                  </th>
                  <th
                    className={cn(
                      'hidden',
                      'md:table-cell',
                      'md:w-[20%]',
                      'whitespace-nowrap',
                      'px-4',
                      'py-3',
                      'text-left',
                      uiTypographyRecipes.label
                    )}
                  >
                    Account
                  </th>
                  <th
                    className={cn(
                      'w-[30%]',
                      'md:w-[20%]',
                      'whitespace-nowrap',
                      'px-4',
                      'py-3',
                      'text-left',
                      uiTypographyRecipes.label
                    )}
                  >
                    Category
                  </th>
                </tr>
              </thead>
              <AnimatePresence mode="wait" initial={false}>
                <motion.tbody
                  key={tbodyAnimationKey}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
                >
                  {visibleItems.map((r, i) => {
                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          transactionsRowRecipes.shell,
                          i % 2 ? transactionsRowRecipes.odd : transactionsRowRecipes.even
                        )}
                      >
                        <td
                          className={cn(
                            dateColumnClass,
                            'relative',
                            'align-middle',
                            'tabular-nums',
                            uiTypographyRecipes.body,
                            uiTextRecipes.primary,
                            'transition-colors',
                            'duration-500'
                          )}
                        >
                          {new Date(r.date).toLocaleDateString()}
                        </td>
                        <td
                          className={cn(
                            transactionsRowRecipes.merchantCell,
                            'px-4',
                            'py-3',
                            'align-middle'
                          )}
                        >
                          <TransactionMerchantLabel
                            merchantName={r.name}
                            originalMerchantName={r.originalMerchantName}
                            className={cn(
                              'block',
                              transactionsRowRecipes.merchantEllipsis,
                              uiTypographyRecipes.body,
                              uiTextRecipes.primary,
                              'transition-colors',
                              'duration-500'
                            )}
                          />
                        </td>
                        <td
                          className={cn(
                            amountColumnClass,
                            'align-middle',
                            uiTypographyRecipes.body,
                            'transition-colors',
                            'duration-500',
                            r.amount < 0
                              ? uiTextRecipes.danger
                              : r.amount > 0
                                ? uiTextRecipes.success
                                : uiTextRecipes.muted
                          )}
                        >
                          {fmtUSD(r.amount)}
                        </td>
                        <td
                          className={cn(
                            'hidden',
                            'md:table-cell',
                            'whitespace-nowrap',
                            'px-4',
                            'py-3',
                            'align-middle'
                          )}
                        >
                          <span
                            className={cn(
                              uiTypographyRecipes.body,
                              uiTextRecipes.muted,
                              'transition-colors',
                              'duration-500'
                            )}
                          >
                            {r.account_name}
                            {r.account_mask && (
                              <span
                                className={cn(
                                  'ml-1',
                                  uiTextRecipes.subtle,
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
                          <InlineCategoryCell transaction={r} />
                        </td>
                      </tr>
                    );
                  })}
                  {placeholderRows.map((row) => (
                    <tr
                      key={row.id}
                      aria-hidden="true"
                      tabIndex={-1}
                      className={cn(
                        transactionsRowRecipes.placeholder,
                        transactionsRowRecipes.placeholderDesktopHeight,
                        transactionsRowRecipes.even
                      )}
                    >
                      <td className={cn('hidden', 'md:table-cell', 'px-4', 'py-3', 'align-middle')}>
                        {'\u00A0'}
                      </td>
                      <td className={cn('px-4', 'py-3', 'align-middle')}>{'\u00A0'}</td>
                      <td className={cn('px-4', 'py-3', 'align-middle')}>{'\u00A0'}</td>
                      <td className={cn('px-4', 'py-3', 'align-middle')}>{'\u00A0'}</td>
                      <td className={cn('px-4', 'py-3', 'align-middle')}>{'\u00A0'}</td>
                    </tr>
                  ))}
                </motion.tbody>
              </AnimatePresence>
            </table>
            {showEmpty ? (
              <div className={cn('absolute inset-0 flex items-center justify-center')}>
                <EmptyState
                  icon={Receipt}
                  title="No transactions found"
                  description="No transaction data available for the selected filters"
                />
              </div>
            ) : null}
          </div>
        )}
        {isLoading && (
          <div className={cn('pointer-events-none', 'absolute', 'inset-0')}>
            <div className={cn('sr-only')} aria-live="polite">
              Loading transactions
            </div>
          </div>
        )}
        {paginationFooter}
      </div>
    </div>
  );
};

export default TransactionsTable;
