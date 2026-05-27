import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionsFilters } from '@/features/transactions/components/TransactionsFilters';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';

jest.mock('@/hooks/useViewportBreakpoint', () => ({
  useViewportBreakpoint: jest.fn(),
}));

jest.mock('@/features/transactions/components/DeleteCustomCategoryConfirm', () => ({
  __esModule: true,
  default: ({ open, category }: { open: boolean; category: { display_name: string } | null }) =>
    open ? <div data-testid="delete-custom-category-confirm">{category?.display_name}</div> : null,
}));

const mockUseViewportBreakpoint = useViewportBreakpoint as jest.MockedFunction<
  typeof useViewportBreakpoint
>;

const filterProps = {
  search: '',
  onSearch: jest.fn(),
  categories: ['food_and_drink', 'entertainment'],
  selectedCategory: null,
  onSelectCategory: jest.fn(),
  showSearch: false,
};

describe('TransactionsFilters', () => {
  beforeEach(() => {
    mockUseViewportBreakpoint.mockReturnValue({
      breakpoint: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    });
  });

  it('renders category filters as filter chip buttons', async () => {
    const onSelectCategory = jest.fn();
    const user = userEvent.setup();

    render(<TransactionsFilters {...filterProps} onSelectCategory={onSelectCategory} />);

    const foodButton = screen.getByRole('button', { name: 'Food & Drink' });
    expect(foodButton.className).toContain('rounded-full');
    expect(foodButton.className).toContain('cursor-pointer');
    expect(foodButton.className).toContain('py-0');
    expect(foodButton.className).not.toContain('h-11');
    expect(foodButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(foodButton);
    expect(onSelectCategory).toHaveBeenCalledWith('food_and_drink');
  });

  it('uses touch-height filter chips on mobile', () => {
    mockUseViewportBreakpoint.mockReturnValue({
      breakpoint: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
    });

    render(<TransactionsFilters {...filterProps} />);

    const foodButton = screen.getByRole('button', { name: 'Food & Drink' });
    expect(foodButton.className).toContain('py-0');
    expect(foodButton.className).not.toContain('h-11');
  });

  it('marks the active category filter as pressed', () => {
    render(
      <TransactionsFilters
        search=""
        onSearch={jest.fn()}
        categories={['entertainment']}
        selectedCategory="entertainment"
        onSelectCategory={jest.fn()}
        showSearch={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Entertainment' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('shows a delete affordance for custom categories without toggling the filter', async () => {
    const onSelectCategory = jest.fn();
    const user = userEvent.setup();

    render(
      <TransactionsFilters
        search=""
        onSearch={jest.fn()}
        categories={['food_and_drink', 'Coffee']}
        customCategories={[{ id: 'custom-1', display_name: 'Coffee', lookup_key: 'coffee' }]}
        selectedCategory={null}
        onSelectCategory={onSelectCategory}
        showSearch={false}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Delete Coffee' }));

    expect(onSelectCategory).not.toHaveBeenCalled();
    expect(screen.getByTestId('delete-custom-category-confirm')).toHaveTextContent('Coffee');
  });
});
