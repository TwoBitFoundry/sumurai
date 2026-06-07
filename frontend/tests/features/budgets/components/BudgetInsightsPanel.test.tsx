import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BudgetInsights } from '@/domain/BudgetInsightsCalculator';
import { BudgetInsightsPanel } from '@/features/budgets/components/BudgetInsightsPanel';
import { text as uiTextRecipes } from '@/ui/recipes';

const baseInsights: BudgetInsights = {
  dailyPacing: 15,
  income: 5000,
  freeSpend: 250,
  runoutDate: new Date(2026, 5, 25),
  hasActivity: true,
};

const defaultProps = {
  insights: baseInsights,
  subscriptions: [],
  month: new Date(2026, 5, 1),
  filterKey: 'all',
};

describe('BudgetInsightsPanel', () => {
  it('renders all four insight cards', () => {
    render(<BudgetInsightsPanel {...defaultProps} />);
    expect(screen.getByText('Runway Pace')).toBeInTheDocument();
    expect(screen.getByText('Free Spend')).toBeInTheDocument();
    expect(screen.getByText('Sub Costs')).toBeInTheDocument();
  });

  it('uses a single column on mobile, two on tablet, and three on desktop', () => {
    render(<BudgetInsightsPanel {...defaultProps} />);

    const grid = screen.getByTestId('budget-insights-grid');
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('md:grid-cols-2');
    expect(grid).toHaveClass('lg:grid-cols-3');
    expect(grid).toHaveClass('[&>*:last-child]:md:col-span-2');
    expect(grid).toHaveClass('[&>*:last-child]:lg:col-span-1');
  });

  it('clicking a card flips it to show the question', async () => {
    render(<BudgetInsightsPanel {...defaultProps} />);
    const dailyPacingButton = screen.getByRole('button', { name: /runway pace/i });
    expect(dailyPacingButton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(dailyPacingButton);
    expect(dailyPacingButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking a flipped card returns it to the front', async () => {
    render(<BudgetInsightsPanel {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /runway pace/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('a different card is not affected when one is flipped', async () => {
    render(<BudgetInsightsPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /runway pace/i }));
    expect(screen.getByRole('button', { name: /free spend/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('resets all flipped cards when filterKey changes', async () => {
    const { rerender } = render(<BudgetInsightsPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /runway pace/i }));
    expect(screen.getByRole('button', { name: /runway pace/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    rerender(<BudgetInsightsPanel {...defaultProps} filterKey="account-123" />);
    expect(screen.getByRole('button', { name: /runway pace/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('highlights negative free spend in red', () => {
    render(
      <BudgetInsightsPanel
        {...defaultProps}
        insights={{ ...baseInsights, income: 1000, freeSpend: -150 }}
      />
    );

    const freeSpendCard = screen.getByTestId('budget-insight-card-free-spend');
    const freeSpendAmount = within(freeSpendCard).getByText('-$150.00');
    expect(freeSpendAmount).toHaveClass(uiTextRecipes.danger);
  });

  it('shows zero-activity fallback when hasActivity is false', () => {
    render(
      <BudgetInsightsPanel {...defaultProps} insights={{ ...baseInsights, hasActivity: false }} />
    );
    expect(screen.getByTestId('budget-insights-empty')).toBeInTheDocument();
    expect(screen.queryByText('Runway Pace')).not.toBeInTheDocument();
  });
});
