import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Search } from 'lucide-react';
import { Button, cn, Input } from '@/ui/primitives';
import {
  floatingChromeGlass,
  floatingChromeSearch,
  border as semanticBorders,
  surface as semanticSurfaces,
  placeholder as uiPlaceholderRecipes,
  text as uiTextRecipes,
} from '@/ui/recipes';

const floatingChromePaginationButton = cn(
  ...semanticSurfaces.floatingChromePanel,
  ...semanticBorders.floatingChrome,
  ...floatingChromeGlass.backdrop,
  'shadow-none',
  uiTextRecipes.muted,
  floatingChromeSearch.height,
  'w-[52px] md:w-12 lg:w-12',
  'hover:border-[var(--color-border-default)]',
  'hover:bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_32%,transparent)]',
  'dark:hover:bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_62%,transparent)]',
  'hover:text-slate-900 dark:hover:text-white',
  'disabled:hover:translate-y-0'
);

interface TransactionsSearchBarProps {
  search: string;
  onSearch: (value: string) => void;
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

export function TransactionsSearchBar({
  search,
  onSearch,
  currentPage,
  totalPages,
  onPrev,
  onNext,
}: TransactionsSearchBarProps) {
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
      <div
        className={cn('flex', 'shrink-0', 'items-center', 'gap-1.5')}
        data-testid="transactions-search-pagination"
      >
        <Button
          type="button"
          variant="ghost"
          shape="square"
          size="lg"
          onClick={onPrev}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className={floatingChromePaginationButton}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          shape="square"
          size="lg"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className={floatingChromePaginationButton}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}

export default TransactionsSearchBar;
