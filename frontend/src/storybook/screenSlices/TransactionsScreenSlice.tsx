import { AlertTriangle, ReceiptText, RefreshCcw, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import HeroStatCard from '@/components/widgets/HeroStatCard';
import VirtualizedTransactionList from '@/features/transactions/components/VirtualizedTransactionList';
import { PageLayout } from '@/layouts/PageLayout';
import { transactionsTablePage } from '@/storybook/fixtures/transactions';
import { jsonResponse, route, StoryApiScope } from '@/storybook/screens/user-journeys/storyApi';
import type { CursorTransactionsResponse, Transaction } from '@/types/api';
import { cn, GlassCard } from '@/ui/primitives';
import { controlIconWell, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';
import { formatCategoryName } from '@/utils/categories';
import { fmtUSD } from '@/utils/format';

export type TransactionsScreenSliceState = 'loaded' | 'loading' | 'empty' | 'error';

function makeCursorResponse(items: Transaction[], hasMore = false): CursorTransactionsResponse {
  const last = items.at(-1);
  return {
    transactions: items,
    next_cursor: hasMore && last ? `cursor:${last.id}` : null,
    prev_cursor: null,
    has_more: hasMore,
  };
}

export function TransactionsScreenSlice(props: {
  state: TransactionsScreenSliceState;
  errorMessage?: string;
}) {
  const transactionsForStats = props.state === 'empty' ? [] : transactionsTablePage;

  const stats = useMemo(() => {
    const totalCount = transactionsForStats.length;
    const totalSpent = transactionsForStats.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgTransaction = totalCount > 0 ? totalSpent / totalCount : 0;
    const largestTransaction =
      transactionsForStats.length > 0
        ? transactionsForStats.reduce(
            (max, t) => (Math.abs(t.amount) > Math.abs(max.amount) ? t : max),
            transactionsForStats[0]
          )
        : null;
    const merchantCounts = new Map<string, number>();
    transactionsForStats.forEach((t) => {
      const merchant = t.name;
      merchantCounts.set(merchant, (merchantCounts.get(merchant) || 0) + 1);
    });
    const recurringMerchants = Array.from(merchantCounts.entries())
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
    const recurringCount = Array.from(merchantCounts.values()).filter((c) => c >= 3).length;

    const categoryCounts = new Map<string, number>();
    transactionsForStats.forEach((t) => {
      const cat = formatCategoryName(t.category?.primary || 'Uncategorized');
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    });
    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name);
    const warningSymbol = '⚠';
    const categoryDriver =
      topCategories.length > 0
        ? topCategories.length === 1
          ? `${warningSymbol} ${topCategories[0]}`
          : `${warningSymbol} ${topCategories[0]} & ${topCategories[1]}`
        : null;

    return {
      totalCount,
      totalSpent,
      avgTransaction,
      largestTransaction,
      recurringCount,
      recurringMerchants,
      categoryDriver,
    };
  }, [transactionsForStats]);

  const categories = ['Food', 'Transit', 'Income', 'Entertainment', 'Bills'];

  const handlers =
    props.state === 'empty'
      ? [
          route('GET', '/transactions', () => jsonResponse(makeCursorResponse([]))),
          route('GET', '/transactions/categories', () => jsonResponse(categories)),
          route('GET', '/accounts', () => jsonResponse([])),
        ]
      : props.state === 'error'
        ? [
            route('GET', '/transactions', () =>
              jsonResponse({ error: 'Server error' }, { status: 500 })
            ),
            route('GET', '/transactions/categories', () => jsonResponse(categories)),
            route('GET', '/accounts', () => jsonResponse([])),
          ]
        : [
            route('GET', '/transactions', () =>
              jsonResponse(makeCursorResponse(transactionsTablePage))
            ),
            route('GET', '/transactions/categories', () => jsonResponse(categories)),
            route('GET', '/accounts', () => jsonResponse([])),
          ];

  const filters = props.state === 'empty' ? { search: 'no results query' } : {};

  return (
    <StoryApiScope handlers={handlers}>
      <div data-testid="transactions-page">
        <PageLayout
          title="Explore your ledger"
          subtitle="Review, categorize, and track transactions from all your connected bank accounts."
          stats={
            <div className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-4')}>
              <HeroStatCard
                index={1}
                title="Total shown"
                icon={<ReceiptText />}
                value={stats.totalCount}
                suffix={stats.totalCount === 1 ? 'item' : 'items'}
                subtext={fmtUSD(stats.totalSpent)}
              />
              <HeroStatCard
                index={2}
                accent="teal"
                title="Average size"
                icon={<TrendingUp />}
                value={fmtUSD(stats.avgTransaction)}
                subtext={stats.categoryDriver || undefined}
              />
              <HeroStatCard
                index={3}
                accent="teal"
                title="Largest size"
                icon={<AlertTriangle />}
                value={
                  stats.largestTransaction
                    ? fmtUSD(Math.abs(stats.largestTransaction.amount))
                    : '$0'
                }
                pills={
                  stats.largestTransaction && stats.totalCount > 1
                    ? [{ label: stats.largestTransaction.name }]
                    : []
                }
              />
              <HeroStatCard
                index={4}
                title="Recurring"
                icon={<RefreshCcw />}
                value={stats.recurringCount}
                suffix={stats.recurringCount === 1 ? 'merchant' : 'merchants'}
                pills={stats.recurringMerchants.map((m) => ({ label: m }))}
              />
            </div>
          }
        >
          <GlassCard
            variant="accent"
            rounded="lg"
            padding="none"
            withInnerEffects={false}
            containerClassName={cn('pt-4', 'md:pt-8', 'lg:pt-8')}
            className={cn('space-y-4')}
          >
            <h2
              className={cn(
                'flex',
                'min-w-0',
                'items-center',
                'gap-2',
                'px-4',
                'md:px-8',
                'lg:px-8',
                uiTypographyRecipes.sectionTitle,
                uiTextRecipes.primary
              )}
            >
              <span className={cn(...controlIconWell.lg, heroAccents.teal.icon)} aria-hidden="true">
                <ReceiptText />
              </span>
              Transactions
            </h2>
            <VirtualizedTransactionList filters={filters} variant="page" />
          </GlassCard>
        </PageLayout>
      </div>
    </StoryApiScope>
  );
}
