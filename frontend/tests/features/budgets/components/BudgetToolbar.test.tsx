import { fireEvent, render, screen } from '@testing-library/react';
import BudgetToolbar from '@/features/budgets/components/BudgetToolbar';

describe('BudgetToolbar', () => {
  it('renders month controls and actions', () => {
    const onPreviousMonth = jest.fn();
    const onNextMonth = jest.fn();
    const onCurrentMonth = jest.fn();
    const onAddBudget = jest.fn();

    render(
      <BudgetToolbar
        monthLabel="May 2025"
        loading
        isAdding={false}
        showAddButton
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
        onCurrentMonth={onCurrentMonth}
        onAddBudget={onAddBudget}
      />
    );

    expect(screen.getByTestId('budget-toolbar')).toBeInTheDocument();
    expect(screen.getByText('May 2025')).toBeInTheDocument();
    expect(screen.getByText('Updating')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /previous month/i }));
    fireEvent.click(screen.getByRole('button', { name: /next month/i }));
    fireEvent.click(screen.getByRole('button', { name: /this month/i }));
    fireEvent.click(screen.getByRole('button', { name: /add budget/i }));

    expect(onPreviousMonth).toHaveBeenCalled();
    expect(onNextMonth).toHaveBeenCalled();
    expect(onCurrentMonth).toHaveBeenCalled();
    expect(onAddBudget).toHaveBeenCalled();
  });
});
