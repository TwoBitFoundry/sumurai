import { render } from '@testing-library/react';
import { BudgetList } from '@/features/budgets/components/BudgetList';

const sample = [
  { id: '1', category: 'groceries', amount: 300, spent: 120, percentage: 40 },
  {
    id: '2',
    category: 'entertainment',
    amount: 150,
    spent: 200,
    percentage: 100 + (50 / 150) * 100,
  },
] as any;

describe('BudgetList', () => {
  it('renders categories and amounts', () => {
    const { getByText, getAllByText } = render(
      <BudgetList
        items={sample}
        editingId={null}
        onStartEdit={() => {}}
        onCancelEdit={() => {}}
        onSaveEdit={() => {}}
        onDelete={() => {}}
      />
    );
    // Might appear in multiple elements (tag + select); ensure present
    expect(getAllByText(/Groceries/)[0]).toBeInTheDocument();
    expect(getByText('$300.00')).toBeInTheDocument();
  });
});
