import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Transaction } from '@/types/api';
import { Button, cn } from '@/ui/primitives';
import { controlIconWell } from '@/ui/recipes';
import { formatCategoryName, getTagThemeForCategory } from '@/utils/categories';
import { useCategories } from '../hooks/useCategories';
import { useUpdateTransactionCategory } from '../hooks/useUpdateTransactionCategory';
import CategoryPicker from './CategoryPicker';

interface Props {
  transaction: Transaction;
}

export function InlineCategoryCell({ transaction }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { accentIndexByName } = useCategories();
  const { updateTransactionCategory } = useUpdateTransactionCategory();

  const category = transaction.category;
  const categoryName = category?.primary ?? 'Other';
  const isCustom = Boolean(category?.is_custom);
  const label = formatCategoryName(categoryName);

  return (
    <div className={cn('inline-flex', 'items-center', 'gap-1.5')}>
      <Button
        ref={anchorRef}
        type="button"
        variant="filterChip"
        size="sm"
        shape="pill"
        aria-label={`Edit category: ${label}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'shrink-0',
          'gap-1.5',
          'whitespace-nowrap',
          'backdrop-blur-sm',
          'ring-1 ring-white/60 dark:ring-white/10',
          themeTagClasses(categoryName, isCustom, accentIndexByName)
        )}
      >
        <span>{label}</span>
        <span className={cn(controlIconWell.sm)} aria-hidden="true">
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

function themeTagClasses(
  categoryName: string,
  isCustom: boolean,
  accentIndexByName: ReadonlyMap<string, number>
): string {
  const theme = getTagThemeForCategory(categoryName, accentIndexByName);
  return cn(
    theme.tag,
    isCustom && 'ring-2 ring-[color:color-mix(in_srgb,var(--color-border-focus-active)_70%,white)]'
  );
}
