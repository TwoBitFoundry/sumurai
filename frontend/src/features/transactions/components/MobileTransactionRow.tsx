import type React from 'react';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import type { Transaction } from '@/types/api';
import { cn } from '@/ui/primitives';
import {
  focus as uiFocusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { fmtUSD } from '@/utils/format';
import { transactionMerchantName } from '../utils/transactionMerchantName';
import InlineCategoryCell from './InlineCategoryCell';
import TransactionMerchantLabel from './TransactionMerchantLabel';
import { transactionsRowRecipes } from './transactionsRowRecipes';

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
  if (name && mask) return `${name} ${mask}`;
  return name || mask;
}

function amountClassName(amount: number): string {
  if (amount < 0) return uiTextRecipes.danger;
  if (amount > 0) return uiTextRecipes.success;
  return uiTextRecipes.muted;
}

interface Props {
  transaction: Transaction;
  index: number;
  style?: React.CSSProperties;
  readOnly?: boolean;
  variant?: 'page' | 'contextual';
  onCategoryOpen?: (index: number) => void;
  onCategoryClose?: () => void;
  onMerchantSearch?: (merchant: string) => void;
  onAccountFilter?: (accountId: string) => void;
}

export const MobileTransactionRow: React.FC<Props> = ({
  transaction,
  index,
  style,
  readOnly = false,
  variant = 'page',
  onCategoryOpen,
  onCategoryClose,
  onMerchantSearch,
  onAccountFilter,
}) => {
  const { isMobile } = useViewportBreakpoint();
  const accountLabel = formatAccountLabel(transaction);
  const metaTitle = accountLabel
    ? `${formatMobileDate(transaction.date)} · ${accountLabel}`
    : formatMobileDate(transaction.date);
  const merchantName = transactionMerchantName(transaction);
  const handleMerchantSearchClick = onMerchantSearch
    ? () => onMerchantSearch(merchantName)
    : undefined;

  const isPageVariant = variant === 'page';

  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      style={style}
      className={cn(
        transactionsRowRecipes.shell,
        index % 2 ? transactionsRowRecipes.odd : transactionsRowRecipes.even,
        isPageVariant
          ? 'relative h-full px-4 py-2.5 md:px-8 lg:px-8'
          : 'relative h-full px-3 py-2.5',
        handleMerchantSearchClick && 'touch-manipulation'
      )}
    >
      {handleMerchantSearchClick ? (
        <button
          type="button"
          aria-label={`Search transactions for ${merchantName}`}
          onClick={handleMerchantSearchClick}
          className={cn(
            'absolute inset-0 z-0 cursor-pointer rounded-[inherit]',
            uiFocusRecipes.visible
          )}
        />
      ) : null}
      <div
        className={cn('relative z-10 min-w-0', handleMerchantSearchClick && 'pointer-events-none')}
      >
        <TransactionMerchantLabel
          merchantName={transaction.name}
          originalMerchantName={transaction.originalMerchantName}
          merchantLineClassName={cn(
            transactionsRowRecipes.mobileMerchantLine,
            transactionsRowRecipes.merchantEllipsis,
            uiTypographyRecipes.cardTitle,
            uiTextRecipes.primary
          )}
          layeredSearchTarget={Boolean(handleMerchantSearchClick)}
          metaContent={
            <div className={cn(transactionsRowRecipes.mobileMetaBlock)}>
              <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                {formatMobileDate(transaction.date)}
              </p>
              {accountLabel ? (
                transaction.account_id && onAccountFilter ? (
                  <button
                    type="button"
                    title={metaTitle}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAccountFilter(transaction.account_id as string);
                    }}
                    className={cn(
                      'pointer-events-auto min-w-0 truncate text-left touch-manipulation',
                      uiTypographyRecipes.caption,
                      uiTextRecipes.muted,
                      'hover:text-emerald-600 dark:hover:text-emerald-300'
                    )}
                  >
                    {accountLabel}
                  </button>
                ) : (
                  <p
                    className={cn(
                      'min-w-0 truncate',
                      uiTypographyRecipes.caption,
                      uiTextRecipes.muted
                    )}
                    title={metaTitle}
                  >
                    {accountLabel}
                  </p>
                )
              ) : null}
            </div>
          }
        />
      </div>
      <p
        className={cn(
          isPageVariant
            ? transactionsRowRecipes.mobileAmountPage
            : transactionsRowRecipes.mobileAmount,
          uiTypographyRecipes.cardTitle,
          amountClassName(transaction.amount)
        )}
      >
        {fmtUSD(transaction.amount)}
      </p>
      <div
        role="cell"
        className={cn(
          'pointer-events-auto',
          isPageVariant
            ? transactionsRowRecipes.mobileCategoryAnchorPage
            : transactionsRowRecipes.mobileCategoryAnchor
        )}
      >
        <InlineCategoryCell
          transaction={transaction}
          dense={isMobile}
          readOnly={readOnly}
          onOpenChange={(isOpen) => {
            if (isOpen) onCategoryOpen?.(index);
            else onCategoryClose?.();
          }}
        />
      </div>
    </div>
  );
};

export default MobileTransactionRow;
