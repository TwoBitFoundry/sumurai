import { useVirtualizer } from '@tanstack/react-virtual';
import { Receipt } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { cn, EmptyState } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  text as uiTextRecipes,
  transactionsTable as uiTransactionsTableRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { PREFETCH_THRESHOLD, useInfiniteTransactions } from '../hooks/useInfiniteTransactions';
import type { TransactionWindowFilters } from '../models/transactionWindow';
import DesktopTransactionRow from './DesktopTransactionRow';
import MobileTransactionRow from './MobileTransactionRow';
import { DESKTOP_ROW_H, MOBILE_ROW_H, transactionsRowRecipes } from './transactionsRowRecipes';

interface Props {
  filters: TransactionWindowFilters;
  variant?: 'page' | 'contextual';
  emptyState?: React.ReactNode;
  className?: string;
  onMerchantSearch?: (merchant: string) => void;
  onAccountFilter?: (accountId: string) => void;
}

const OVERSCAN = 10;

const virtualItemShellStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
};

export const VirtualizedTransactionList: React.FC<Props> = ({
  filters,
  variant = 'page',
  emptyState,
  className,
  onMerchantSearch,
  onAccountFilter,
}) => {
  const { isDesktop } = useViewportBreakpoint();
  const showDesktopLayout = isDesktop && variant === 'page';
  const layoutKey = showDesktopLayout ? 'desktop' : 'mobile';
  const rowH = showDesktopLayout ? DESKTOP_ROW_H : MOBILE_ROW_H;

  const { rows, hasNextPage, isFetchingNextPage, fetchNextPage, isInitialLoading, filterKey } =
    useInfiniteTransactions(filters);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [listHeight, setListHeight] = useState<number | null>(null);
  const [openRowIndex, setOpenRowIndex] = useState<number | null>(null);

  useEffect(() => {
    if (variant !== 'contextual') return;
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerHeight(entry?.contentRect.height ?? 0);
    });
    observer.observe(el);
    setContainerHeight(el.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [variant]);

  useEffect(() => {
    if (variant !== 'page') return;
    const el = scrollRef.current;
    if (!el) return;

    const BOTTOM_GAP = 24;
    const MIN_HEIGHT = 384;

    const compute = () => {
      const chrome = document.querySelector('[data-floating-chrome]') as HTMLElement | null;
      const chromeTop = chrome ? chrome.getBoundingClientRect().top : window.innerHeight;
      const listTop = el.getBoundingClientRect().top;
      setListHeight(Math.max(MIN_HEIGHT, chromeTop - listTop - BOTTOM_GAP));
    };

    compute();

    let timer: ReturnType<typeof setTimeout>;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(compute, 150);
    };

    window.addEventListener('resize', debounced);

    const chrome = document.querySelector('[data-floating-chrome]');
    const chromeObserver = chrome ? new ResizeObserver(debounced) : null;
    if (chrome && chromeObserver) chromeObserver.observe(chrome);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) compute();
      },
      { threshold: 0.1 }
    );
    intersectionObserver.observe(el);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', debounced);
      chromeObserver?.disconnect();
      intersectionObserver.disconnect();
    };
  }, [variant]);

  const totalCount = rows.length + (hasNextPage ? 1 : 0);

  const rangeExtractor = useCallback(
    (range: { startIndex: number; endIndex: number; overscan: number; count: number }) => {
      const start = Math.max(0, range.startIndex - range.overscan);
      const end = Math.min(range.count - 1, range.endIndex + range.overscan);
      const indices: number[] = [];
      for (let i = start; i <= end; i += 1) {
        indices.push(i);
      }
      if (openRowIndex !== null && !indices.includes(openRowIndex)) {
        indices.push(openRowIndex);
        indices.sort((a, b) => a - b);
      }
      return indices;
    },
    [openRowIndex]
  );

  const isContextual = variant === 'contextual';
  const canVirtualize = !isContextual || containerHeight > 0;

  const virtualizer = useVirtualizer({
    count: canVirtualize ? totalCount : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowH,
    getItemKey: (index) => `${layoutKey}-${index}`,
    overscan: OVERSCAN,
    rangeExtractor,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems.at(-1);
    if (!lastItem) return;
    if (lastItem.index >= rows.length - PREFETCH_THRESHOLD && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [virtualItems, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only fires on filter change, not on every virtualizer update
  useEffect(() => {
    if (canVirtualize) {
      virtualizerRef.current.scrollToIndex(0);
    }
  }, [filterKey, canVirtualize]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: remeasure after layout switch so row heights match mobile/desktop chrome
  useEffect(() => {
    if (!canVirtualize) return;
    virtualizerRef.current.measure();
    virtualizerRef.current.scrollToIndex(0);
  }, [layoutKey, canVirtualize]);

  const isEmpty = !isInitialLoading && rows.length === 0 && !hasNextPage;
  const readOnly = variant === 'contextual';
  const merchantSearchHandler = variant === 'page' ? onMerchantSearch : undefined;
  const accountFilterHandler = variant === 'page' ? onAccountFilter : undefined;

  return (
    <div
      role="region"
      aria-label="Transaction list"
      className={cn(
        'flex min-w-0 max-w-full flex-col overflow-x-hidden',
        isContextual ? 'absolute inset-0 min-h-0' : 'relative',
        className
      )}
    >
      {showDesktopLayout && (
        <div
          role="row"
          aria-rowindex={1}
          className={cn(
            transactionsRowRecipes.desktopGridCols,
            transactionsRowRecipes.desktopGridHeader,
            uiTransactionsTableRecipes.chromeBar,
            'border-b',
            uiBorderRecipes.divider,
            uiTextRecipes.body,
            'transition-colors duration-500'
          )}
        >
          <div
            role="columnheader"
            className={cn('pl-4 py-3 md:pl-8 lg:pl-8', uiTypographyRecipes.label)}
          >
            Date
          </div>
          <div role="columnheader" className={cn('px-4 py-3', uiTypographyRecipes.label)}>
            Merchant
          </div>
          <div
            role="columnheader"
            className={cn('px-4 py-3 text-right', uiTypographyRecipes.label)}
          >
            Amount
          </div>
          <div
            role="columnheader"
            className={cn('hidden md:block px-4 py-3', uiTypographyRecipes.label)}
          >
            Account
          </div>
          <div
            role="columnheader"
            className={cn('pr-4 py-3 text-right md:pr-8 lg:pr-8', uiTypographyRecipes.label)}
          >
            Category
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        role="table"
        aria-label="Transactions"
        className={cn(
          ...uiTransactionsTableRecipes.listViewport,
          isContextual ? 'min-h-0 flex-1' : ''
        )}
        style={!isContextual && listHeight != null ? { height: `${listHeight}px` } : undefined}
        data-no-swipe
      >
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {isInitialLoading ? 'Loading transactions' : null}
          {isFetchingNextPage ? 'Loading more transactions' : null}
        </div>

        {isEmpty ? (
          <div className="flex items-center justify-center h-full min-h-[12rem]">
            {emptyState ?? (
              <EmptyState
                icon={Receipt}
                title="No transactions found"
                description="No transaction data available for the selected filters"
              />
            )}
          </div>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualItems.map((item) => {
              const isSentinel = item.index >= rows.length;
              const row = rows[item.index];
              const itemStyle: React.CSSProperties = {
                ...virtualItemShellStyle,
                height: `${item.size}px`,
                transform: `translateY(${item.start}px)`,
              };

              if (isSentinel) {
                return (
                  <div
                    key={item.key}
                    ref={virtualizer.measureElement}
                    data-index={item.index}
                    aria-hidden="true"
                    style={itemStyle}
                    className={cn(
                      transactionsRowRecipes.placeholder,
                      showDesktopLayout
                        ? transactionsRowRecipes.placeholderDesktopHeight
                        : transactionsRowRecipes.placeholderMobileHeight,
                      transactionsRowRecipes.even
                    )}
                  />
                );
              }

              if (!row) return null;

              return (
                <div
                  key={item.key}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  style={itemStyle}
                >
                  {showDesktopLayout ? (
                    <DesktopTransactionRow
                      transaction={row}
                      index={item.index}
                      variant={variant}
                      readOnly={readOnly}
                      onCategoryOpen={setOpenRowIndex}
                      onCategoryClose={() => setOpenRowIndex(null)}
                      onMerchantSearch={merchantSearchHandler}
                      onAccountFilter={accountFilterHandler}
                    />
                  ) : (
                    <MobileTransactionRow
                      transaction={row}
                      index={item.index}
                      variant={variant}
                      readOnly={readOnly}
                      onCategoryOpen={setOpenRowIndex}
                      onCategoryClose={() => setOpenRowIndex(null)}
                      onMerchantSearch={merchantSearchHandler}
                      onAccountFilter={accountFilterHandler}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VirtualizedTransactionList;
