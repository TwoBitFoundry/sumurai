import { render, screen } from '@testing-library/react';
import { Target } from 'lucide-react';
import { DashboardChartCard } from '@/features/analytics/components/DashboardChartCard';
import { BudgetList } from '@/features/budgets/components/BudgetList';
import { BudgetSummaryCard } from '@/features/budgets/components/BudgetSummaryCard';
import { AccountsSummaryStats } from '@/features/plaid/components/AccountsSummaryStats';
import { ProviderSelectionPanel } from '@/features/plaid/components/ProviderSelectionPanel';
import { TransactionsFilters } from '@/features/transactions/components/TransactionsFilters';
import { EmptyState } from '@/ui/primitives';

describe('shared responsive layout surfaces', () => {
  it('uses md shell spacing in dashboard chart cards', () => {
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
    const content = container.querySelector('div.p-4');

    expect(root).toHaveClass('p-6');
    expect(content).toHaveClass('md:p-6');
    expect(header).toHaveClass('md:mb-4');
    expect(content).not.toHaveClass('sm:p-6');
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

  it('keeps account summary stats on the md tier', () => {
    const { container } = render(
      <AccountsSummaryStats
        flowError={null}
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

    expect(container.firstElementChild).toHaveClass('md:grid-cols-3');
    expect(container.firstElementChild).not.toHaveClass('sm:grid-cols-3');
  });

  it('keeps budget summary totals aligned on the md tier', () => {
    render(<BudgetSummaryCard totalBudgeted={1000} totalSpent={250} />);

    expect(screen.getByText('Total Spent').parentElement).toHaveClass('md:text-right');
    expect(screen.getByText('Total Spent').parentElement).not.toHaveClass('sm:text-right');
  });

  it('keeps the provider selection title on the md tier', () => {
    const { container } = render(
      <ProviderSelectionPanel
        loading={false}
        error={null}
        selectedProvider={null}
        availableProviders={['plaid']}
        selectingProvider={null}
        onSelectProvider={jest.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Choose how you connect accounts' })).toHaveClass(
      'md:text-[2.25rem]'
    );
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
    const editGrid = container.querySelector('div.grid.grid-cols-1.gap-4');

    expect(list).toHaveClass('md:px-10');
    expect(list).not.toHaveClass('sm:px-10');
    expect(editGrid).toHaveClass('md:grid-cols-[1fr_auto]');
    expect(editGrid).toHaveClass('md:items-end');
  });
});
