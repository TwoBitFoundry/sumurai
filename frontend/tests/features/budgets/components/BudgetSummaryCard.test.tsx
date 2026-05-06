import { render, screen } from '@testing-library/react';
import BudgetSummaryCard from '@/features/budgets/components/BudgetSummaryCard';

describe('BudgetSummaryCard', () => {
  it('renders planned and spent totals with progress', () => {
    render(<BudgetSummaryCard totalBudgeted={200} totalSpent={150} />);

    expect(screen.getByTestId('budget-summary-card')).toBeInTheDocument();
    expect(screen.getByText('$200.00')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText(/75% used/)).toBeInTheDocument();
  });

  it('switches to over-budget formatting when spent exceeds planned', () => {
    render(<BudgetSummaryCard totalBudgeted={100} totalSpent={125} />);

    expect(screen.getByText(/125% used/)).toBeInTheDocument();
    expect(screen.getByText('$125.00')).toBeInTheDocument();
  });
});
