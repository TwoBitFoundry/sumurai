import { Search } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CustomCategory } from '@/types/api';
import { Button, cn, Input } from '@/ui/primitives';
import { pillScrollFadeRecipes } from '@/ui/primitives/Pill';
import {
  control,
  placeholder as uiPlaceholderRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { formatCategoryName, getTagThemeForCategoryAtIndex } from '../../../utils/categories';
import DeleteCustomCategoryConfirm from './DeleteCustomCategoryConfirm';
import { transactionsRowRecipes } from './transactionsRowRecipes';

interface Props {
  search: string;
  onSearch: (s: string) => void;
  categories: string[];
  customCategories?: CustomCategory[];
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
  customCategories = [],
  selectedCategory,
  onSelectCategory,
  showSearch = true,
  showCategories = true,
  showFilterLabel = true,
  scrollFadeSurface = 'card',
}) => {
  const scrollFade = pillScrollFadeRecipes[scrollFadeSurface];
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomCategory | null>(null);
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

  const handleDeleteSuccess = () => {
    if (deleteTarget && selectedCategory === deleteTarget.display_name) {
      onSelectCategory(null);
    }
    setDeleteTarget(null);
  };

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
              control.glyph.md,
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
        <div
          className={cn(
            'flex',
            'w-full',
            'flex-col',
            'gap-2',
            'md:flex-row',
            'md:items-center',
            'md:gap-3'
          )}
        >
          {showFilterLabel ? (
            <span
              className={cn(
                'flex-shrink-0',
                uiTypographyRecipes.badge,
                uiTextRecipes.label,
                'transition-colors',
                'duration-500'
              )}
            >
              Filter
            </span>
          ) : null}
          <div className={cn('relative', 'min-w-0', 'w-full', 'md:flex-1', 'overflow-hidden')}>
            <div
              ref={scrollContainerRef}
              onScroll={checkScroll}
              className={cn(
                'scrollbar-hide',
                'flex',
                'items-center',
                'gap-1',
                'overflow-x-auto',
                'px-1',
                'pb-1',
                'pt-1'
              )}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {categories.map((name, index) => {
                const isSelected = selectedCategory === name;
                const theme = getTagThemeForCategoryAtIndex(index);
                const label = formatCategoryName(name);
                const customCategory = customCategories.find(
                  (category) => category.display_name === name
                );
                const isCustom = Boolean(customCategory);
                return (
                  <span
                    key={name}
                    className={cn(
                      'group relative inline-flex items-center',
                      isCustom && 'transition-all duration-200 ease-out hover:-translate-y-[2px]'
                    )}
                  >
                    <Button
                      type="button"
                      variant="filterChip"
                      size="sm"
                      shape="pill"
                      onClick={() => onSelectCategory(isSelected ? null : name)}
                      className={cn(
                        'whitespace-nowrap',
                        transactionsRowRecipes.categoryFilterPill,
                        isCustom &&
                          'pr-10 hover:translate-y-0 hover:shadow-none group-hover:shadow-lg',
                        theme.tag,
                        isSelected
                          ? ['ring-2', theme.ring]
                          : 'ring-1 ring-white/60 dark:ring-white/10'
                      )}
                      aria-pressed={isSelected}
                      title={isSelected ? `Remove filter: ${label}` : `Filter by ${label}`}
                    >
                      {label}
                    </Button>
                    {isCustom && customCategory ? (
                      <button
                        type="button"
                        aria-label={`Delete ${label}`}
                        title={`Delete ${label}`}
                        className={cn(
                          'absolute',
                          'right-0.5',
                          'top-1/2',
                          '-translate-y-1/2',
                          'inline-flex',
                          'h-6',
                          'w-6',
                          'items-center',
                          'justify-center',
                          'border-0',
                          'bg-transparent',
                          'p-0',
                          'text-slate-500',
                          'text-sm',
                          'leading-none',
                          'shadow-none',
                          'transition-colors',
                          'duration-200',
                          'hover:bg-transparent',
                          'hover:text-slate-700',
                          'dark:hover:text-slate-300',
                          'focus-visible:outline-none',
                          'focus-visible:ring-2',
                          'focus-visible:ring-[var(--color-border-focus-active)]',
                          'focus-visible:ring-offset-2',
                          'focus-visible:ring-offset-white',
                          'dark:focus-visible:ring-offset-slate-900'
                        )}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(customCategory);
                        }}
                      >
                        <span aria-hidden="true" className={cn('relative', '-top-px')}>
                          ×
                        </span>
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
            {showLeftFade ? <div className={scrollFade.left} /> : null}
            {showRightFade ? <div className={scrollFade.right} /> : null}
          </div>
        </div>
      )}
      {deleteTarget ? (
        <DeleteCustomCategoryConfirm
          open
          category={deleteTarget}
          onRequestClose={() => setDeleteTarget(null)}
          onSuccess={handleDeleteSuccess}
        />
      ) : null}
    </>
  );
};

export default TransactionsFilters;
