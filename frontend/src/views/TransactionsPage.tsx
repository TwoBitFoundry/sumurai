import { Loader2, ReceiptText, Tags, WandSparkles } from 'lucide-react';
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
import { useAccountsToastStack } from '../features/accounts/hooks/useAccountsToastStack';
import { useAutoCategorization } from '../features/auto-categorization/hooks/useAutoCategorization';
import CategoryCatalogPicker from '../features/transactions/components/CategoryCatalogPicker';
import { TransactionInsightsPanel } from '../features/transactions/components/TransactionInsightsPanel';
import TransactionsTable from '../features/transactions/components/TransactionsTable';
import TransactionsToolbar from '../features/transactions/components/TransactionsToolbar';
import { useCategories } from '../features/transactions/hooks/useCategories';
import type { TransactionFilterControl } from '../features/transactions/hooks/useTransactionFilterState';
import { useTransactions } from '../features/transactions/hooks/useTransactions';
import { useTransactionsContextualInsights } from '../features/transactions/hooks/useTransactionsContextualInsights';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { PageLayout } from '../layouts/PageLayout';

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
    accountKey,
  } = useTransactionsContextualInsights({
    search,
    selectedCategory,
    dateRange,
  });
  const isOnline = useOnlineStatus();
  const autoCategorization = useAutoCategorization();
  const { pinnedToast, transients, dismissTransient, dismissPinned, pushToast } =
    useAccountsToastStack(autoCategorization.job);

  const { custom } = useCategories();
  const addCategoryButtonRef = useRef<HTMLButtonElement>(null);
  const [isCategoryCatalogOpen, setIsCategoryCatalogOpen] = useState(false);

  const insightsResetKey = `${insights?.state ?? 'a'}-${search}-${selectedCategory ?? ''}-${accountKey}-${dateRange ?? ''}`;
  const actions = (
    <div
      className={cn(
        'flex',
        'w-full',
        'flex-wrap',
        'items-center',
        'justify-between',
        'gap-3',
        'lg:w-auto'
      )}
    >
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
        <Tags />
      </IconButton>
      <Button
        type="button"
        onClick={() => void autoCategorization.handleAction()}
        disabled={!isOnline || autoCategorization.isPending}
        variant={autoCategorization.isActive ? 'danger' : 'primary'}
        size="md"
        className={cn('shrink-0', 'normal-case')}
        title={
          !isOnline ? 'Unavailable while offline' : (autoCategorization.progressLabel ?? undefined)
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
  );

  return (
    <div data-testid="transactions-page">
      <PageLayout
        title="Tally the ledgers across financial allies"
        subtitle="Review, categorize, and track transactions from all your connected bank accounts."
        actions={actions}
        error={error}
        stats={
          <TransactionInsightsPanel
            insights={insights}
            isLoading={insightsLoading}
            resetKey={insightsResetKey}
          />
        }
      >
        <GlassCard
          variant="accent"
          rounded="lg"
          padding="none"
          withInnerEffects={false}
          className={cn('relative', 'z-10')}
        >
          <div className={cn('space-y-1', 'px-3', 'pt-6', 'md:px-6')}>
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
