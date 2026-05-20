import { AlertTriangle, ReceiptText, RefreshCcw, TrendingUp } from 'lucide-react';
import type React from 'react';
import { cn, GlassCard } from '@/ui/primitives';
import HeroStatCard from '../components/widgets/HeroStatCard';
import TransactionsTable from '../features/transactions/components/TransactionsTable';
import TransactionsToolbar from '../features/transactions/components/TransactionsToolbar';
import type { TransactionFilterControl } from '../features/transactions/hooks/useTransactionFilterState';
import { useTransactions } from '../features/transactions/hooks/useTransactions';
import { useTransactionsInsights } from '../features/transactions/hooks/useTransactionsInsights';
import { PageLayout } from '../layouts/PageLayout';
import { formatCategoryName } from '../utils/categories';
import { fmtUSD } from '../utils/format';

const TransactionsPage: React.FC<{ filterControl: TransactionFilterControl }> = ({
  filterControl,
}) => {
  const {
    isLoading,
    error,
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
    dateRange,
  } = useTransactions({ pageSize: 8, filterControl });
  const {
    insights,
    isLoading: insightsLoading,
    error: insightsError,
  } = useTransactionsInsights({
    search,
    selectedCategory,
    dateRange,
  });

  const loadingMessage = insightsLoading
    ? 'Loading...'
    : !insights && insightsError
      ? 'Unavailable'
      : null;
  const totalCount = insights?.total_count ?? 0;
  const totalSpent = insights?.total_spent ?? 0;
  const avgTransaction = insights?.average_amount ?? 0;
  const largestTransaction = insights?.largest ?? null;
  const recurringCount = insights?.recurring_count ?? 0;
  const recurringMerchants = insights?.recurring_merchants ?? [];
  const topCategories = insights?.top_categories ?? [];
  const categoryDriver =
    loadingMessage || topCategories.length === 0
      ? null
      : topCategories.length === 1
        ? `⚠ ${formatCategoryName(topCategories[0])}`
        : `⚠ ${formatCategoryName(topCategories[0])} & ${formatCategoryName(topCategories[1])}`;

  return (
    <div data-testid="transactions-page">
      <PageLayout
        badge="Transactions"
        title="Review every dollar across accounts"
        subtitle="Search and filter transactions across all connected accounts."
        error={error}
        stats={
          <div className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-4')}>
            <HeroStatCard
              index={1}
              title="Total shown"
              icon={<ReceiptText className={cn('h-4', 'w-4')} />}
              value={loadingMessage ?? totalCount}
              suffix={loadingMessage ? undefined : totalCount === 1 ? 'item' : 'items'}
              subtext={loadingMessage ? undefined : fmtUSD(totalSpent)}
            />

            <HeroStatCard
              index={2}
              title="Average size"
              icon={<TrendingUp className={cn('h-4', 'w-4')} />}
              value={loadingMessage ?? fmtUSD(avgTransaction)}
              subtext={loadingMessage ? undefined : categoryDriver || undefined}
            />

            <HeroStatCard
              index={3}
              title="Largest size"
              icon={<AlertTriangle className={cn('h-4', 'w-4')} />}
              value={
                loadingMessage ??
                (largestTransaction ? fmtUSD(Math.abs(largestTransaction.amount)) : '$0')
              }
              pills={
                loadingMessage
                  ? []
                  : largestTransaction && totalCount > 1
                    ? [
                        {
                          label: largestTransaction.merchant,
                        },
                      ]
                    : []
              }
            />

            <HeroStatCard
              index={4}
              title="Recurring"
              icon={<RefreshCcw className={cn('h-4', 'w-4')} />}
              value={loadingMessage ?? recurringCount}
              suffix={loadingMessage ? undefined : recurringCount === 1 ? 'merchant' : 'merchants'}
              pills={loadingMessage ? [] : recurringMerchants.map((m) => ({ label: m }))}
            />
          </div>
        }
      >
        <GlassCard
          variant="accent"
          rounded="lg"
          padding="none"
          withInnerEffects={false}
          className={cn('relative', 'z-10')}
        >
          <TransactionsToolbar
            search={search}
            onSearch={setSearch}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
          <TransactionsTable
            items={pageItems}
            total={totalItems}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={8}
            isLoading={isLoading}
            onPrev={() => setCurrentPage(Math.max(1, currentPage - 1))}
            onNext={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          />
        </GlassCard>
      </PageLayout>
    </div>
  );
};

export default TransactionsPage;
