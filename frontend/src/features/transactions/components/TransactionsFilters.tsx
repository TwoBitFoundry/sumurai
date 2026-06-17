import { Search } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CustomCategory } from '@/types/api';
import { Button, cn, Input } from '@/ui/primitives';
import { buildPillScrollMask, pillScrollFadeRecipes } from '@/ui/primitives/Pill';
import {
  control,
  placeholder as uiPlaceholderRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { formatCategoryName, getTagThemeForCategory } from '../../../utils/categories';
import { useCategories } from '../hooks/useCategories';
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
  layout?: 'stacked' | 'inline';
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
  layout = 'stacked',
}) => {
  const { accentIndexByName } = useCategories();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomCategory | null>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    setShowLeftFade(el.scrollLeft > 1);
    setShowRightFade(el.scrollLeft < maxScrollLeft - 1);
  }, []);

  useLayoutEffect(() => {
    checkScroll();
  }, [checkScroll]);

  useEffect(() => {
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

  const scrollMask = buildPillScrollMask(showLeftFade, showRightFade);
  const isInline = layout === 'inline';

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
          data-testid="transactions-filters"
          className={cn(
            'flex',
            'w-full',
            'min-w-0',
            'max-w-full',
            isInline
              ? ['items-center', 'overflow-hidden']
              : ['flex-col', 'gap-2', 'md:flex-row', 'md:items-center', 'md:gap-3']
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
          <div
            className={cn(
              'relative',
              'min-w-0',
              'w-full',
              'max-w-full',
              isInline ? ['flex-1', 'overflow-hidden'] : ['overflow-hidden', 'md:flex-1']
            )}
          >
            <div
              ref={scrollContainerRef}
              onScroll={checkScroll}
              data-no-swipe
              className={cn(
                ...pillScrollFadeRecipes.scroll,
                'min-w-0',
                'max-w-full',
                isInline && 'w-full',
                isInline && transactionsRowRecipes.contextualFilterScroll
              )}
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                maskImage: scrollMask,
                WebkitMaskImage: scrollMask,
              }}
            >
              {categories.map((name) => {
                const isSelected = selectedCategory === name;
                const theme = getTagThemeForCategory(name, accentIndexByName);
                const label = formatCategoryName(name);
                const customCategory = customCategories.find(
                  (category) => category.display_name === name
                );
                const isCustom = Boolean(customCategory);
                return (
                  <span
                    key={name}
                    className={cn(
                      'group relative inline-flex shrink-0 items-center',
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
                        isCustom && 'pr-10 hover:translate-y-0',
                        isInline && [
                          ...transactionsRowRecipes.contextualFilterChipGlass,
                          'hover:translate-y-0',
                        ],
                        theme.inlineLabel,
                        isSelected ? theme.chipSurfaceSelected : theme.chipSurface,
                        isSelected && ['ring-2', theme.ring]
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
