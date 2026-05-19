import { Search } from 'lucide-react';
import { cn, Input } from '@/ui/primitives';
import {
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
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
      className={cn('relative', 'w-full', 'max-w-full')}
      data-no-swipe
      data-testid="transactions-search-bar"
    >
      <Search
        className={cn(
          'pointer-events-none',
          'absolute',
          'left-3',
          'top-1/2',
          'z-10',
          'h-4',
          'w-4',
          '-translate-y-1/2',
          uiTextRecipes.subtle
        )}
        aria-hidden
      />
      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search transactions"
        variant="glass"
        inputSize="md"
        className={cn(
          ...semanticSurfaces.glassPanel,
          ...semanticBorders.glass,
          ...semanticEffects.glassShadow,
          'backdrop-blur-md backdrop-saturate-[150%]',
          'w-full',
          'min-w-0',
          'pl-10',
          uiPlaceholderRecipes.muted
        )}
      />
    </div>
  );
}

export default TransactionsSearchBar;
