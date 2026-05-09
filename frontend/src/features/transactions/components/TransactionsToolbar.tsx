import { cn } from '@/ui/primitives';
import { border as semanticBorders } from '@/ui/recipes';
import TransactionsFilters from './TransactionsFilters';

interface TransactionsToolbarProps {
  search: string;
  onSearch: (s: string) => void;
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (c: string | null) => void;
}

const toolbarShell = ['border-b px-6 pb-4 pt-6', ...semanticBorders.subtle] as const;

export const TransactionsToolbar = ({
  search,
  onSearch,
  categories,
  selectedCategory,
  onSelectCategory,
}: TransactionsToolbarProps) => {
  return (
    <div className={cn(toolbarShell)} data-testid="transactions-toolbar">
      <div className={cn('flex', 'items-center', 'gap-4')}>
        <div className={cn('flex-1', 'min-w-0')}>
          <TransactionsFilters
            search={search}
            onSearch={onSearch}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
            showSearch={false}
            showCategories
          />
        </div>
        <div className="flex-shrink-0">
          <TransactionsFilters
            search={search}
            onSearch={onSearch}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
            showSearch
            showCategories={false}
          />
        </div>
      </div>
    </div>
  );
};

export default TransactionsToolbar;
