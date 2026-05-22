import { render, screen } from '@testing-library/react';
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

jest.mock('@/features/transactions/hooks/useCategories', () => ({
  useCategories: () => ({
    accentIndexByName: new Map([
      ['FOOD_AND_DRINK', 0],
      ['ENTERTAINMENT', 1],
    ]),
  }),
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

  it('keeps the mobile chevron trigger visible at the larger touch-target size', () => {
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

    expect(screen.getByRole('button', { name: 'Edit category: Food And Drink' })).toHaveClass(
      'h-9',
      'rounded-full'
    );
  });

  it('opens the picker from the chevron with Enter', async () => {
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

    const trigger = screen.getByRole('button', { name: 'Edit category: Food And Drink' });

    trigger.focus();
    await user.keyboard('{Enter}');

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
