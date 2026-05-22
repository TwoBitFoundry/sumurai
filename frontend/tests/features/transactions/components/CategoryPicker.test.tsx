import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { CategoryPicker } from '@/features/transactions/components/CategoryPicker';

jest.mock('@/features/transactions/hooks/useCategories', () => ({
  useCategories: jest.fn(),
}));

jest.mock('@/features/transactions/hooks/useCreateCustomCategory', () => ({
  useCreateCustomCategory: jest.fn(),
}));

const useCategoriesMock = jest.requireMock(
  '@/features/transactions/hooks/useCategories'
) as typeof import('@/features/transactions/hooks/useCategories');
const useCreateCustomCategoryMock = jest.requireMock(
  '@/features/transactions/hooks/useCreateCustomCategory'
) as typeof import('@/features/transactions/hooks/useCreateCustomCategory');

describe('CategoryPicker', () => {
  const anchorRef = createRef<HTMLElement>();

  beforeEach(() => {
    const anchor = document.createElement('button');
    anchorRef.current = anchor;
    jest.clearAllMocks();
    useCategoriesMock.useCategories.mockReturnValue({
      system: ['FOOD_AND_DRINK', 'ENTERTAINMENT'],
      custom: [
        { id: 'c1', display_name: 'Coffee', lookup_key: 'coffee' },
        { id: 'c2', display_name: 'Groceries', lookup_key: 'groceries' },
      ],
      all: ['FOOD_AND_DRINK', 'ENTERTAINMENT', 'Coffee', 'Groceries'],
      isLoading: false,
      error: null,
    });
    useCreateCustomCategoryMock.useCreateCustomCategory.mockReturnValue({
      createCustomCategory: jest.fn(),
      createCustomCategoryAsync: jest.fn().mockResolvedValue({
        id: 'c3',
        display_name: 'Weekend Brunch',
        lookup_key: 'weekend brunch',
      }),
      isPending: false,
      error: null,
    });
  });

  it('renders suggestions, keeps the current category selected, and closes on escape', async () => {
    const onSelect = jest.fn();
    const onRequestClose = jest.fn();
    const user = userEvent.setup();

    render(
      <CategoryPicker
        open
        anchorRef={anchorRef}
        currentCategory={{ name: 'FOOD_AND_DRINK', isCustom: false }}
        onSelect={onSelect}
        onRequestClose={onRequestClose}
      />
    );

    expect(screen.getByText('Suggested')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Food And Drink' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Entertainment' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    await user.keyboard('{Escape}');
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects a suggested category and closes immediately', async () => {
    const onSelect = jest.fn();
    const onRequestClose = jest.fn();
    const user = userEvent.setup();

    render(
      <CategoryPicker
        open
        anchorRef={anchorRef}
        currentCategory={{ name: 'Coffee', isCustom: true }}
        onSelect={onSelect}
        onRequestClose={onRequestClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Entertainment' }));

    expect(onSelect).toHaveBeenCalledWith({ categoryName: 'ENTERTAINMENT', isCustom: false });
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['too_long', ['This is a very long category name'], 'Keep it to 30 characters or fewer.'],
    ['too_many_words', ['One Two Three Four'], 'Use up to 3 words.'],
    ['empty', ['Coffee', ''], 'Enter a category name.'],
    ['invalid_characters', ['Coffee 1'], 'Use letters and spaces only.'],
    ['collides_system', ['Food And Drink'], 'That matches an existing system category.'],
    ['collides_custom', ['Coffee'], 'That matches an existing custom category.'],
  ] as const)('surfaces the %s validation error', async (_code, inputValues, message) => {
    const user = userEvent.setup();

    render(
      <CategoryPicker
        open
        anchorRef={anchorRef}
        currentCategory={{ name: 'Food', isCustom: false }}
        onSelect={jest.fn()}
        onRequestClose={jest.fn()}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Type your own' });
    for (const value of inputValues) {
      if (value === '') {
        await user.clear(input);
      } else {
        await user.type(input, value);
      }
    }

    await waitFor(() => {
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm category' })).toBeDisabled();
    });
  });

  it('creates a new custom category before selecting it and closing', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const onRequestClose = jest.fn();
    const createCustomCategoryAsync = jest.fn().mockResolvedValue({
      id: 'c3',
      display_name: 'Weekend Brunch',
      lookup_key: 'weekend brunch',
    });

    useCreateCustomCategoryMock.useCreateCustomCategory.mockReturnValue({
      createCustomCategory: jest.fn(),
      createCustomCategoryAsync,
      isPending: false,
      error: null,
    });

    render(
      <CategoryPicker
        open
        anchorRef={anchorRef}
        currentCategory={{ name: 'FOOD_AND_DRINK', isCustom: false }}
        onSelect={onSelect}
        onRequestClose={onRequestClose}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Type your own' });
    await user.type(input, 'weekend brunch');
    await user.click(screen.getByRole('button', { name: 'Confirm category' }));

    await waitFor(() => {
      expect(createCustomCategoryAsync).toHaveBeenCalledWith('Weekend Brunch');
      expect(onSelect).toHaveBeenCalledWith({ categoryName: 'Weekend Brunch', isCustom: true });
      expect(onRequestClose).toHaveBeenCalledTimes(1);
    });
  });
});
