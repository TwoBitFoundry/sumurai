import { AlertTriangle, ReceiptText, RefreshCcw, TrendingUp } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';
import { cn, GlassCard } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import HeroStatCard from '../components/widgets/HeroStatCard';
import TransactionsTable from '../features/transactions/components/TransactionsTable';
import TransactionsToolbar from '../features/transactions/components/TransactionsToolbar';
import { useTransactions } from '../features/transactions/hooks/useTransactions';
import { PageLayout } from '../layouts/PageLayout';
import { formatCategoryName } from '../utils/categories';
import { fmtUSD } from '../utils/format';

const TransactionsPage: React.FC = () => {
  const {
    isLoading,
    error,
    transactions,
    categories,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    currentPage,
    setCurrentPage,
    pageItems,
    totalItems,
    totalPages,
  } = useTransactions({ pageSize: 8 });

  const stats = useMemo(() => {
    const totalCount = transactions.length;
    const totalSpent = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const avgTransaction = totalCount > 0 ? totalSpent / totalCount : 0;

    const largestTransaction =
      transactions.length > 0
        ? transactions.reduce(
            (max, t) => (Math.abs(t.amount) > Math.abs(max.amount) ? t : max),
            transactions[0]
          )
        : null;

    const merchantCounts = new Map<string, number>();
    transactions.forEach((t) => {
      const merchant = t.merchant || t.name;
      merchantCounts.set(merchant, (merchantCounts.get(merchant) || 0) + 1);
    });
    const recurringCount = Array.from(merchantCounts.values()).filter((count) => count >= 3).length;

    const recurringMerchants = Array.from(merchantCounts.entries())
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, _]) => name);

    const categoryCounts = new Map<string, number>();
    transactions.forEach((t) => {
      const cat = formatCategoryName(t.category?.primary || 'Uncategorized');
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    });

    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name, _]) => name);

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
  }, [transactions]);

  return (
    <div data-testid="transactions-page">
      <PageLayout
        badge="Transaction History"
        title="Review every dollar across accounts"
        subtitle="Search and filter transactions across all connected accounts."
        error={error}
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
            search={search}
            onSearch={setSearch}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
          {isLoading ? (
            <div className={cn('flex', 'items-center', 'justify-center', 'py-16')}>
              <div className="text-center">
                <div className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary, 'mb-2')}>
                  Loading transactions...
                </div>
                <div className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                  Fetching data from server
                </div>
              </div>
            </div>
          ) : (
            <TransactionsTable
              items={pageItems}
              total={totalItems}
              currentPage={currentPage}
              totalPages={totalPages}
              onPrev={() => setCurrentPage(Math.max(1, currentPage - 1))}
              onNext={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            />
          )}
        </GlassCard>
      </PageLayout>
    </div>
  );
};

export default TransactionsPage;
