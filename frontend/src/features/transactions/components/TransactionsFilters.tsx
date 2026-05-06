import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn, Input } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';
import { getTagThemeForCategory } from '../../../utils/categories';

interface Props {
  search: string;
  onSearch: (s: string) => void;
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (c: string | null) => void;
  showSearch?: boolean;
  showCategories?: boolean;
}

export const TransactionsFilters: React.FC<Props> = ({
  search,
  onSearch,
  categories,
  selectedCategory,
  onSelectCategory,
  showSearch = true,
  showCategories = true,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    setShowLeftFade(el.scrollLeft > 0);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  return (
    <>
      {showSearch && (
        <div className={cn('relative', 'w-full', 'sm:w-64')}>
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search transactions..."
            variant="default"
            inputSize="md"
            className={cn('placeholder:text-slate-400 dark:placeholder:text-slate-500')}
          />
        </div>
      )}
      {showCategories && (
        <div className={cn('flex', 'w-full', 'items-center', 'gap-3')}>
          <span
            className={cn(
              'flex-shrink-0',
              designTokens.typography.label,
              'text-slate-500',
              'transition-colors',
              'duration-500',
              'dark:text-slate-400'
            )}
          >
            Filter
          </span>
          <div className={cn('relative', 'min-w-0', 'flex-1')}>
            <div
              ref={scrollContainerRef}
              onScroll={checkScroll}
              className={cn(
                'scrollbar-hide',
                'flex',
                'items-center',
                'gap-2',
                'overflow-x-auto',
                'pb-1',
                'pl-1',
                'pt-1'
              )}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {categories.map((name) => {
                const isSelected = selectedCategory === name;
                const theme = getTagThemeForCategory(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onSelectCategory(isSelected ? null : name)}
                    className={cn(
                      designTokens.components.pill.base,
                      'whitespace-nowrap transition-all duration-150 backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
                      theme.tag,
                      isSelected
                        ? ['ring-2', theme.ring]
                        : 'hover:-translate-y-[2px] hover:shadow-lg'
                    )}
                    aria-pressed={isSelected}
                    title={isSelected ? `Remove filter: ${name}` : `Filter by ${name}`}
                  >
                    <span
                      className={cn(designTokens.components.pill.dot, theme.dot)}
                      aria-hidden="true"
                    />
                    {name}
                  </button>
                );
              })}
            </div>
            {showLeftFade && (
              <div className={cn(designTokens.components.pill.fadeLeft, 'w-8')} />
            )}
            {showRightFade && (
              <div className={cn(designTokens.components.pill.fadeRight, 'w-8')} />
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TransactionsFilters;
