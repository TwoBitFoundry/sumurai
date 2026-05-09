import { cn } from '@/ui/primitives';
import { dashboardTokenRecipes } from '@/views/tokenRecipes';
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
    <div className={cn(dashboardTokenRecipes.toolbarShell)} data-testid="transactions-toolbar">
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
