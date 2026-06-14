import { Search } from 'lucide-react';
import { cn, Input } from '@/ui/primitives';
import {
  floatingChromeGlass,
  floatingChromeSearch,
  placeholder as uiPlaceholderRecipes,
  text as uiTextRecipes,
} from '@/ui/recipes';

interface TransactionsSearchBarProps {
  search: string;
  onSearch: (value: string) => void;
}

export function TransactionsSearchBar({ search, onSearch }: TransactionsSearchBarProps) {
  return (
    <div
      className={cn('flex', 'w-full', 'min-w-0', 'max-w-full', 'items-center', 'gap-2')}
      data-no-swipe
      data-testid="transactions-search-bar"
    >
      <div className={cn('relative', 'min-w-0', 'flex-1')}>
        <Search
          className={cn(
            'pointer-events-none',
            'absolute',
            'left-3.5',
            'top-1/2',
            'z-10',
            floatingChromeSearch.glyph,
            '-translate-y-1/2',
            uiTextRecipes.subtle
          )}
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search transactions"
          variant="floatingChrome"
          inputSize="chromeBar"
          className={cn(
            ...floatingChromeGlass.backdrop,
            'w-full',
            'min-w-0',
            '!pl-11',
            uiPlaceholderRecipes.muted
          )}
        />
      </div>
    </div>
  );
}

export default TransactionsSearchBar;
