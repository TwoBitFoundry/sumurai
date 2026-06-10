import { AnimatePresence, motion } from 'framer-motion';
import { Receipt } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import type { Transaction } from '@/types/api';
import { cn, EmptyState } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { fmtUSD } from '@/utils/format';
import InlineCategoryCell from './InlineCategoryCell';
import TransactionMerchantLabel from './TransactionMerchantLabel';
import { transactionsRowRecipes } from './transactionsRowRecipes';

interface Props {
  items: Transaction[];
  currentPage: number;
  pageSize: number;
  animationKey: string;
}

function formatMobileDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatAccountLabel(transaction: Transaction): string {
  const mask = transaction.account_mask ? `····${transaction.account_mask}` : '';
  const name = transaction.account_name?.trim() ?? '';
  if (name && mask) {
    return `${name} ${mask}`;
  }
  return name || mask;
}

function amountClassName(amount: number): string {
  if (amount < 0) {
    return uiTextRecipes.danger;
  }
  if (amount > 0) {
    return uiTextRecipes.success;
  }
  return uiTextRecipes.muted;
}

export const TransactionsMobileList: React.FC<Props> = ({
  items,
  currentPage,
  pageSize,
  animationKey,
}) => {
  const { isMobile } = useViewportBreakpoint();
  const visibleItems = items.slice(0, pageSize);
  const placeholderCount = Math.max(0, pageSize - visibleItems.length);
  const placeholderRows = useMemo(
    () =>
      Array.from({ length: placeholderCount }, (_, position) => ({
        id: `placeholder-${currentPage}-${position}`,
      })),
    [currentPage, placeholderCount]
  );

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.ul
        key={animationKey}
        data-testid="transactions-mobile-list"
        className="list-none px-1"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {visibleItems.map((transaction, index) => {
          const accountLabel = formatAccountLabel(transaction);
          const metaTitle = accountLabel
            ? `${formatMobileDate(transaction.date)} · ${accountLabel}`
            : formatMobileDate(transaction.date);
          const merchantDisplay = transaction.name || '-';

          return (
            <li
              key={transaction.id}
              className={cn(
                transactionsRowRecipes.shell,
                index % 2 ? transactionsRowRecipes.odd : transactionsRowRecipes.even,
                'px-3',
                'py-2.5'
              )}
            >
              <TransactionMerchantLabel
                merchantName={transaction.name}
                originalMerchantName={transaction.originalMerchantName}
                surfaceContent={
                  <>
                    <p
                      className={cn(
                        transactionsRowRecipes.mobileMerchantLine,
                        transactionsRowRecipes.merchantEllipsis,
                        uiTypographyRecipes.cardTitle,
                        uiTextRecipes.primary
                      )}
                    >
                      {merchantDisplay}
                    </p>
                    <div className={cn(transactionsRowRecipes.mobileMetaBlock)}>
                      <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                        {formatMobileDate(transaction.date)}
                      </p>
                      {accountLabel ? (
                        <p
                          className={cn(
                            'min-w-0',
                            'truncate',
                            uiTypographyRecipes.caption,
                            uiTextRecipes.muted
                          )}
                          title={metaTitle}
                        >
                          {accountLabel}
                        </p>
                      ) : null}
                    </div>
                  </>
                }
              />
              <p
                className={cn(
                  transactionsRowRecipes.mobileAmount,
                  uiTypographyRecipes.cardTitle,
                  amountClassName(transaction.amount)
                )}
              >
                {fmtUSD(transaction.amount)}
              </p>
              <div className={cn(transactionsRowRecipes.mobileCategoryAnchor)}>
                <InlineCategoryCell transaction={transaction} dense={isMobile} />
              </div>
            </li>
          );
        })}
        {placeholderRows.map((row) => (
          <li
            key={row.id}
            aria-hidden="true"
            className={cn(
              transactionsRowRecipes.placeholder,
              transactionsRowRecipes.placeholderMobileHeight,
              transactionsRowRecipes.even,
              'px-3',
              'py-2.5'
            )}
          />
        ))}
      </motion.ul>
    </AnimatePresence>
  );
};

export default TransactionsMobileList;
