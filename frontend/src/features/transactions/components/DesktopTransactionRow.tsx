import type React from 'react';
import { cn } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import type { Transaction } from '../../../types/api';
import { fmtUSD } from '../../../utils/format';
import InlineCategoryCell from './InlineCategoryCell';
import TransactionMerchantLabel from './TransactionMerchantLabel';
import { transactionsRowRecipes } from './transactionsRowRecipes';

interface Props {
  transaction: Transaction;
  index: number;
  style?: React.CSSProperties;
  onCategoryOpen?: (index: number) => void;
  onCategoryClose?: () => void;
}

export const DesktopTransactionRow: React.FC<Props> = ({
  transaction: r,
  index,
  style,
  onCategoryOpen,
  onCategoryClose,
}) => {
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      style={style}
      className={cn(
        transactionsRowRecipes.desktopGridCols,
        transactionsRowRecipes.desktopGridRow,
        transactionsRowRecipes.shell,
        index % 2 ? transactionsRowRecipes.odd : transactionsRowRecipes.even
      )}
    >
      <div
        role="cell"
        className={cn(
          'px-4 py-3 relative align-middle tabular-nums',
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
      </div>
      <div role="cell" className={cn('whitespace-nowrap px-4 py-3 align-middle text-right')}>
        <InlineCategoryCell
          transaction={r}
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
