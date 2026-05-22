import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Transaction } from '@/types/api';
import { cn, IconButton, Pill } from '@/ui/primitives';
import { formatCategoryName } from '@/utils/categories';
import { useUpdateTransactionCategory } from '../hooks/useUpdateTransactionCategory';
import CategoryPicker from './CategoryPicker';

interface Props {
  transaction: Transaction;
}

export function InlineCategoryCell({ transaction }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { updateTransactionCategory } = useUpdateTransactionCategory();

  const category = transaction.category;
  const categoryName = category?.primary ?? 'Other';
  const isCustom = Boolean(category?.is_custom);
  const label = formatCategoryName(categoryName);

  return (
    <div className={cn('inline-flex', 'items-center', 'gap-1.5')}>
      <Pill
        variant="category"
        categoryName={categoryName}
        className={cn(
          'transition-all duration-200 backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
          isCustom &&
            'ring-2 ring-[color:color-mix(in_srgb,var(--color-border-focus-active)_70%,white)]'
        )}
      >
        {label}
      </Pill>
      <IconButton
        ref={anchorRef}
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Edit category: ${label}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        className={cn('shrink-0')}
      >
        <ChevronDown />
      </IconButton>
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
