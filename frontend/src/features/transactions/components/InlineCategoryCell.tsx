import { ChevronDown } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Transaction } from '@/types/api';
import { Button, cn } from '@/ui/primitives';
import { controlIconWell } from '@/ui/recipes';
import { categoryThemeVars } from '@/ui/tokens';
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
  readOnly?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function InlineCategoryCell({
  transaction,
  dense: _dense = false,
  readOnly = false,
  onOpenChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const setOpenWithCallback = (next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(openRef.current) : next;
    if (value === openRef.current) return;
    openRef.current = value;
    setOpen(value);
    onOpenChangeRef.current?.(value);
  };
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

  const categoryChipStyle = _dense
    ? { width: categoryChipWidth, flexBasis: categoryChipWidth }
    : { maxWidth: categoryChipWidth };
  const theme = getTagThemeForCategory(categoryName, accentIndexByName);

  return (
    <div
      className={cn(
        'inline-flex',
        'min-w-0',
        'max-w-full',
        'items-center',
        readOnly
          ? 'ml-auto w-fit shrink-0 justify-end'
          : _dense
            ? 'shrink-0 justify-end'
            : 'ml-auto w-fit max-w-full'
      )}
      style={categoryChipStyle}
    >
      <Button
        ref={anchorRef}
        type="button"
        variant="tab"
        size="inherit"
        aria-label={readOnly ? label : `Edit category: ${label}`}
        aria-expanded={readOnly ? undefined : open}
        onClick={
          readOnly
            ? undefined
            : (event) => {
                event.stopPropagation();
                setOpenWithCallback((value) => !value);
              }
        }
        className={cn(transactionsRowRecipes.categoryPill, readOnly && '!w-fit', theme.inlineLabel)}
        style={categoryThemeVars(theme)}
      >
        <span
          className={cn(
            readOnly
              ? transactionsRowRecipes.categoryLabelReadOnly
              : transactionsRowRecipes.categoryLabel
          )}
        >
          {label}
        </span>
        {!readOnly ? (
          <span
            className={cn(controlIconWell.sm, transactionsRowRecipes.categoryChevron)}
            aria-hidden="true"
          >
            <ChevronDown />
          </span>
        ) : null}
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
        onRequestClose={() => setOpenWithCallback(false)}
      />
    </div>
  );
}

export default InlineCategoryCell;
