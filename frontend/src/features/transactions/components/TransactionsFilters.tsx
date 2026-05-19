import { Search } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn, Input } from '@/ui/primitives';
import { pillRecipes, pillScrollFadeRecipes } from '@/ui/primitives/Pill';
import {
  placeholder as uiPlaceholderRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { formatCategoryName, getTagThemeForCategory } from '../../../utils/categories';

interface Props {
  search: string;
  onSearch: (s: string) => void;
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (c: string | null) => void;
  showSearch?: boolean;
  showCategories?: boolean;
  showFilterLabel?: boolean;
  scrollFadeSurface?: keyof typeof pillScrollFadeRecipes;
}

export const TransactionsFilters: React.FC<Props> = ({
  search,
  onSearch,
  categories,
  selectedCategory,
  onSelectCategory,
  showSearch = true,
  showCategories = true,
  showFilterLabel = true,
  scrollFadeSurface = 'card',
}) => {
  const scrollFade = pillScrollFadeRecipes[scrollFadeSurface];
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

    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });
    resizeObserver.observe(el);

    window.addEventListener('resize', checkScroll);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  useEffect(() => {
    if (!showCategories) return;
    const frame = requestAnimationFrame(() => {
      if (categories.length >= 0) {
        checkScroll();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [categories.length, showCategories, checkScroll]);

  return (
    <>
      {showSearch && (
        <div className={cn('relative', 'w-full', 'md:w-64')}>
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
            variant="default"
            inputSize="md"
            className={cn('pl-10', uiPlaceholderRecipes.muted)}
          />
        </div>
      )}
      {showCategories && (
        <div className={cn('flex', 'w-full', 'items-center', 'gap-3')}>
          {showFilterLabel ? (
            <span
              className={cn(
                'flex-shrink-0',
                uiTypographyRecipes.label,
                uiTextRecipes.label,
                'transition-colors',
                'duration-500'
              )}
            >
              Filter
            </span>
          ) : null}
          <div className={cn('relative', 'min-w-0', 'flex-1', 'overflow-hidden')}>
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
                const label = formatCategoryName(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onSelectCategory(isSelected ? null : name)}
                    className={cn(
                      pillRecipes.base,
                      'whitespace-nowrap transition-all duration-200 ease-out active:scale-[0.98] backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
                      theme.tag,
                      isSelected
                        ? ['ring-2', theme.ring]
                        : 'hover:-translate-y-[2px] hover:shadow-lg'
                    )}
                    aria-pressed={isSelected}
                    title={isSelected ? `Remove filter: ${label}` : `Filter by ${label}`}
                  >
                    <span className={cn(pillRecipes.dot, theme.dot)} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
            {showLeftFade ? <div className={scrollFade.left} /> : null}
            {showRightFade ? <div className={scrollFade.right} /> : null}
          </div>
        </div>
      )}
    </>
  );
};

export default TransactionsFilters;
