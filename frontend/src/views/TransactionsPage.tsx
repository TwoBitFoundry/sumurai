import { Loader2, ReceiptText, Tags, WandSparkles } from 'lucide-react';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
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
import VirtualizedTransactionList from '../features/transactions/components/VirtualizedTransactionList';
import type { TransactionFilterControl } from '../features/transactions/hooks/useTransactionFilterState';
import { useTransactionsContextualInsights } from '../features/transactions/hooks/useTransactionsContextualInsights';
import { resolveAccountFilterToggle } from '../features/transactions/utils/resolveAccountFilterToggle';
import { resolveMerchantSearchToggle } from '../features/transactions/utils/resolveMerchantSearchToggle';
import { useAccountFilter } from '../hooks/useAccountFilter';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { PageLayout } from '../layouts/PageLayout';

const TransactionsPage: React.FC<{
  filterControl: TransactionFilterControl;
}> = ({ filterControl }) => {
  const { search, setSearch, selectedCategory, setSelectedCategory } = filterControl;
  const { selectedAccountIds, allAccountIds, setSelectedAccountIds } = useAccountFilter();

  const {
    insights,
    displayState,
    isLoading: insightsLoading,
    accountKey,
    error,
  } = useTransactionsContextualInsights({
    search,
    selectedCategory,
    dateRange: undefined,
  });
  const isOnline = useOnlineStatus();
  const autoCategorization = useAutoCategorization();
  const { pinnedToast, transients, dismissTransient, dismissPinned, pushToast } =
    useAccountsToastStack(autoCategorization.job);

  const addCategoryButtonRef = useRef<HTMLButtonElement>(null);
  const [isCategoryCatalogOpen, setIsCategoryCatalogOpen] = useState(false);

  const insightsResetKey = `${displayState}-${search}-${selectedCategory ?? ''}-${accountKey}`;
  const filters = {
    search: search || undefined,
    categoryPrimary: selectedCategory ?? undefined,
  };

  const handleMerchantSearch = useCallback(
    (merchant: string) => {
      setSearch(resolveMerchantSearchToggle(search, merchant));
    },
    [search, setSearch]
  );

  const handleAccountFilter = useCallback(
    (accountId: string) => {
      setSelectedAccountIds(
        resolveAccountFilterToggle(accountId, selectedAccountIds, allAccountIds)
      );
    },
    [allAccountIds, selectedAccountIds, setSelectedAccountIds]
  );

  const categorizeActions = (
    <div
      className={cn(
        'flex',
        'w-full',
        'shrink-0',
        'items-center',
        'justify-between',
        'gap-3',
        'md:w-auto',
        'md:justify-start'
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
        error={error}
        stats={
          <TransactionInsightsPanel
            insights={insights}
            displayState={displayState}
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
          <div
            className={cn(
              'flex',
              'flex-wrap',
              'items-center',
              'justify-between',
              'gap-3',
              'px-3',
              'pt-6',
              'pb-4',
              'md:px-6'
            )}
          >
            <h2
              className={cn(
                'flex',
                'min-w-0',
                'w-full',
                'items-center',
                'gap-2',
                'md:w-auto',
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
            {categorizeActions}
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
          <VirtualizedTransactionList
            filters={filters}
            variant="page"
            onMerchantSearch={handleMerchantSearch}
            onAccountFilter={handleAccountFilter}
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
