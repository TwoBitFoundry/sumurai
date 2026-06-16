import { Search, X } from 'lucide-react';
import { cn, Input } from '@/ui/primitives';
import {
  floatingChromeGlass,
  floatingChromeSearch,
  focus as uiFocusRecipes,
  placeholder as uiPlaceholderRecipes,
  text as uiTextRecipes,
} from '@/ui/recipes';

interface TransactionsSearchBarProps {
  search: string;
  onSearch: (value: string) => void;
}

export function TransactionsSearchBar({ search, onSearch }: TransactionsSearchBarProps) {
  const hasSearch = search.length > 0;

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
            hasSearch && '!pr-11',
            uiPlaceholderRecipes.muted
          )}
        />
        {hasSearch ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearch('')}
            className={cn(
              'absolute',
              'right-2.5',
              'top-1/2',
              'z-10',
              '-translate-y-1/2',
              'rounded-[length:var(--radius-standard)]',
              'p-1',
              uiTextRecipes.subtle,
              'transition-colors',
              'duration-200',
              'hover:text-slate-700',
              'dark:hover:text-slate-200',
              uiFocusRecipes.visible
            )}
          >
            <X className={floatingChromeSearch.glyph} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default TransactionsSearchBar;
