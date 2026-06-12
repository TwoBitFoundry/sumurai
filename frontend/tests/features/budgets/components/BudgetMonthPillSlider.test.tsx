import { fireEvent, render, screen } from '@testing-library/react';
import {
  BudgetMonthLabelPill,
  BudgetMonthPillSlider,
} from '@/features/budgets/components/BudgetMonthPillSlider';

describe('BudgetMonthPillSlider', () => {
  it('renders month navigation and calls handlers', () => {
    const onPreviousMonth = jest.fn();
    const onNextMonth = jest.fn();
    const onCurrentMonth = jest.fn();

    render(
      <BudgetMonthPillSlider
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
        onCurrentMonth={onCurrentMonth}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'This month' }));

    expect(onPreviousMonth).toHaveBeenCalledTimes(1);
    expect(onNextMonth).toHaveBeenCalledTimes(1);
    expect(onCurrentMonth).toHaveBeenCalledTimes(1);
  });
});

describe('BudgetMonthLabelPill', () => {
  it('shows the selected budget month in a non-interactive pill', () => {
    render(<BudgetMonthLabelPill monthLabel="May 2026" />);

    expect(screen.getByLabelText(/selected budget month:/i)).toHaveTextContent('May 2026');
  });
});
