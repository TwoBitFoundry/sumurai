import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { completeExitAnimation, withProgrammaticTimers } from '@tests/utils/programmaticTimers';
import { createRef, useRef, useState } from 'react';
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
    const anchor = document.createElement('button');
    anchorRef.current = anchor;
    jest.clearAllMocks();
    useCategoriesMock.useCategories.mockReturnValue({
      system: ['FOOD_AND_DRINK', 'ENTERTAINMENT'],
      custom: [
        { id: 'c1', display_name: 'Coffee', lookup_key: 'coffee' },
        { id: 'c2', display_name: 'Groceries', lookup_key: 'groceries' },
      ],
      all: ['Coffee', 'ENTERTAINMENT', 'FOOD_AND_DRINK', 'Groceries'],
      accentIndexByName: new Map([
        ['Coffee', 0],
        ['ENTERTAINMENT', 1],
        ['FOOD_AND_DRINK', 2],
        ['Groceries', 3],
      ]),
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

  afterAll(() => {
    setViewport(originalInnerWidth);
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

    expect(screen.getByText('Customize Category')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Food & Drink' })).toHaveAttribute(
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

  it('renders the anchored picker surface on desktop', () => {
    setViewport(1280);

    render(
      <CategoryPicker
        open
        anchorRef={anchorRef}
        currentCategory={{ name: 'FOOD_AND_DRINK', isCustom: false }}
        onSelect={jest.fn()}
        onRequestClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('category-picker-popover')).toBeInTheDocument();
    expect(screen.queryByTestId('category-picker-sheet')).not.toBeInTheDocument();
    expect(screen.getByTestId('category-picker-popover')).toHaveClass('category-picker-popover');
    expect(screen.getByRole('button', { name: 'Close category picker' })).toBeInTheDocument();
  });

  it('closes the popover from the header close button on desktop', async () => {
    const onRequestClose = jest.fn();
    const user = userEvent.setup();
    setViewport(1280);

    render(
      <CategoryPicker
        open
        anchorRef={anchorRef}
        currentCategory={{ name: 'FOOD_AND_DRINK', isCustom: false }}
        onSelect={jest.fn()}
        onRequestClose={onRequestClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Close category picker' }));

    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('stays closed when the anchor is clicked again while the popover is open', async () => {
    const user = userEvent.setup();
    setViewport(1280);

    function Harness() {
      const [open, setOpen] = useState(false);
      const ref = useRef<HTMLButtonElement>(null);

      return (
        <>
          <button
            ref={ref}
            type="button"
            onClick={() => {
              setOpen((value) => !value);
            }}
          >
            Toggle category
          </button>
          <CategoryPicker
            open={open}
            anchorRef={ref}
            currentCategory={{ name: 'FOOD_AND_DRINK', isCustom: false }}
            onSelect={jest.fn()}
            onRequestClose={() => {
              setOpen(false);
            }}
          />
        </>
      );
    }

    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Toggle category' }));
    expect(screen.getByTestId('category-picker-popover')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Toggle category' }));
    expect(screen.queryByTestId('category-picker-popover')).not.toBeInTheDocument();
  });

  it('closes the drawer from the header close button', async () => {
    const onRequestClose = jest.fn();
    setViewport(375);

    render(
      <CategoryPicker
        open
        anchorRef={anchorRef}
        currentCategory={{ name: 'FOOD_AND_DRINK', isCustom: false }}
        onSelect={jest.fn()}
        onRequestClose={onRequestClose}
      />
    );

    await withProgrammaticTimers(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close category picker' }));
      expect(onRequestClose).not.toHaveBeenCalled();
      await completeExitAnimation(screen.getByRole('dialog'));
      expect(onRequestClose).toHaveBeenCalledTimes(1);
    });
  });

  it('renders the anchored picker surface on tablet', () => {
    setViewport(800);

    render(
      <CategoryPicker
        open
        anchorRef={anchorRef}
        currentCategory={{ name: 'FOOD_AND_DRINK', isCustom: false }}
        onSelect={jest.fn()}
        onRequestClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('category-picker-popover')).toBeInTheDocument();
    expect(screen.queryByTestId('category-picker-sheet')).not.toBeInTheDocument();
  });

  it('renders a bottom sheet without a blurred backdrop on mobile', () => {
    setViewport(375);

    render(
      <CategoryPicker
        open
        anchorRef={anchorRef}
        currentCategory={{ name: 'FOOD_AND_DRINK', isCustom: false }}
        onSelect={jest.fn()}
        onRequestClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('category-picker-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('category-picker-popover')).not.toBeInTheDocument();
    expect(screen.getByTestId('modal-backdrop')).toHaveAttribute('data-presentation', 'drawer');
    expect(screen.getByTestId('modal-backdrop').className).not.toContain('backdrop-blur');
  });

  it('renders a mobile bottom sheet with 44px tap targets below the md breakpoint', () => {
    setViewport(375);

    render(
      <CategoryPicker
        open
        anchorRef={anchorRef}
        currentCategory={{ name: 'FOOD_AND_DRINK', isCustom: false }}
        onSelect={jest.fn()}
        onRequestClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('category-picker-sheet')).toHaveClass(
      'w-full',
      'max-w-none',
      'max-h-[min(50dvh,32rem)]',
      'overflow-hidden'
    );
    expect(screen.queryByTestId('category-picker-popover')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Food & Drink' })).toHaveClass(
      'min-h-11',
      'md:min-h-9',
      'lg:min-h-8',
      'ring-inset'
    );
    expect(screen.getByText('Customize Category').closest('section')).toHaveClass(
      'flex',
      'min-h-0',
      'flex-1',
      'flex-col',
      'overflow-hidden'
    );
    expect(screen.getByRole('button', { name: 'Food & Drink' }).parentElement).toHaveClass(
      'flex-wrap',
      'gap-2'
    );
    expect(screen.getByRole('button', { name: 'Close category picker' })).toBeInTheDocument();
    const scrollArea = screen.getByText('Customize Category').closest('section')?.children[1];
    expect(scrollArea).toHaveClass(
      'min-h-0',
      'flex-1',
      'overflow-y-auto',
      'overscroll-contain',
      'touch-pan-y'
    );
    expect(screen.getByRole('textbox', { name: 'Make Your Own' })).toHaveClass(
      'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_26%,transparent)]',
      'focus-visible:ring-inset'
    );
    expect(screen.getByRole('button', { name: 'Confirm category' })).toHaveClass('h-11', 'w-11');
  });

  it('renders suggested categories in alphabetical order', () => {
    render(
      <CategoryPicker
        open
        anchorRef={anchorRef}
        currentCategory={{ name: 'FOOD_AND_DRINK', isCustom: false }}
        onSelect={jest.fn()}
        onRequestClose={jest.fn()}
      />
    );

    const labels = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('aria-pressed'))
      .map((button) => button.textContent);

    expect(labels).toEqual(['Coffee', 'Entertainment', 'Food & Drink', 'Groceries']);
  });

  it('closes without selecting when the current category is clicked again', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Coffee' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onRequestClose).toHaveBeenCalledTimes(1);
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

    const input = screen.getByRole('textbox', { name: 'Make Your Own' });
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

    const input = screen.getByRole('textbox', { name: 'Make Your Own' });
    await user.type(input, 'weekend brunch');
    await user.click(screen.getByRole('button', { name: 'Confirm category' }));

    await waitFor(() => {
      expect(createCustomCategoryAsync).toHaveBeenCalledWith('Weekend Brunch');
      expect(onSelect).toHaveBeenCalledWith({ categoryName: 'Weekend Brunch', isCustom: true });
      expect(onRequestClose).toHaveBeenCalledTimes(1);
    });
  });
});
