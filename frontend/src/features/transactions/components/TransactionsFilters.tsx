import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useHorizontalScrollRail } from '@/hooks/useHorizontalScrollRail';
import type { CustomCategory } from '@/types/api';
import { Button, cn, Input } from '@/ui/primitives';
import { buildPillScrollMask, pillScrollFadeRecipes } from '@/ui/primitives/Pill';
import {
  brandNeutral,
  categoryFilterChip,
  control,
  placeholder as uiPlaceholderRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { categoryThemeVars } from '@/ui/tokens';
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
  const deleteAnchorRef = useRef<HTMLElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomCategory | null>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    const overflowing = el.scrollWidth > el.clientWidth + 1;
    setIsOverflowing(overflowing);
    setShowLeftFade(overflowing && el.scrollLeft > 1);
    setShowRightFade(overflowing && el.scrollLeft < maxScrollLeft - 1);
  }, []);

  const { scrollByAmount, startHoverScroll, stopHoverScroll } = useHorizontalScrollRail(
    scrollContainerRef,
    checkScroll
  );

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
  const categoryScrollMask = isInline ? undefined : scrollMask;

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
              ? ['items-center', 'min-w-0']
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
              'overflow-visible',
              isInline ? 'flex-1' : ['md:flex-1']
            )}
          >
            {showLeftFade ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                shape="square"
                aria-label="Scroll categories left"
                title="Scroll categories left"
                className={cn(
                  ...transactionsRowRecipes.contextualFilterScrollArrow,
                  ...transactionsRowRecipes.contextualFilterScrollArrowLeft
                )}
                onMouseEnter={() => startHoverScroll(-1)}
                onMouseLeave={stopHoverScroll}
                onFocus={stopHoverScroll}
                onClick={() => scrollByAmount(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
            ) : null}
            {showRightFade ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                shape="square"
                aria-label="Scroll categories right"
                title="Scroll categories right"
                className={cn(
                  ...transactionsRowRecipes.contextualFilterScrollArrow,
                  ...transactionsRowRecipes.contextualFilterScrollArrowRight
                )}
                onMouseEnter={() => startHoverScroll(1)}
                onMouseLeave={stopHoverScroll}
                onFocus={stopHoverScroll}
                onClick={() => scrollByAmount(1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            ) : null}
            <div
              className={cn(
                ...(isInline
                  ? transactionsRowRecipes.contextualFilterMaskViewport
                  : pillScrollFadeRecipes.maskViewport)
              )}
              style={
                categoryScrollMask
                  ? {
                      maskImage: categoryScrollMask,
                      WebkitMaskImage: categoryScrollMask,
                    }
                  : undefined
              }
            >
              <div
                ref={scrollContainerRef}
                onScroll={checkScroll}
                data-no-swipe
                className={cn(
                  ...pillScrollFadeRecipes.scroll,
                  !isOverflowing && 'justify-center',
                  'min-w-0',
                  'max-w-full',
                  isInline && 'w-full',
                  isInline && transactionsRowRecipes.contextualFilterScroll
                )}
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
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
                        isSelected && transactionsRowRecipes.selectedCategorySticky,
                        isSelected &&
                          (showLeftFade
                            ? transactionsRowRecipes.selectedCategoryStickyLeftOffset
                            : transactionsRowRecipes.selectedCategoryStickyLeft),
                        isSelected &&
                          (showRightFade
                            ? transactionsRowRecipes.selectedCategoryStickyRightOffset
                            : transactionsRowRecipes.selectedCategoryStickyRight),
                        isCustom && 'transition-all duration-200 ease-out hover:-translate-y-[2px]'
                      )}
                    >
                      <Button
                        type="button"
                        variant="filterChip"
                        size="sm"
                        shape="pill"
                        onClick={() => onSelectCategory(isSelected ? null : name)}
                        style={categoryThemeVars(theme)}
                        className={cn(
                          'whitespace-nowrap',
                          transactionsRowRecipes.categoryFilterPill,
                          isCustom && 'pr-10 hover:translate-y-0',
                          isInline && 'hover:translate-y-0',
                          theme.inlineLabel,
                          isSelected
                            ? categoryFilterChip.surfaceSelected
                            : categoryFilterChip.surface,
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
                            brandNeutral.textSubtle,
                            'text-sm',
                            'leading-none',
                            'transition-colors',
                            'duration-200',
                            'hover:bg-transparent',
                            brandNeutral.textHoverStrong,
                            'focus-visible:outline-none',
                            'focus-visible:ring-2',
                            'focus-visible:ring-[var(--color-border-focus-active)]',
                            'focus-visible:ring-offset-2',
                            'focus-visible:ring-offset-[var(--color-brand-fog)]',
                            'dark:focus-visible:ring-offset-[var(--color-brand-navy)]'
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteAnchorRef.current = event.currentTarget;
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
        </div>
      )}
      {deleteTarget ? (
        <DeleteCustomCategoryConfirm
          open
          anchorRef={deleteAnchorRef}
          category={deleteTarget}
          onRequestClose={() => setDeleteTarget(null)}
          onSuccess={handleDeleteSuccess}
        />
      ) : null}
    </>
  );
};

export default TransactionsFilters;
