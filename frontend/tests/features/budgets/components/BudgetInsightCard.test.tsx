import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetInsightCard } from '@/features/budgets/components/BudgetInsightCard';

const defaultProps = {
  title: 'Daily Pacing',
  value: '$15.00',
  question: 'How much can I spend every day?',
  flipped: false,
  onToggle: jest.fn(),
};

describe('BudgetInsightCard', () => {
  it('renders the metric title and value on the front', () => {
    render(<BudgetInsightCard {...defaultProps} />);
    expect(screen.getByText('Daily Pacing')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.queryByText('How much can I spend every day?')).not.toBeInTheDocument();
  });

  it('renders the question text when flipped is true', () => {
    render(<BudgetInsightCard {...defaultProps} flipped />);
    expect(screen.getByText('How much can I spend every day?')).toBeInTheDocument();
    expect(screen.queryByText('$15.00')).not.toBeInTheDocument();
  });

  it('calls onToggle when the card button is clicked', async () => {
    const onToggle = jest.fn();
    render(<BudgetInsightCard {...defaultProps} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('exposes aria-expanded on the button reflecting flipped state', () => {
    const { rerender } = render(<BudgetInsightCard {...defaultProps} flipped={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    rerender(<BudgetInsightCard {...defaultProps} flipped={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders optional suffix on the front', () => {
    render(<BudgetInsightCard {...defaultProps} suffix="/ day" />);
    expect(screen.getByText('/ day')).toBeInTheDocument();
  });

  it('renders optional subtext pill on the front', () => {
    render(<BudgetInsightCard {...defaultProps} subtext="20 days left" />);
    expect(screen.getByText('20 days left')).toBeInTheDocument();
  });
});
