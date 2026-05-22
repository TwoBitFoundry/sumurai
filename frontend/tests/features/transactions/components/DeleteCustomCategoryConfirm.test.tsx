import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteCustomCategoryConfirm } from '@/features/transactions/components/DeleteCustomCategoryConfirm';

jest.mock('@/features/transactions/hooks/useDeleteCustomCategory', () => ({
  useDeleteCustomCategory: jest.fn(),
}));

const useDeleteCustomCategoryMock = jest.requireMock(
  '@/features/transactions/hooks/useDeleteCustomCategory'
) as typeof import('@/features/transactions/hooks/useDeleteCustomCategory');

describe('DeleteCustomCategoryConfirm', () => {
  const deleteCustomCategoryAsync = jest.fn();
  const onRequestClose = jest.fn();
  const originalInnerWidth = window.innerWidth;

  const setViewport = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
    window.dispatchEvent(new Event('resize'));
  };

  beforeEach(() => {
    setViewport(1280);
    jest.clearAllMocks();
    useDeleteCustomCategoryMock.useDeleteCustomCategory.mockReturnValue({
      deleteCustomCategory: jest.fn(),
      deleteCustomCategoryAsync,
      isPending: false,
      error: null,
    });
  });

  afterAll(() => {
    setViewport(originalInnerWidth);
  });

  it.each([800, 1280])('keeps the centered dialog surface outside mobile at %ipx', (width) => {
    setViewport(width);

    render(
      <DeleteCustomCategoryConfirm
        open
        category={{ id: 'custom-1', display_name: 'Coffee', lookup_key: 'coffee' }}
        onRequestClose={onRequestClose}
      />
    );

    expect(screen.getByTestId('delete-custom-category-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-custom-category-sheet')).not.toBeInTheDocument();
  });

  it('renders as a bottom sheet on mobile', () => {
    setViewport(375);

    render(
      <DeleteCustomCategoryConfirm
        open
        category={{ id: 'custom-1', display_name: 'Coffee', lookup_key: 'coffee' }}
        onRequestClose={onRequestClose}
      />
    );

    expect(screen.getByTestId('delete-custom-category-sheet')).toHaveClass('w-full', 'max-w-none');
    expect(screen.queryByTestId('delete-custom-category-dialog')).not.toBeInTheDocument();
  });

  it('renders the confirmation copy and closes after delete succeeds', async () => {
    const user = userEvent.setup();
    deleteCustomCategoryAsync.mockResolvedValue(undefined);

    render(
      <DeleteCustomCategoryConfirm
        open
        category={{ id: 'custom-1', display_name: 'Coffee', lookup_key: 'coffee' }}
        onRequestClose={onRequestClose}
      />
    );

    expect(screen.getByText("Delete 'Coffee'?")).toBeVisible();
    expect(
      screen.getByText(
        'Transactions in this category will fall back to their original assigned category.'
      )
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteCustomCategoryAsync).toHaveBeenCalledWith('custom-1');
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('shows the pending state inline', () => {
    useDeleteCustomCategoryMock.useDeleteCustomCategory.mockReturnValue({
      deleteCustomCategory: jest.fn(),
      deleteCustomCategoryAsync,
      isPending: true,
      error: null,
    });

    render(
      <DeleteCustomCategoryConfirm
        open
        category={{ id: 'custom-1', display_name: 'Coffee', lookup_key: 'coffee' }}
        onRequestClose={onRequestClose}
      />
    );

    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('shows the error inline when the delete fails', () => {
    useDeleteCustomCategoryMock.useDeleteCustomCategory.mockReturnValue({
      deleteCustomCategory: jest.fn(),
      deleteCustomCategoryAsync,
      isPending: false,
      error: new Error('Nope'),
    });

    render(
      <DeleteCustomCategoryConfirm
        open
        category={{ id: 'custom-1', display_name: 'Coffee', lookup_key: 'coffee' }}
        onRequestClose={onRequestClose}
      />
    );

    expect(screen.getByText('Nope')).toBeVisible();
  });
});
