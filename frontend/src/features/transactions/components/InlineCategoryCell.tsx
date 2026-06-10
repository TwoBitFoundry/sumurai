import { ChevronDown } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Transaction } from '@/types/api';
import { Button, cn } from '@/ui/primitives';
import { controlIconWell } from '@/ui/recipes';
import {
  formatCategoryName,
  getTagThemeForCategory,
  longestFormattedCategoryLabel,
  mobileCategoryChipWidthRem,
} from '@/utils/categories';
import { useCategories } from '../hooks/useCategories';
import { useUpdateTransactionCategory } from '../hooks/useUpdateTransactionCategory';
import CategoryPicker from './CategoryPicker';
import { transactionsRowRecipes } from './transactionsRowRecipes';

interface Props {
  transaction: Transaction;
  dense?: boolean;
}

export function InlineCategoryCell({ transaction, dense: _dense = false }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { accentIndexByName, all } = useCategories();
  const { updateTransactionCategory } = useUpdateTransactionCategory();

  const category = transaction.category;
  const categoryName = category?.primary ?? 'Other';
  const isCustom = Boolean(category?.is_custom);
  const label = formatCategoryName(categoryName);

  const categoryChipWidth = useMemo(() => {
    const longestLabel = all.reduce((longest, name) => {
      const formatted = formatCategoryName(name);
      return formatted.length > longest.length ? formatted : longest;
    }, longestFormattedCategoryLabel());
    return mobileCategoryChipWidthRem(longestLabel);
  }, [all]);

  const categoryChipStyle = {
    width: categoryChipWidth,
    flexBasis: categoryChipWidth,
  };

  return (
    <div
      className={cn('inline-flex', 'shrink-0', 'items-center', 'min-w-0')}
      style={categoryChipStyle}
    >
      <Button
        ref={anchorRef}
        type="button"
        variant="tab"
        size="sm"
        aria-label={`Edit category: ${label}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          transactionsRowRecipes.categoryPill,
          themeInlineLabelClasses(categoryName, accentIndexByName)
        )}
      >
        <span className={cn(transactionsRowRecipes.categoryLabel)}>{label}</span>
        <span
          className={cn(controlIconWell.sm, transactionsRowRecipes.categoryChevron)}
          aria-hidden="true"
        >
          <ChevronDown />
        </span>
      </Button>
      <CategoryPicker
        open={open}
        anchorRef={anchorRef}
        currentCategory={{ name: categoryName, isCustom }}
        onSelect={({ categoryName: nextCategoryName, isCustom: nextIsCustom }) => {
          updateTransactionCategory({
            transactionId: transaction.id,
            categoryName: nextCategoryName,
            isCustom: nextIsCustom,
          });
        }}
        onRequestClose={() => setOpen(false)}
      />
    </div>
  );
}

export default InlineCategoryCell;

function themeInlineLabelClasses(
  categoryName: string,
  accentIndexByName: ReadonlyMap<string, number>
): string {
  const theme = getTagThemeForCategory(categoryName, accentIndexByName);
  return theme.inlineLabel;
}
