import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import {
  BudgetMonthLabelPill,
  BudgetMonthPillSlider,
} from '@/features/budgets/components/BudgetMonthPillSlider';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';

function renderBudgetMonthPillSlider(ui: React.ReactElement) {
  return render(<ControlTooltipProvider>{ui}</ControlTooltipProvider>);
}

describe('BudgetMonthPillSlider', () => {
  it('renders month navigation and calls handlers', () => {
    const onPreviousMonth = jest.fn();
    const onNextMonth = jest.fn();
    const onCurrentMonth = jest.fn();

    renderBudgetMonthPillSlider(
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

    expect(screen.getByText('May 2026')).toBeInTheDocument();
  });

  it('uses the shared date label pill styling', () => {
    render(<BudgetMonthLabelPill monthLabel="June 2026" />);

    const pill = screen.getByTestId('budget-month-label-pill');
    expect(pill.className).toContain('brand-fog');
    expect(pill.className).toContain('backdrop-blur-md');
    expect(pill.className).not.toContain('status-info');
    expect(pill.querySelector('span')?.className).toContain('--color-text-primary');
  });
});
