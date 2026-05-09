import { AlertTriangle, ReceiptText, RefreshCcw, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import HeroStatCard from '@/components/widgets/HeroStatCard';
import TransactionsTable from '@/features/transactions/components/TransactionsTable';
import TransactionsToolbar from '@/features/transactions/components/TransactionsToolbar';
import { PageLayout } from '@/layouts/PageLayout';
import { denseLabelTransaction, transactionsTablePage } from '@/storybook/fixtures/transactions';
import { cn, GlassCard } from '@/ui/primitives';
import { text as uiTextRecipes } from '@/ui/recipes';
import { formatCategoryName } from '@/utils/categories';
import { fmtUSD } from '@/utils/format';

export type TransactionsScreenSliceState = 'loaded' | 'loading' | 'empty' | 'error';

export function TransactionsScreenSlice(props: {
  state: TransactionsScreenSliceState;
  errorMessage?: string;
  tableVariant?: 'default' | 'denseMerchant';
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
      const merchant = t.merchant || t.name;
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
    const warningSymbol = '\u26A0';
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

  const tableModel =
    props.tableVariant === 'denseMerchant'
      ? { items: [denseLabelTransaction] as typeof transactionsTablePage, total: 1, totalPages: 1 }
      : { items: transactionsTablePage, total: 80, totalPages: 10 };

  const currentPage = 1;

  return (
    <div data-testid="transactions-page">
      <PageLayout
        badge="Transaction History"
        title="Review every dollar across accounts"
        subtitle="Search and filter transactions across all connected accounts."
        error={
          props.state === 'error' ? (props.errorMessage ?? 'Failed to load transactions.') : null
        }
        stats={
          <div className={cn('grid', 'gap-3', 'sm:grid-cols-2', 'lg:grid-cols-4')}>
            <HeroStatCard
              index={1}
              title="Total shown"
              icon={<ReceiptText className={cn('h-4', 'w-4')} />}
              value={stats.totalCount}
              suffix={stats.totalCount === 1 ? 'item' : 'items'}
              subtext={fmtUSD(stats.totalSpent)}
            />
            <HeroStatCard
              index={2}
              title="Average size"
              icon={<TrendingUp className={cn('h-4', 'w-4')} />}
              value={fmtUSD(stats.avgTransaction)}
              subtext={stats.categoryDriver || undefined}
            />
            <HeroStatCard
              index={3}
              title="Largest size"
              icon={<AlertTriangle className={cn('h-4', 'w-4')} />}
              value={
                stats.largestTransaction ? fmtUSD(Math.abs(stats.largestTransaction.amount)) : '$0'
              }
              pills={
                stats.largestTransaction && stats.totalCount > 1
                  ? [
                      {
                        label:
                          (stats.largestTransaction.merchant || stats.largestTransaction.name) ??
                          '',
                      },
                    ]
                  : []
              }
            />
            <HeroStatCard
              index={4}
              title="Recurring"
              icon={<RefreshCcw className={cn('h-4', 'w-4')} />}
              value={stats.recurringCount}
              suffix={stats.recurringCount === 1 ? 'merchant' : 'merchants'}
              pills={stats.recurringMerchants.map((m) => ({ label: m }))}
            />
          </div>
        }
      >
        <GlassCard
          variant="default"
          rounded="default"
          padding="none"
          className={cn('relative', 'z-10')}
        >
          <TransactionsToolbar
            search="coffee"
            onSearch={() => {}}
            categories={categories}
            selectedCategory="Food"
            onSelectCategory={() => {}}
          />
          {props.state === 'loading' ? (
            <div className={cn('flex', 'items-center', 'justify-center', 'py-16')}>
              <div className="text-center">
                <div className={cn('text-lg', 'font-medium', uiTextRecipes.muted, 'mb-2')}>
                  Loading transactions...
                </div>
                <div className={cn('text-sm', uiTextRecipes.subtle)}>Fetching data from server</div>
              </div>
            </div>
          ) : (
            <TransactionsTable
              items={props.state === 'empty' ? [] : tableModel.items}
              total={props.state === 'empty' ? 0 : tableModel.total}
              currentPage={currentPage}
              totalPages={props.state === 'empty' ? 1 : tableModel.totalPages}
              onPrev={() => {}}
              onNext={() => {}}
            />
          )}
        </GlassCard>
      </PageLayout>
    </div>
  );
}
