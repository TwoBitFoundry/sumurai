import type React from 'react';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import type { Transaction } from '@/types/api';
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
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
  const handleRowActivate = onMerchantSearch ? () => onMerchantSearch(merchantName) : undefined;
  const handleRowKeyDown = onMerchantSearch
    ? (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onMerchantSearch(merchantName);
        }
      }
    : undefined;

  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      style={style}
      tabIndex={handleRowActivate ? 0 : undefined}
      onClick={handleRowActivate}
      onKeyDown={handleRowKeyDown}
      className={cn(
        transactionsRowRecipes.shell,
        index % 2 ? transactionsRowRecipes.odd : transactionsRowRecipes.even,
        'relative h-full px-3 py-2.5',
        onMerchantSearch && 'cursor-pointer'
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
              {transaction.name || '-'}
            </p>
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
                      'pointer-events-auto min-w-0 truncate text-left',
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
      <div
        role="cell"
        className={cn(transactionsRowRecipes.mobileCategoryAnchor)}
        onMouseDown={(event) => event.stopPropagation()}
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
