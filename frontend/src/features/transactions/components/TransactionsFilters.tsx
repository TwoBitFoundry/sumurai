import { Search } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CustomCategory } from '@/types/api';
import { Button, cn, IconButton, Input } from '@/ui/primitives';
import { pillRecipes, pillScrollFadeRecipes } from '@/ui/primitives/Pill';
import {
  control,
  placeholder as uiPlaceholderRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { formatCategoryName, getTagThemeForCategory } from '../../../utils/categories';
import DeleteCustomCategoryConfirm from './DeleteCustomCategoryConfirm';

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
        <div className={cn('flex', 'w-full', 'items-center', 'gap-3')}>
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
                const customCategory = customCategories.find(
                  (category) => category.display_name === name
                );
                const isCustom = Boolean(customCategory);
                return (
                  <span key={name} className={cn('relative', 'inline-flex', 'items-center')}>
                    <Button
                      type="button"
                      variant="filterChip"
                      size="sm"
                      shape="pill"
                      onClick={() => onSelectCategory(isSelected ? null : name)}
                      className={cn(
                        'whitespace-nowrap',
                        isCustom && 'pr-8',
                        theme.tag,
                        isSelected
                          ? ['ring-2', theme.ring]
                          : 'ring-1 ring-white/60 dark:ring-white/10'
                      )}
                      aria-pressed={isSelected}
                      title={isSelected ? `Remove filter: ${label}` : `Filter by ${label}`}
                    >
                      <span className={cn(pillRecipes.dot, theme.dot)} aria-hidden="true" />
                      {label}
                    </Button>
                    {isCustom && customCategory ? (
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${label}`}
                        title={`Delete ${label}`}
                        className={cn('absolute', 'right-0.5', 'top-1/2', '-translate-y-1/2')}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(customCategory);
                        }}
                      >
                        <span aria-hidden="true">×</span>
                      </IconButton>
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
