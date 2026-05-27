import { Search } from 'lucide-react';
import { cn, Input } from '@/ui/primitives';
import {
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
      className={cn('relative', 'min-w-0', 'w-full', 'max-w-full')}
      data-no-swipe
      data-testid="transactions-search-bar"
    >
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
          'backdrop-blur-md backdrop-saturate-[150%]',
          'w-full',
          'min-w-0',
          '!pl-11',
          uiPlaceholderRecipes.muted
        )}
      />
    </div>
  );
}

export default TransactionsSearchBar;
