import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { CategoryCatalogPicker } from '@/features/transactions/components/CategoryCatalogPicker';

jest.mock('@/features/transactions/hooks/useCategories', () => ({
  useCategories: jest.fn(),
}));

jest.mock('@/features/transactions/hooks/useCreateCustomCategory', () => ({
  useCreateCustomCategory: jest.fn(),
}));

jest.mock('@/features/transactions/components/DeleteCustomCategoryConfirm', () => ({
  __esModule: true,
  default: ({ open, category }: { open: boolean; category: { display_name: string } | null }) =>
    open ? <div data-testid="delete-custom-category-confirm">{category?.display_name}</div> : null,
}));

const useCategoriesMock = jest.requireMock(
  '@/features/transactions/hooks/useCategories'
) as typeof import('@/features/transactions/hooks/useCategories');
const useCreateCustomCategoryMock = jest.requireMock(
  '@/features/transactions/hooks/useCreateCustomCategory'
) as typeof import('@/features/transactions/hooks/useCreateCustomCategory');

describe('CategoryCatalogPicker', () => {
  const anchorRef = createRef<HTMLElement>();
  const createCustomCategoryAsync = jest.fn();

  beforeEach(() => {
    const anchor = document.createElement('button');
    anchorRef.current = anchor;
    jest.clearAllMocks();
    useCategoriesMock.useCategories.mockReturnValue({
      system: ['FOOD_AND_DRINK', 'ENTERTAINMENT'],
      custom: [{ id: 'c1', display_name: 'Coffee', lookup_key: 'coffee' }],
      all: ['Coffee', 'ENTERTAINMENT', 'FOOD_AND_DRINK'],
      accentIndexByName: new Map([
        ['Coffee', 0],
        ['ENTERTAINMENT', 1],
        ['FOOD_AND_DRINK', 2],
      ]),
      isLoading: false,
      error: null,
    });
    createCustomCategoryAsync.mockResolvedValue({
      id: 'c2',
      display_name: 'Weekend Brunch',
      lookup_key: 'weekend brunch',
    });
    useCreateCustomCategoryMock.useCreateCustomCategory.mockReturnValue({
      createCustomCategory: jest.fn(),
      createCustomCategoryAsync,
      isPending: false,
      error: null,
    });
  });

  it('shows read-only system category pills and creates a custom category without selecting one', async () => {
    const onRequestClose = jest.fn();
    const onCategoryCreated = jest.fn();
    const user = userEvent.setup();

    render(
      <CategoryCatalogPicker
        open
        anchorRef={anchorRef}
        onRequestClose={onRequestClose}
        onCategoryCreated={onCategoryCreated}
      />
    );

    expect(screen.getByText('Manage Categories')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Food & Drink' })).not.toBeInTheDocument();
    expect(screen.getByText('Food & Drink')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Make Your Own'), 'Weekend Brunch');
    await user.click(screen.getByRole('button', { name: 'Confirm category' }));

    await waitFor(() => {
      expect(createCustomCategoryAsync).toHaveBeenCalledWith('Weekend Brunch');
    });
    expect(onCategoryCreated).toHaveBeenCalledWith('Weekend Brunch');
    expect(onRequestClose).toHaveBeenCalled();
  });

  it('shows a delete affordance for custom categories only', async () => {
    const user = userEvent.setup();

    render(<CategoryCatalogPicker open anchorRef={anchorRef} onRequestClose={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Delete Coffee' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Food & Drink' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Entertainment' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Coffee' }));

    expect(screen.getByTestId('delete-custom-category-confirm')).toHaveTextContent('Coffee');
  });
});
