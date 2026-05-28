import type { CustomCategory } from '@/types/api';
import { cn } from '@/ui/primitives';
import { border as semanticBorders } from '@/ui/recipes';
import TransactionsFilters from './TransactionsFilters';

interface TransactionsToolbarProps {
  search: string;
  onSearch: (s: string) => void;
  categories: string[];
  customCategories?: CustomCategory[];
  selectedCategory: string | null;
  onSelectCategory: (c: string | null) => void;
}

const toolbarShell = ['border-b px-3 pb-4 pt-6 md:px-6', ...semanticBorders.subtle] as const;

export const TransactionsToolbar = ({
  search,
  onSearch,
  categories,
  customCategories = [],
  selectedCategory,
  onSelectCategory,
}: TransactionsToolbarProps) => {
  return (
    <div className={cn(toolbarShell)} data-testid="transactions-toolbar">
      <div className={cn('flex', 'items-center', 'gap-4')}>
        <div className={cn('min-w-0', 'flex-1')}>
          <TransactionsFilters
            search={search}
            onSearch={onSearch}
            categories={categories}
            customCategories={customCategories}
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
            showSearch={false}
            showCategories
          />
        </div>
      </div>
    </div>
  );
};

export default TransactionsToolbar;
