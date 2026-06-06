import {
  AlertTriangle,
  Loader2,
  ReceiptText,
  Settings,
  TrendingUp,
  WandSparkles,
} from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { Button, cn, GlassCard, IconButton } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import {
  control,
  controlIconWell,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';
import { ToastStack } from '../components/toastStack/ToastStack';
import HeroStatCard from '../components/widgets/HeroStatCard';
import { useAccountsToastStack } from '../features/accounts/hooks/useAccountsToastStack';
import { useAutoCategorization } from '../features/auto-categorization/hooks/useAutoCategorization';
import CategoryCatalogPicker from '../features/transactions/components/CategoryCatalogPicker';
import TransactionsTable from '../features/transactions/components/TransactionsTable';
import TransactionsToolbar from '../features/transactions/components/TransactionsToolbar';
import { useCategories } from '../features/transactions/hooks/useCategories';
import type { TransactionFilterControl } from '../features/transactions/hooks/useTransactionFilterState';
import { useTransactions } from '../features/transactions/hooks/useTransactions';
import { useTransactionsInsights } from '../features/transactions/hooks/useTransactionsInsights';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { PageLayout } from '../layouts/PageLayout';
import { formatCategoryName } from '../utils/categories';
import { fmtUSD } from '../utils/format';

const TransactionsPage: React.FC<{ filterControl: TransactionFilterControl }> = ({
  filterControl,
}) => {
  const {
    isLoading,
    error,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    currentPage,
    setCurrentPage,
    pageItems,
    totalItems,
    totalPages,
    tableAnimationKey,
    dateRange,
    categories,
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
  const isOnline = useOnlineStatus();
  const autoCategorization = useAutoCategorization();
  const { pinnedToast, transients, dismissTransient, dismissPinned, pushToast } =
    useAccountsToastStack(autoCategorization.job);

  const loadingMessage = insightsLoading
    ? 'Fetching...'
    : !insights && insightsError
      ? 'Unavailable'
      : null;
  const totalCount = insights?.total_count ?? 0;
  const totalSpent = insights?.total_spent ?? 0;
  const avgTransaction = insights?.average_amount ?? 0;
  const largestTransaction = insights?.largest ?? null;
  const topCategories = insights?.top_categories ?? [];
  const { custom } = useCategories();
  const addCategoryButtonRef = useRef<HTMLButtonElement>(null);
  const [isCategoryCatalogOpen, setIsCategoryCatalogOpen] = useState(false);
  const categoryDriver =
    loadingMessage || topCategories.length === 0
      ? null
      : topCategories.length === 1
        ? `⚠ ${formatCategoryName(topCategories[0])}`
        : `⚠ ${formatCategoryName(topCategories[0])} & ${formatCategoryName(topCategories[1])}`;
  const actions = (
    <div className={cn('flex', 'w-full', 'justify-end', 'lg:w-auto', 'lg:justify-start')}>
      <div className="inline-flex max-w-full flex-col items-center gap-2">
        <Button
          type="button"
          onClick={() => void autoCategorization.handleAction()}
          disabled={!isOnline || autoCategorization.isPending}
          variant={autoCategorization.isActive ? 'danger' : 'primary'}
          size="md"
          className={cn('normal-case')}
          title={
            !isOnline
              ? 'Unavailable while offline'
              : (autoCategorization.progressLabel ?? undefined)
          }
        >
          {autoCategorization.isPending ? (
            <Loader2 className={cn(control.glyph.md, 'animate-spin')} />
          ) : (
            <WandSparkles className={cn(control.glyph.md)} />
          )}
          {autoCategorization.isActive ? 'Cancel' : 'Categorize'}
        </Button>
      </div>
    </div>
  );

  return (
    <div data-testid="transactions-page">
      <PageLayout
        title="Tally the ledgers across financial allies"
        subtitle="Review, categorize, and track transactions from all your connected bank accounts."
        actions={actions}
        error={error}
        stats={
          <div className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-3')}>
            <HeroStatCard
              index={1}
              title="Total shown"
              icon={<ReceiptText />}
              value={loadingMessage ?? totalCount}
              suffix={loadingMessage ? undefined : totalCount === 1 ? 'item' : 'items'}
              subtext={loadingMessage ? undefined : fmtUSD(totalSpent)}
            />

            <HeroStatCard
              index={2}
              title="Average size"
              icon={<TrendingUp />}
              value={loadingMessage ?? fmtUSD(avgTransaction)}
              subtext={loadingMessage ? undefined : categoryDriver || undefined}
            />

            <HeroStatCard
              index={3}
              title="Largest size"
              icon={<AlertTriangle />}
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
          <div
            className={cn(
              'flex',
              'flex-col',
              'gap-4',
              'sm:flex-row',
              'sm:items-start',
              'sm:justify-between',
              'px-3',
              'pt-6',
              'md:px-6'
            )}
          >
            <div className={cn('space-y-1')}>
              <h2
                className={cn(
                  'flex',
                  'min-w-0',
                  'items-center',
                  'gap-2',
                  uiTypographyRecipes.sectionTitle,
                  uiTextRecipes.primary
                )}
              >
                <span
                  className={cn(...controlIconWell.lg, heroAccents.emerald.icon)}
                  aria-hidden="true"
                >
                  <ReceiptText />
                </span>
                Transactions
              </h2>
              <p className={cn(uiTypographyRecipes.body, uiTextRecipes.muted)}>
                Search or filter your transactions by category or keywords. Add or customize the
                categories.
              </p>
            </div>
            <IconButton
              ref={addCategoryButtonRef}
              type="button"
              onClick={() => setIsCategoryCatalogOpen((open) => !open)}
              variant="ghost"
              size="md"
              aria-label="Categories"
              title="Categories"
              aria-expanded={isCategoryCatalogOpen}
              aria-haspopup="dialog"
              className={cn(appTitleBarRecipes.settingsIdle, 'shrink-0')}
            >
              <Settings />
            </IconButton>
          </div>
          <CategoryCatalogPicker
            open={isCategoryCatalogOpen}
            anchorRef={addCategoryButtonRef}
            onRequestClose={() => setIsCategoryCatalogOpen(false)}
            onCategoryCreated={(categoryName) => {
              pushToast(`"${categoryName}" category added`, 'success');
            }}
            onCategoryDeleted={(categoryName) => {
              if (selectedCategory === categoryName) {
                setSelectedCategory(null);
              }
            }}
          />
          <TransactionsToolbar
            search={search}
            onSearch={setSearch}
            categories={categories}
            customCategories={custom}
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
            bodyAnimationKey={tableAnimationKey}
            onPrev={() => setCurrentPage(Math.max(1, currentPage - 1))}
            onNext={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          />
        </GlassCard>
        <ToastStack
          transients={transients}
          pinnedToast={pinnedToast}
          onDismissTransient={dismissTransient}
          onDismissPinned={dismissPinned}
        />
      </PageLayout>
    </div>
  );
};

export default TransactionsPage;
