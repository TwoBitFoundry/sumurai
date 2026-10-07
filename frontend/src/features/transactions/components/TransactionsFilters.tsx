import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/primitives';
import { getTagThemeForCategory } from '../../../utils/categories';

interface Props {
  search?: string;
  onSearch?: (s: string) => void;
  categories?: string[];
  selectedCategory?: string | null;
  onSelectCategory?: (c: string | null) => void;
  subcategories?: string[];
  selectedSubcategory?: string | null;
  onSelectSubcategory?: (s: string | null) => void;
  showSearch?: boolean;
  showCategories?: boolean;
  showSubcategories?: boolean;
}

const ScrollablePillRow: React.FC<{
  label: string;
  allLabel: string;
  items: string[];
  selectedItem: string | null;
  onSelectItem: (item: string | null) => void;
}> = ({ label, allLabel, items, selectedItem, onSelectItem }) => {
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

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;

      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0) return;

      event.preventDefault();
      el.scrollLeft += delta;
      checkScroll();
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [checkScroll]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(checkScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [items, checkScroll]);

  const isAllSelected = !selectedItem;

  return (
    <div className={cn('flex', 'w-full', 'items-center', 'gap-3')}>
      <span
        className={cn(
          'flex-shrink-0',
          'text-[0.65rem]',
          'font-semibold',
          'uppercase',
          'tracking-[0.24em]',
          'text-slate-500',
          'transition-colors',
          'duration-500',
          'dark:text-slate-400',
          'w-28'
        )}
      >
        {label}
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
            'overscroll-contain',
            'pb-1',
            'pl-1',
            'pt-1'
          )}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            overscrollBehavior: 'contain',
          }}
        >
          {/* All button (selected by default when selectedItem is null) */}
          <button
            type="button"
            onClick={() => onSelectItem(null)}
            className={cn(
              'inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] transition-all duration-200 backdrop-blur-sm',
              isAllSelected
                ? 'font-extrabold text-white bg-sky-500 border border-sky-300 dark:border-sky-400 shadow-[0_0_18px_rgba(14,165,233,0.85)] ring-2 ring-sky-300 dark:ring-sky-400 scale-[1.04] ring-offset-1 ring-offset-white dark:ring-offset-slate-950'
                : 'font-semibold bg-slate-100/90 text-slate-600 border border-slate-200/90 hover:bg-slate-200/80 hover:text-slate-900 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/60 dark:hover:bg-slate-700/80 dark:hover:text-slate-200 shadow-sm hover:-translate-y-[1px]'
            )}
            aria-pressed={isAllSelected}
            title={isAllSelected ? `${allLabel} (selected)` : `Show ${allLabel}`}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-all',
                isAllSelected
                  ? 'bg-white shadow-[0_0_8px_#ffffff]'
                  : 'bg-slate-400 dark:bg-slate-500'
              )}
              aria-hidden="true"
            />
            {allLabel}
          </button>

          {items.map((name) => {
            const isSelected = selectedItem?.toLowerCase() === name.toLowerCase();
            const theme = getTagThemeForCategory(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => onSelectItem(isSelected ? null : name)}
                className={cn(
                  'inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] transition-all duration-200 backdrop-blur-sm',
                  isSelected
                    ? theme.selectedTag
                    : 'font-semibold bg-slate-100/90 text-slate-600 border border-slate-200/90 hover:bg-slate-200/80 hover:text-slate-900 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/60 dark:hover:bg-slate-700/80 dark:hover:text-slate-200 shadow-sm hover:-translate-y-[1px]'
                )}
                aria-pressed={isSelected}
                title={isSelected ? `Remove filter: ${name}` : `Filter by ${name}`}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full transition-all',
                    isSelected
                      ? 'bg-white shadow-[0_0_8px_#ffffff]'
                      : `${theme.dot} opacity-75 shadow-[0_0_0_1px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_1px_rgba(15,23,42,0.7)]`
                  )}
                  aria-hidden="true"
                />
                {name}
              </button>
            );
          })}
        </div>
        {showLeftFade && (
          <div
            className={cn(
              'pointer-events-none',
              'absolute',
              'bottom-0',
              'left-0',
              'top-0',
              'w-8',
              'bg-gradient-to-r',
              'from-white',
              'to-transparent',
              'transition-opacity',
              'duration-200',
              'dark:from-[#0f172a]'
            )}
          />
        )}
        {showRightFade && (
          <div
            className={cn(
              'pointer-events-none',
              'absolute',
              'bottom-0',
              'right-0',
              'top-0',
              'w-8',
              'bg-gradient-to-l',
              'from-white',
              'to-transparent',
              'transition-opacity',
              'duration-200',
              'dark:from-[#0f172a]'
            )}
          />
        )}
      </div>
    </div>
  );
};

export const TransactionsFilters: React.FC<Props> = ({
  search = '',
  onSearch,
  categories = [],
  selectedCategory = null,
  onSelectCategory,
  subcategories = [],
  selectedSubcategory = null,
  onSelectSubcategory,
  showSearch = true,
  showCategories = true,
  showSubcategories = false,
}) => {
  return (
    <>
      {showSearch && onSearch && (
        <div className={cn('relative', 'w-full', 'sm:w-52')}>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search transactions..."
            className={cn(
              'w-full',
              'rounded-full',
              'border',
              'border-black/10',
              'bg-white',
              'px-3.5',
              'py-1.5',
              'text-xs',
              'font-medium',
              'text-slate-900',
              'shadow-[0_14px_36px_-28px_rgba(15,23,42,0.45)]',
              'transition-all',
              'duration-200',
              'placeholder:text-slate-400',
              'focus:outline-none',
              'focus:ring-2',
              'focus:ring-sky-400',
              'focus:ring-offset-2',
              'focus:ring-offset-white',
              'dark:border-white/12',
              'dark:bg-[#111a2f]',
              'dark:text-white',
              'dark:placeholder:text-slate-500',
              'dark:focus:ring-sky-400/80',
              'dark:focus:ring-offset-[#0f172a]'
            )}
          />
        </div>
      )}
      {showCategories && onSelectCategory && (
        <ScrollablePillRow
          label="Categories"
          allLabel="All Categories"
          items={categories}
          selectedItem={selectedCategory}
          onSelectItem={onSelectCategory}
        />
      )}
      {showSubcategories && onSelectSubcategory && (
        <ScrollablePillRow
          label="Sub-categories"
          allLabel="All Sub-categories"
          items={subcategories}
          selectedItem={selectedSubcategory}
          onSelectItem={onSelectSubcategory}
        />
      )}
    </>
  );
};

export default TransactionsFilters;
