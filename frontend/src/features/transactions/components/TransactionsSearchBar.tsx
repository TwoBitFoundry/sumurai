import { cn, Input } from '@/ui/primitives';
import {
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
  placeholder as uiPlaceholderRecipes,
} from '@/ui/recipes';

interface TransactionsSearchBarProps {
  search: string;
  onSearch: (value: string) => void;
}

export function TransactionsSearchBar({ search, onSearch }: TransactionsSearchBarProps) {
  return (
    <div className={cn('w-full', 'max-w-full')} data-no-swipe data-testid="transactions-search-bar">
      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search transactions..."
        variant="glass"
        inputSize="md"
        className={cn(
          ...semanticSurfaces.glassPanel,
          ...semanticBorders.glass,
          ...semanticEffects.glassShadow,
          'backdrop-blur-md backdrop-saturate-[150%]',
          'w-full',
          'min-w-0',
          uiPlaceholderRecipes.muted
        )}
      />
    </div>
  );
}

export default TransactionsSearchBar;
