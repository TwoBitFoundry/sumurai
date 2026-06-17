import type React from 'react';
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import type { Transaction } from '../../../types/api';
import { fmtUSD } from '../../../utils/format';
import { transactionMerchantName } from '../utils/transactionMerchantName';
import InlineCategoryCell from './InlineCategoryCell';
import TransactionMerchantLabel from './TransactionMerchantLabel';
import { transactionsRowRecipes } from './transactionsRowRecipes';

function stopRowActivation(event: React.SyntheticEvent) {
  event.stopPropagation();
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

export const DesktopTransactionRow: React.FC<Props> = ({
  transaction: r,
  index,
  style,
  readOnly = false,
  variant = 'page',
  onCategoryOpen,
  onCategoryClose,
  onMerchantSearch,
  onAccountFilter,
}) => {
  const merchantName = transactionMerchantName(r);
  const handleRowActivate = onMerchantSearch ? () => onMerchantSearch(merchantName) : undefined;
  const handleRowKeyDown = onMerchantSearch
    ? (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onMerchantSearch(merchantName);
        }
      }
    : undefined;

  const isPageVariant = variant === 'page';

  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      style={style}
      tabIndex={handleRowActivate ? 0 : undefined}
      onClick={handleRowActivate}
      onKeyDown={handleRowKeyDown}
      className={cn(
        transactionsRowRecipes.desktopGridCols,
        transactionsRowRecipes.desktopGridRow,
        transactionsRowRecipes.shell,
        index % 2 ? transactionsRowRecipes.odd : transactionsRowRecipes.even,
        'h-full',
        onMerchantSearch && 'cursor-pointer touch-manipulation'
      )}
    >
      <div
        role="cell"
        className={cn(
          isPageVariant
            ? 'pl-4 py-3 md:pl-8 lg:pl-8 relative align-middle tabular-nums'
            : 'px-4 py-3 relative align-middle tabular-nums',
          uiTypographyRecipes.body,
          uiTextRecipes.primary,
          'transition-colors duration-500'
        )}
      >
        {new Date(r.date).toLocaleDateString()}
      </div>
      <div
        role="cell"
        className={cn(transactionsRowRecipes.merchantCell, 'px-4 py-3 align-middle')}
      >
        <TransactionMerchantLabel
          merchantName={r.name}
          originalMerchantName={r.originalMerchantName}
          className={cn(
            'block',
            transactionsRowRecipes.merchantEllipsis,
            uiTypographyRecipes.body,
            uiTextRecipes.primary,
            'transition-colors duration-500'
          )}
        />
      </div>
      <div
        role="cell"
        className={cn(
          'whitespace-nowrap px-4 py-3 text-right tabular-nums align-middle',
          uiTypographyRecipes.body,
          'transition-colors duration-500',
          r.amount < 0
            ? uiTextRecipes.danger
            : r.amount > 0
              ? uiTextRecipes.success
              : uiTextRecipes.muted
        )}
      >
        {fmtUSD(r.amount)}
      </div>
      <div role="cell" className={cn('hidden md:block whitespace-nowrap px-4 py-3 align-middle')}>
        {r.account_id && onAccountFilter ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAccountFilter(r.account_id as string);
            }}
            className={cn(
              uiTypographyRecipes.body,
              uiTextRecipes.muted,
              'cursor-pointer text-left transition-colors duration-500',
              'hover:text-emerald-600 dark:hover:text-emerald-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-400/80 dark:focus-visible:ring-offset-slate-900'
            )}
          >
            {r.account_name}
            {r.account_mask && (
              <span className={cn('ml-1', uiTextRecipes.subtle, 'transition-colors duration-500')}>
                ••••{r.account_mask}
              </span>
            )}
          </button>
        ) : (
          <span
            className={cn(
              uiTypographyRecipes.body,
              uiTextRecipes.muted,
              'transition-colors duration-500'
            )}
          >
            {r.account_name}
            {r.account_mask && (
              <span className={cn('ml-1', uiTextRecipes.subtle, 'transition-colors duration-500')}>
                ••••{r.account_mask}
              </span>
            )}
          </span>
        )}
      </div>
      <div
        role="cell"
        className={cn(
          'flex min-w-0 justify-end py-3 align-middle',
          isPageVariant ? 'pr-4 md:pr-8 lg:pr-8' : 'px-4'
        )}
        onMouseDown={stopRowActivation}
        onPointerDown={stopRowActivation}
      >
        <InlineCategoryCell
          transaction={r}
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

export default DesktopTransactionRow;
