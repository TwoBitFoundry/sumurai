import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineCategoryCell } from '@/features/transactions/components/InlineCategoryCell';

jest.mock('@/features/transactions/components/CategoryPicker', () => ({
  __esModule: true,
  default: ({
    open,
    onSelect,
    onRequestClose,
  }: {
    open: boolean;
    onSelect: (selection: { categoryName: string; isCustom: boolean }) => void;
    onRequestClose: () => void;
  }) =>
    open ? (
      <div data-testid="category-picker">
        <button
          type="button"
          onClick={() => {
            onSelect({ categoryName: 'ENTERTAINMENT', isCustom: false });
            onRequestClose();
          }}
        >
          choose
        </button>
      </div>
    ) : null,
}));

jest.mock('@/features/transactions/hooks/useUpdateTransactionCategory', () => ({
  useUpdateTransactionCategory: jest.fn(),
}));

const useUpdateTransactionCategoryMock = jest.requireMock(
  '@/features/transactions/hooks/useUpdateTransactionCategory'
) as typeof import('@/features/transactions/hooks/useUpdateTransactionCategory');

describe('InlineCategoryCell', () => {
  const updateTransactionCategory = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useUpdateTransactionCategoryMock.useUpdateTransactionCategory.mockReturnValue({
      updateTransactionCategory,
      updateTransactionCategoryAsync: jest.fn(),
      isPending: false,
      error: null,
    });
  });

  it.each(['{Enter}', '{Space}'])('opens the picker from the chevron with %s', async (key) => {
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <InlineCategoryCell
                transaction={{
                  id: 'tx-1',
                  date: '2025-01-15',
                  name: 'Coffee',
                  amount: -12.34,
                  category: { primary: 'FOOD_AND_DRINK' },
                  account_name: 'Checking',
                }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    );

    const trigger = screen.getByRole('button', { name: 'Edit category: Food And Drink' });

    fireEvent.focus(trigger);
    if (key === '{Enter}') {
      fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });
      fireEvent.keyUp(trigger, { key: 'Enter', code: 'Enter' });
    } else {
      fireEvent.keyDown(trigger, { key: ' ', code: 'Space' });
      fireEvent.keyUp(trigger, { key: ' ', code: 'Space' });
    }

    expect(screen.getByTestId('category-picker')).toBeInTheDocument();
  });

  it('updates the transaction category when the picker selects a suggestion', async () => {
    const user = userEvent.setup();

    render(
      <table>
        <tbody>
          <tr>
            <td>
              <InlineCategoryCell
                transaction={{
                  id: 'tx-1',
                  date: '2025-01-15',
                  name: 'Coffee',
                  amount: -12.34,
                  category: { primary: 'FOOD_AND_DRINK' },
                  account_name: 'Checking',
                }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    );

    await user.click(screen.getByRole('button', { name: 'Edit category: Food And Drink' }));
    await user.click(screen.getByRole('button', { name: 'choose' }));

    expect(updateTransactionCategory).toHaveBeenCalledWith({
      transactionId: 'tx-1',
      categoryName: 'ENTERTAINMENT',
      isCustom: false,
    });
    expect(screen.queryByTestId('category-picker')).not.toBeInTheDocument();
  });
});
