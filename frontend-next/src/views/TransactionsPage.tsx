import React, { useMemo } from 'react';
import { useTransactions } from '../features/transactions/hooks/useTransactions';
import TransactionsFilters from '../features/transactions/components/TransactionsFilters';
import TransactionsTable from '../features/transactions/components/TransactionsTable';
import { fmtUSD } from '../utils/format';
import { ReceiptText, TrendingUp, AlertTriangle, RefreshCcw } from 'lucide-react';
import HeroStatCard from '../components/widgets/HeroStatCard';
import { formatCategoryName } from '../utils/categories';
import { PageLayout } from '../layouts/PageLayout';
import { cn } from '@/ui/primitives';

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

  // Pills overflow handled within HeroStatCard

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

  // No local scroll fade management needed

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
        <div
          className={cn(
            'relative',
            'overflow-hidden',
            'rounded-[2.25rem]',
            'border',
            'border-white/35',
            'bg-white/18',
            'p-0',
            'shadow-[0_40px_120px_-82px_rgba(15,23,42,0.75)]',
            'backdrop-blur-2xl',
            'backdrop-saturate-[150%]',
            'transition-colors',
            'duration-500',
            'dark:border-white/12',
            'dark:bg-[#0f172a]/55',
            'dark:shadow-[0_42px_140px_-80px_rgba(2,6,23,0.85)]'
          )}
        >
          <div className={cn('pointer-events-none', 'absolute', 'inset-0')}>
            <div
              className={cn(
                'absolute',
                'inset-[1px]',
                'rounded-[2.2rem]',
                'ring-1',
                'ring-white/40',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)]',
                'dark:ring-white/10',
                'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.5)]'
              )}
            />
            <div
              className={cn(
                'absolute',
                'inset-0',
                'bg-gradient-to-b',
                'from-white/65',
                'via-white/25',
                'to-transparent',
                'transition-colors',
                'duration-500',
                'dark:from-slate-900/68',
                'dark:via-slate-900/34',
                'dark:to-transparent'
              )}
            />
          </div>
          <div className={cn('relative', 'z-10')}>
            <div
              className={cn(
                'border-b',
                'border-slate-200/70',
                'px-6',
                'pb-4',
                'pt-6',
                'dark:border-slate-700/50'
              )}
            >
              <div className={cn('flex', 'items-center', 'gap-4')}>
                <div className={cn('flex-1', 'min-w-0')}>
                  <TransactionsFilters
                    search={search}
                    onSearch={setSearch}
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    showSearch={false}
                    showCategories
                  />
                </div>
                <div className="flex-shrink-0">
                  <TransactionsFilters
                    search={search}
                    onSearch={setSearch}
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    showSearch
                    showCategories={false}
                  />
                </div>
              </div>
            </div>
            {isLoading ? (
              <div className={cn('flex', 'items-center', 'justify-center', 'py-16')}>
                <div className="text-center">
                  <div
                    className={cn(
                      'text-lg',
                      'font-medium',
                      'text-slate-600',
                      'dark:text-slate-400',
                      'mb-2'
                    )}
                  >
                    Loading transactions...
                  </div>
                  <div className={cn('text-sm', 'text-slate-500', 'dark:text-slate-500')}>
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
          </div>
        </div>
      </PageLayout>
    </div>
  );
};

export default TransactionsPage;
