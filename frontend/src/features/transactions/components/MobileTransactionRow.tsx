import type React from 'react';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import type { Transaction } from '@/types/api';
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { fmtUSD } from '@/utils/format';
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
  onCategoryOpen?: (index: number) => void;
  onCategoryClose?: () => void;
}

export const MobileTransactionRow: React.FC<Props> = ({
  transaction,
  index,
  style,
  onCategoryOpen,
  onCategoryClose,
}) => {
  const { isMobile } = useViewportBreakpoint();
  const accountLabel = formatAccountLabel(transaction);
  const metaTitle = accountLabel
    ? `${formatMobileDate(transaction.date)} · ${accountLabel}`
    : formatMobileDate(transaction.date);

  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      style={style}
      className={cn(
        transactionsRowRecipes.shell,
        index % 2 ? transactionsRowRecipes.odd : transactionsRowRecipes.even,
        'relative px-3 py-2.5'
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
        <InlineCategoryCell
          transaction={transaction}
          dense={isMobile}
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
