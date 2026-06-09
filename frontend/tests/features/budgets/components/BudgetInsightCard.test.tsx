import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightCard } from '@/components/widgets/InsightCard';

const defaultProps = {
  title: 'Daily Pacing',
  value: '$15.00',
  question: 'How much can I spend every day?',
  flipped: false,
  onToggle: jest.fn(),
};

describe('InsightCard', () => {
  it('renders the metric title and value on the front', () => {
    render(<InsightCard {...defaultProps} />);
    expect(screen.getByText('Daily Pacing')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.queryByText('How much can I spend every day?')).not.toBeInTheDocument();
  });

  it('renders the question text when flipped is true', () => {
    render(<InsightCard {...defaultProps} flipped />);
    expect(screen.getByText('How much can I spend every day?')).toBeInTheDocument();
    expect(screen.getByTestId('insight-question').querySelector('svg')).toBeTruthy();
    expect(screen.queryByText('$15.00')).not.toBeInTheDocument();
  });

  it('calls onToggle when the card button is clicked', async () => {
    const onToggle = jest.fn();
    render(<InsightCard {...defaultProps} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('exposes aria-expanded on the button reflecting flipped state', () => {
    const { rerender } = render(<InsightCard {...defaultProps} flipped={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    rerender(<InsightCard {...defaultProps} flipped={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders optional suffix on the front', () => {
    render(<InsightCard {...defaultProps} suffix="/ day" />);
    expect(screen.getByText('/ day')).toBeInTheDocument();
  });

  it('keeps the front row on one line', () => {
    const { container } = render(
      <InsightCard
        {...defaultProps}
        title="Runway Pace"
        value={
          <span>
            $18.55<span>/ d until Jun 17</span>
          </span>
        }
      />
    );

    const frontFace = container.querySelector('.whitespace-nowrap.justify-between');
    expect(frontFace).toBeTruthy();
    expect(frontFace?.className).not.toContain('flex-col');
    expect(frontFace?.className).not.toContain('flex-wrap');
    expect(frontFace?.textContent).toContain('Runway Pace');
    expect(frontFace?.textContent).toContain('$18.55');
  });
});
