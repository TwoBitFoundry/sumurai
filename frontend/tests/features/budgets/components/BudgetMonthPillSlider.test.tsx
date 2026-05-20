import { fireEvent, render, screen } from '@testing-library/react';
import { BudgetMonthPillSlider } from '@/features/budgets/components/BudgetMonthPillSlider';

describe('BudgetMonthPillSlider', () => {
  it('renders month navigation and calls handlers', () => {
    const onPreviousMonth = jest.fn();
    const onNextMonth = jest.fn();
    const onCurrentMonth = jest.fn();

    render(
      <BudgetMonthPillSlider
        monthLabel="May 2026"
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
        onCurrentMonth={onCurrentMonth}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'This month' }));

    expect(screen.getByText('May 2026')).toBeInTheDocument();
    expect(onPreviousMonth).toHaveBeenCalledTimes(1);
    expect(onNextMonth).toHaveBeenCalledTimes(1);
    expect(onCurrentMonth).toHaveBeenCalledTimes(1);
  });

  it('uses stronger body text for the month label', () => {
    render(
      <BudgetMonthPillSlider
        monthLabel="May 2026"
        onPreviousMonth={jest.fn()}
        onNextMonth={jest.fn()}
        onCurrentMonth={jest.fn()}
      />
    );

    expect(screen.getByText('May 2026').parentElement).toHaveClass('font-body-strong');
  });
});
