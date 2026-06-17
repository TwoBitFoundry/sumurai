import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { BudgetProgress } from '@/features/budgets/components/BudgetProgress';

describe('dashboard surface components', () => {
  it('keeps the budget progress copy intact', () => {
    render(createElement(BudgetProgress, { amount: 500, spent: 220 }));

    expect(screen.getByText(/44%/i)).toBeVisible();
    expect(screen.getByText(/\$280\.00/i)).toBeVisible();
  });
});
