import { render, screen } from '@testing-library/react';
import { Target } from 'lucide-react';
import { AccountRow } from '@/components/AccountRow';
import { BankCard } from '@/components/BankCard';
import { HeroStatCard } from '@/components/widgets/HeroStatCard';
import { DashboardChartCard } from '@/features/analytics/components/DashboardChartCard';
import { BudgetList } from '@/features/budgets/components/BudgetList';
import { BudgetSummaryCard } from '@/features/budgets/components/BudgetSummaryCard';
import { AccountsSummaryStats } from '@/features/plaid/components/AccountsSummaryStats';
import { ProviderSelectionPanel } from '@/features/plaid/components/ProviderSelectionPanel';
import { TransactionsFilters } from '@/features/transactions/components/TransactionsFilters';
import { EmptyState } from '@/ui/primitives';
import { radius as uiRadiusRecipes } from '@/ui/recipes';
import { ThemeTestProvider } from '../utils/ThemeTestProvider';

describe('shared responsive layout surfaces', () => {
  it('matches hero card padding in dashboard chart cards', () => {
    const { container } = render(
      <DashboardChartCard
        title="Spending"
        description="By category"
        refreshingLabel="Refreshing"
        isRefreshing={false}
      >
        <div>Chart</div>
      </DashboardChartCard>
    );

    const root = container.firstElementChild;
    const header = container.querySelector('div.mb-3');
    const content = container.querySelector('div.h-full.flex.flex-col');

    expect(root).toHaveClass('p-4');
    expect(root).toHaveClass('pt-5');
    expect(root).toHaveClass('md:p-8');
    expect(root).toHaveClass('lg:p-8');
    expect(root).toHaveClass('h-full');
    expect(root).not.toHaveClass('p-6');
    expect(container.querySelector('div.min-h-\\[30px\\]')).toBeTruthy();
    expect(header).toHaveClass('md:mb-4');
    expect(content).toBeTruthy();
  });

  it('uses compact hero card padding below the lg tier', () => {
    const { container } = render(
      <HeroStatCard title="Net Worth" value="$10,000" subtext="Cached" />
    );

    const shell = container.querySelector('div.p-3.pt-4');

    expect(shell).toHaveClass('p-3');
    expect(shell).toHaveClass('pt-4');
    expect(shell).toHaveClass('lg:p-4');
    expect(shell).toHaveClass('lg:pt-5');
  });

  it('keeps empty state padding on the md tier', () => {
    const { container } = render(<EmptyState icon={Target} title="Empty" description="No data" />);

    expect(container.firstElementChild).toHaveClass('md:px-12');
    expect(container.firstElementChild).not.toHaveClass('sm:px-12');
  });

  it('keeps transaction search sizing on the md tier', () => {
    const { container } = render(
      <TransactionsFilters
        search=""
        onSearch={jest.fn()}
        categories={[]}
        selectedCategory={null}
        onSelectCategory={jest.fn()}
        showCategories={false}
      />
    );

    const searchWrapper = container.querySelector('div.relative.w-full');

    expect(searchWrapper).toHaveClass('md:w-64');
    expect(searchWrapper).not.toHaveClass('sm:w-64');
  });

  it('keeps account summary stats in two columns until the lg tier', () => {
    const { container } = render(
      <AccountsSummaryStats
        summary={{
          institutions: 2,
          connectedInstitutions: 2,
          accounts: 3,
          latestSync: null,
        }}
        syncingAll={false}
        lastSyncValue="5d ago"
        lastSyncDetail="Refreshed recently"
      />
    );

    expect(container.firstElementChild).toHaveClass('grid-cols-2');
    expect(container.firstElementChild).toHaveClass('lg:grid-cols-3');
    expect(container.firstElementChild).not.toHaveClass('md:grid-cols-3');
  });

  it('matches hero card radius in account rows', () => {
    const { container } = render(
      <ThemeTestProvider>
        <AccountRow
          account={{
            id: 'acct-1',
            name: 'Essential Savings',
            mask: '8677',
            type: 'checking',
            balance: 52011.88,
            transactions: 108,
          }}
          isOnline
        />
      </ThemeTestProvider>
    );

    expect(container.firstElementChild).toHaveClass(uiRadiusRecipes.standard);
  });

  it('matches hero card radius in bank cards', () => {
    const { container } = render(
      <BankCard
        bank={{
          id: 'bank-1',
          name: 'Chase',
          short: 'C',
          status: 'connected',
          lastSync: null,
          connectionId: 'conn-1',
          accounts: [],
        }}
        onSync={jest.fn(async () => undefined)}
        onDisconnect={jest.fn(async () => undefined)}
        onExport={jest.fn(async () => undefined)}
        isExporting={false}
        isOnline
      />
    );

    expect(container.firstElementChild).toHaveClass(uiRadiusRecipes.standard);
  });

  it('keeps total planned right aligned at every breakpoint', () => {
    render(<BudgetSummaryCard totalBudgeted={1000} totalSpent={250} />);

    expect(screen.getByText('Total Planned').parentElement).toHaveClass('text-right');
  });

  it('keeps budget summary totals in a two-column grid on mobile and tablet', () => {
    const { container } = render(<BudgetSummaryCard totalBudgeted={1000} totalSpent={250} />);

    const totalsRow = container.querySelector(
      '[data-testid="budget-summary-card"] .grid.grid-cols-2'
    );

    expect(totalsRow).toHaveClass('grid-cols-2');
    expect(totalsRow).toHaveClass('gap-x-2');
    expect(totalsRow).toHaveClass('md:gap-x-3');
  });

  it('keeps the provider selection title on the md tier', () => {
    const { container } = render(
      <ProviderSelectionPanel
        loading={false}
        error={null}
        availableProviders={['plaid', 'teller']}
        connectingProvider={null}
        onSelectProvider={jest.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Choose how you connect accounts' })).toHaveClass(
      'md:text-[2.25rem]'
    );
    expect(screen.getByAltText('Plaid logo')).toHaveAttribute('src', '/plaid.webp');
    expect(container.firstElementChild).toBeTruthy();
  });

  it('keeps budget list spacing and edit layout on the md tier', () => {
    const items = [
      {
        id: 'budget-1',
        category: 'food and drink',
        amount: 100,
        spent: 25,
        percentage: 25,
      },
    ];

    const { container } = render(
      <BudgetList
        items={items}
        editingId="budget-1"
        onStartEdit={jest.fn()}
        onCancelEdit={jest.fn()}
        onSaveEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    const list = container.querySelector('ul');
    const editGrid = container.querySelector('div.grid.grid-cols-1.gap-3');

    expect(list).not.toHaveClass('md:px-10');
    expect(editGrid).toHaveClass('md:grid-cols-[1fr_auto]');
    expect(editGrid).toHaveClass('md:items-end');
  });
});
