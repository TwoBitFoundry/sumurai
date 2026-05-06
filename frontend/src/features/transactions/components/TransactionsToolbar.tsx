import { cn } from '@/ui/primitives';
import TransactionsFilters from './TransactionsFilters';

interface TransactionsToolbarProps {
  search: string;
  onSearch: (s: string) => void;
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (c: string | null) => void;
}

export const TransactionsToolbar = ({
  search,
  onSearch,
  categories,
  selectedCategory,
  onSelectCategory,
}: TransactionsToolbarProps) => {
  return (
    <div
      className={cn(
        'border-b',
        'border-slate-200/70',
        'px-6',
        'pb-4',
        'pt-6',
        'dark:border-slate-700/50'
      )}
      data-testid="transactions-toolbar"
    >
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
