import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BudgetStats } from '@/domain/BudgetCalculator';
import type { BudgetInsights } from '@/domain/BudgetInsightsCalculator';
import { BudgetInsightsPanel } from '@/features/budgets/components/BudgetInsightsPanel';

const baseInsights: BudgetInsights = {
  dailyPacing: 15,
  safeToSpend: 250,
  upcomingSubscriptionsTotal: 50,
  runoutDate: new Date(2026, 5, 25),
  accountWeightPct: null,
  budgetSlack: 250,
  hasActivity: true,
};

const baseStats: BudgetStats = {
  totalBudgeted: 500,
  totalSpent: 200,
  remaining: 300,
  variance: 300,
  overBudgetCount: 0,
  overBudgetCategories: [],
  daysRemaining: 20,
  totalDays: 30,
  activeBudgetCategories: ['FOOD'],
  nearLimitCategories: [],
};

const defaultProps = {
  insights: baseInsights,
  stats: baseStats,
  month: new Date(2026, 5, 1),
  filterKey: 'all',
};

describe('BudgetInsightsPanel', () => {
  it('renders all four insight cards', () => {
    render(<BudgetInsightsPanel {...defaultProps} />);
    expect(screen.getByText('Daily Pacing')).toBeInTheDocument();
    expect(screen.getByText('Safe-To-Spend')).toBeInTheDocument();
    expect(screen.getByText('Exhaustion Projection')).toBeInTheDocument();
    expect(screen.getByText('Budget Slack')).toBeInTheDocument();
  });

  it('clicking a card flips it to show the question', async () => {
    render(<BudgetInsightsPanel {...defaultProps} />);
    const dailyPacingButton = screen.getByRole('button', { name: /daily pacing/i });
    expect(dailyPacingButton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(dailyPacingButton);
    expect(dailyPacingButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking a flipped card returns it to the front', async () => {
    render(<BudgetInsightsPanel {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /daily pacing/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('a different card is not affected when one is flipped', async () => {
    render(<BudgetInsightsPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /daily pacing/i }));
    expect(screen.getByRole('button', { name: /safe-to-spend/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('resets all flipped cards when filterKey changes', async () => {
    const { rerender } = render(<BudgetInsightsPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /daily pacing/i }));
    expect(screen.getByRole('button', { name: /daily pacing/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    rerender(<BudgetInsightsPanel {...defaultProps} filterKey="account-123" />);
    expect(screen.getByRole('button', { name: /daily pacing/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('shows zero-activity fallback when hasActivity is false', () => {
    render(
      <BudgetInsightsPanel {...defaultProps} insights={{ ...baseInsights, hasActivity: false }} />
    );
    expect(screen.getByTestId('budget-insights-empty')).toBeInTheDocument();
    expect(screen.queryByText('Daily Pacing')).not.toBeInTheDocument();
  });

  it('shows Account Burden card when isAccountFiltered', () => {
    render(
      <BudgetInsightsPanel
        {...defaultProps}
        insights={{ ...baseInsights, accountWeightPct: 40 }}
        isAccountFiltered
      />
    );
    expect(screen.getByText('Account Burden')).toBeInTheDocument();
    expect(screen.queryByText('Budget Slack')).not.toBeInTheDocument();
  });
});
