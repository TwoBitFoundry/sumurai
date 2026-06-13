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
}

const OVERSCAN = 5;

export const VirtualizedTransactionList: React.FC<Props> = ({
  filters,
  variant = 'page',
  emptyState,
  className,
}) => {
  const { isDesktop } = useViewportBreakpoint();
  const { breakpoint } = useViewportBreakpoint();
  const rowH = isDesktop ? DESKTOP_ROW_H : MOBILE_ROW_H;

  const { rows, hasNextPage, isFetchingNextPage, fetchNextPage, isInitialLoading, filterKey } =
    useInfiniteTransactions(filters);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [openRowIndex, setOpenRowIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerHeight(entry?.contentRect.height ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  const virtualizer = useVirtualizer({
    count: containerHeight > 0 ? totalCount : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowH,
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
    if (containerHeight > 0) {
      virtualizerRef.current.scrollToIndex(0);
    }
  }, [filterKey]);

  const isEmpty = !isInitialLoading && rows.length === 0 && !hasNextPage;

  const maxHClass =
    variant === 'contextual' ? 'max-h-[min(50dvh,32rem)]' : 'h-[clamp(24rem,60dvh,80dvh)]';

  return (
    <div
      role="region"
      aria-label="Transaction list"
      className={cn('relative flex flex-col', className)}
    >
      {isDesktop && (
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
          <div role="columnheader" className={cn('px-4 py-3', uiTypographyRecipes.label)}>
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
            className={cn('px-4 py-3 text-right', uiTypographyRecipes.label)}
          >
            Category
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        role="table"
        aria-label="Transactions"
        className={cn('relative overflow-y-auto overscroll-contain', maxHClass)}
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
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualItems.map((item) => {
              const isSentinel = item.index >= rows.length;
              const row = rows[item.index];
              const style: React.CSSProperties = {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${item.size}px`,
                transform: `translateY(${item.start}px)`,
              };

              if (isSentinel) {
                return (
                  <div
                    key="sentinel"
                    aria-hidden="true"
                    style={style}
                    className={cn(
                      transactionsRowRecipes.placeholder,
                      breakpoint === 'desktop'
                        ? transactionsRowRecipes.placeholderDesktopHeight
                        : transactionsRowRecipes.placeholderMobileHeight,
                      transactionsRowRecipes.even
                    )}
                  />
                );
              }

              if (!row) return null;

              return isDesktop ? (
                <DesktopTransactionRow
                  key={row.id}
                  transaction={row}
                  index={item.index}
                  style={style}
                  onCategoryOpen={setOpenRowIndex}
                  onCategoryClose={() => setOpenRowIndex(null)}
                />
              ) : (
                <MobileTransactionRow
                  key={row.id}
                  transaction={row}
                  index={item.index}
                  style={style}
                  onCategoryOpen={setOpenRowIndex}
                  onCategoryClose={() => setOpenRowIndex(null)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VirtualizedTransactionList;
